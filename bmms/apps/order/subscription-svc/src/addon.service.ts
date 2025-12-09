import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { EventTopics } from '@bmms/event';
import * as crypto from 'crypto';

import { Addon } from './entities/addon.entity';
import { UserAddon } from './entities/user-addon.entity';

/**
 * Add-on Service (Optimized)
 * 
 * Manages purchasable add-ons for freemium and subscription users.
 * 
 * Optimizations:
 * - In-memory caching for addon list
 * - Batch queries instead of N+1
 * - Async Kafka publishing
 * - Query optimization with select fields
 */
@Injectable()
export class AddonService {
  private readonly logger = new Logger(AddonService.name);
  
  // [Addon] In-memory cache for addons (rarely changes)
  private addonCache: Map<string, Addon> = new Map();
  private addonListCache: { data: Addon[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor(
    @InjectRepository(Addon)
    private readonly addonRepo: Repository<Addon>,

    @InjectRepository(UserAddon)
    private readonly userAddonRepo: Repository<UserAddon>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {
    // Pre-warm cache on startup
    this.warmupCache();
  }

  /**
   * Pre-warm cache on service startup
   */
  private async warmupCache(): Promise<void> {
    try {
      const addons = await this.addonRepo.find({
        where: { isActive: true },
        order: { price: 'ASC' },
      });
      
      this.addonListCache = { data: addons, timestamp: Date.now() };
      addons.forEach(addon => this.addonCache.set(addon.addonKey, addon));
      
      this.logger.log(`[Addon] Cache warmed up with ${addons.length} addons`);
    } catch (error) {
      this.logger.warn(`[WARNING] Failed to warmup cache: ${error.message}`);
    }
  }

  /**
   * Invalidate cache (call after create/update/delete)
   */
  private invalidateCache(): void {
    this.addonCache.clear();
    this.addonListCache = null;
  }

  // ============= ADDON MANAGEMENT =============

  /**
   * List all available add-ons with pagination (cached)
   */
  async listAddons(page: number = 1, limit: number = 20): Promise<{ addons: Addon[]; total: number; page: number; limit: number; totalPages: number }> {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    // Check cache for full list
    if (this.addonListCache && (Date.now() - this.addonListCache.timestamp) < this.CACHE_TTL) {
      const cachedData = this.addonListCache.data;
      const paginatedAddons = cachedData.slice(skip, skip + take);
      
      return {
        addons: paginatedAddons,
        total: cachedData.length,
        page,
        limit: take,
        totalPages: Math.ceil(cachedData.length / take),
      };
    }

    // Fetch from DB and cache
    const [addons, total] = await this.addonRepo.findAndCount({
      where: { isActive: true },
      order: { price: 'ASC' },
      select: ['id', 'addonKey', 'name', 'description', 'price', 'billingPeriod', 'isActive', 'features'],
    });

    // Update cache
    this.addonListCache = { data: addons, timestamp: Date.now() };
    addons.forEach(addon => this.addonCache.set(addon.addonKey, addon));

    const paginatedAddons = addons.slice(skip, skip + take);

    return {
      addons: paginatedAddons,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Get add-on by key (cached)
   */
  async getAddonByKey(addonKey: string): Promise<Addon> {
    // Check cache first
    if (this.addonCache.has(addonKey)) {
      return this.addonCache.get(addonKey)!;
    }

    const addon = await this.addonRepo.findOne({
      where: { addonKey, isActive: true },
      select: ['id', 'addonKey', 'name', 'description', 'price', 'billingPeriod', 'isActive', 'features'],
    });

    if (!addon) {
      throw new NotFoundException(`Add-on ${addonKey} not found`);
    }

    // Cache for future use
    this.addonCache.set(addonKey, addon);

    return addon;
  }

  /**
   * Create new add-on (Admin only)
   */
  async createAddon(data: {
    addonKey: string;
    name: string;
    description?: string;
    price: number;
    billingPeriod: 'monthly' | 'yearly' | 'onetime';
    features?: Record<string, any>;
  }): Promise<Addon> {
    const addon = await this.addonRepo.save(
      this.addonRepo.create(data),
    );

    // Invalidate cache
    this.invalidateCache();

    this.logger.log(`[Addon] Created add-on: ${addon.name} (${addon.addonKey})`);

    return addon;
  }

  // ============= USER ADD-ON PURCHASES =============

  /**
   * Purchase add-on(s) for a user (Optimized)
   * - Batch fetch addons
   * - Batch check existing
   * - Async Kafka emit
   */
  async purchaseAddons(
    subscriptionId: string,
    customerId: string,
    addonKeys: string[],
  ): Promise<UserAddon[]> {
    if (!addonKeys || addonKeys.length === 0) {
      return [];
    }

    this.logger.log(`[Addon] User ${customerId} purchasing ${addonKeys.length} add-ons`);

    // [Addon] Batch fetch all addons at once
    const addons = await Promise.all(
      addonKeys.map(key => this.getAddonByKey(key).catch(() => null))
    );
    const validAddons = addons.filter((a): a is Addon => a !== null);

    if (validAddons.length === 0) {
      return [];
    }

    // [Addon] Batch check existing user addons
    const existingAddons = await this.userAddonRepo.find({
      where: {
        subscriptionId,
        addonId: In(validAddons.map(a => a.id)),
        status: 'active',
      },
      select: ['addonId'],
    });
    const existingAddonIds = new Set(existingAddons.map(e => e.addonId));

    // Filter out already purchased addons
    const toPurchase = validAddons.filter(a => !existingAddonIds.has(a.id));

    if (toPurchase.length === 0) {
      this.logger.warn(`[WARNING] User already has all requested add-ons`);
      return [];
    }

    // [Addon] Batch create user addons
    const purchasedAt = new Date();
    const userAddons = toPurchase.map(addon => {
      let expiresAt: Date | null = null;
      let nextBillingDate: Date | null = null;

      if (addon.billingPeriod === 'monthly') {
        expiresAt = new Date(purchasedAt);
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        nextBillingDate = new Date(expiresAt);
      } else if (addon.billingPeriod === 'yearly') {
        expiresAt = new Date(purchasedAt);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        nextBillingDate = new Date(expiresAt);
      }

      const userAddon = new UserAddon();
      userAddon.subscriptionId = subscriptionId;
      userAddon.addonId = addon.id;
      userAddon.customerId = customerId;
      userAddon.price = addon.price;
      userAddon.status = 'active';
      userAddon.purchasedAt = purchasedAt;
      userAddon.expiresAt = expiresAt;
      userAddon.nextBillingDate = nextBillingDate;

      return userAddon;
    });

    // [Addon] Batch save
    const savedAddons = await this.userAddonRepo.save(userAddons);

    this.logger.log(`[Addon] Purchased ${savedAddons.length} add-ons`);

    // [Addon] Async Kafka emit (non-blocking)
    setImmediate(() => {
      try {
        this.kafka.emit(EventTopics.ADDON_PURCHASED, {
          eventId: crypto.randomUUID(),
          eventType: EventTopics.ADDON_PURCHASED,
          timestamp: new Date(),
          source: 'subscription-svc',
          data: {
            subscriptionId,
            customerId,
            addons: savedAddons.map(p => ({
              userAddonId: p.id,
              addonId: p.addonId,
              price: p.price,
              purchasedAt: p.purchasedAt,
              nextBillingDate: p.nextBillingDate,
            })),
          },
        });
        this.logger.log(`[Addon] Emitted ADDON_PURCHASED event (async)`);
      } catch (error) {
        this.logger.error(`Failed to emit ADDON_PURCHASED: ${error.message}`);
      }
    });

    return savedAddons;
  }

  /**
   * Get user's active add-ons with pagination
   */
  async getUserAddons(
    subscriptionId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ userAddons: UserAddon[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const [userAddons, total] = await this.userAddonRepo.findAndCount({
      where: {
        subscriptionId,
        status: 'active',
      },
      order: { purchasedAt: 'DESC' },
      skip,
      take,
      select: ['id', 'subscriptionId', 'addonId', 'customerId', 'price', 'status', 'purchasedAt', 'expiresAt', 'nextBillingDate'],
    });

    return {
      userAddons,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Cancel add-on
   */
  async cancelAddon(userAddonId: string): Promise<UserAddon> {
    const userAddon = await this.userAddonRepo.findOne({
      where: { id: userAddonId },
      select: ['id', 'subscriptionId', 'addonId', 'customerId', 'price', 'status', 'purchasedAt', 'expiresAt', 'nextBillingDate', 'cancelledAt'],
    });

    if (!userAddon) {
      throw new NotFoundException(`User add-on ${userAddonId} not found`);
    }

    // Already cancelled - return as is
    if (userAddon.status === 'cancelled') {
      return userAddon;
    }

    // [Addon] Use update instead of save for better performance
    await this.userAddonRepo.update(userAddonId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    userAddon.status = 'cancelled';
    userAddon.cancelledAt = new Date();

    this.logger.log(`[ERROR] Cancelled add-on ${userAddonId}`);

    return userAddon;
  }

  /**
   * Renew recurring add-ons (Optimized - called by cron job)
   */
  async renewRecurringAddons(): Promise<void> {
    const now = new Date();

    // [Addon] Use query builder for efficient filtering
    const toRenew = await this.userAddonRepo
      .createQueryBuilder('ua')
      .where('ua.status = :status', { status: 'active' })
      .andWhere('ua.next_billing_date <= :now', { now })
      .select(['ua.id', 'ua.subscriptionId', 'ua.customerId', 'ua.addonId', 'ua.price', 'ua.nextBillingDate'])
      .getMany();

    if (toRenew.length === 0) {
      return;
    }

    this.logger.log(`[Addon] Renewing ${toRenew.length} add-ons`);

    // [Addon] Batch emit and update
    const updates: Promise<any>[] = [];

    for (const userAddon of toRenew) {
      // Async emit
      setImmediate(() => {
        this.kafka.emit(EventTopics.ADDON_RENEWED, {
          eventId: crypto.randomUUID(),
          eventType: EventTopics.ADDON_RENEWED,
          timestamp: new Date(),
          source: 'subscription-svc',
          data: {
            userAddonId: userAddon.id,
            subscriptionId: userAddon.subscriptionId,
            customerId: userAddon.customerId,
            addonId: userAddon.addonId,
            price: userAddon.price,
          },
        });
      });

      // Calculate next billing date
      if (userAddon.nextBillingDate) {
        const nextBillingDate = new Date(userAddon.nextBillingDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        
        updates.push(
          this.userAddonRepo.update(userAddon.id, { nextBillingDate })
        );
      }
    }

    // [Addon] Batch execute updates
    await Promise.all(updates);
  }
}
