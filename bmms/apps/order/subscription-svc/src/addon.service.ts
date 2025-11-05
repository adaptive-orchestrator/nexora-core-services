import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { EventTopics } from '@bmms/event';
import * as crypto from 'crypto';

import { Addon } from './entities/addon.entity';
import { UserAddon } from './entities/user-addon.entity';

/**
 * Add-on Service
 * 
 * Manages purchasable add-ons for freemium and subscription users.
 * 
 * Features:
 * - List available add-ons
 * - Purchase add-ons
 * - Check user's active add-ons
 * - Handle add-on billing events
 */
@Injectable()
export class AddonService {
  private readonly logger = new Logger(AddonService.name);

  constructor(
    @InjectRepository(Addon)
    private readonly addonRepo: Repository<Addon>,

    @InjectRepository(UserAddon)
    private readonly userAddonRepo: Repository<UserAddon>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  // ============= ADDON MANAGEMENT =============

  /**
   * List all available add-ons
   */
  async listAddons(): Promise<Addon[]> {
    return this.addonRepo.find({
      where: { isActive: true },
      order: { price: 'ASC' },
    });
  }

  /**
   * Get add-on by key
   */
  async getAddonByKey(addonKey: string): Promise<Addon> {
    const addon = await this.addonRepo.findOne({
      where: { addonKey, isActive: true },
    });

    if (!addon) {
      throw new NotFoundException(`Add-on ${addonKey} not found`);
    }

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

    this.logger.log(`✅ Created add-on: ${addon.name} (${addon.addonKey})`);

    return addon;
  }

  // ============= USER ADD-ON PURCHASES =============

  /**
   * Purchase add-on(s) for a user
   * 
   * Emits ADDON_PURCHASED event for billing
   */
  async purchaseAddons(
    subscriptionId: number,
    customerId: number,
    addonKeys: string[],
  ): Promise<UserAddon[]> {
    this.logger.log(`💎 User ${customerId} purchasing ${addonKeys.length} add-ons`);

    const purchases: UserAddon[] = [];

    for (const addonKey of addonKeys) {
      // Check if addon exists
      const addon = await this.getAddonByKey(addonKey);

      // Check if user already has this addon
      const existing = await this.userAddonRepo.findOne({
        where: {
          subscriptionId,
          addonId: addon.id,
          status: 'active',
        },
      });

      if (existing) {
        this.logger.warn(`⚠️ User already has add-on: ${addonKey}`);
        continue;
      }

      // Calculate expiry date
      const purchasedAt = new Date();
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

      // Create purchase record
      const userAddon = new UserAddon();
      userAddon.subscriptionId = subscriptionId;
      userAddon.addonId = addon.id;
      userAddon.customerId = customerId;
      userAddon.price = addon.price;
      userAddon.status = 'active';
      userAddon.purchasedAt = purchasedAt;
      userAddon.expiresAt = expiresAt;
      userAddon.nextBillingDate = nextBillingDate;

      const savedAddon = await this.userAddonRepo.save(userAddon);

      purchases.push(savedAddon);

      this.logger.log(`✅ Purchased add-on: ${addon.name} for ${addon.price} VND`);
    }

    // Emit event for billing
    if (purchases.length > 0) {
      this.kafka.emit(EventTopics.ADDON_PURCHASED, {
        eventId: crypto.randomUUID(),
        eventType: EventTopics.ADDON_PURCHASED,
        timestamp: new Date(),
        source: 'subscription-svc',
        data: {
          subscriptionId,
          customerId,
          addons: purchases.map(p => ({
            userAddonId: p.id,
            addonId: p.addonId,
            price: p.price,
            purchasedAt: p.purchasedAt,
            nextBillingDate: p.nextBillingDate,
          })),
        },
      });

      this.logger.log(`📤 Emitted ADDON_PURCHASED event`);
    }

    return purchases;
  }

  /**
   * Get user's active add-ons
   */
  async getUserAddons(subscriptionId: number): Promise<UserAddon[]> {
    return this.userAddonRepo.find({
      where: {
        subscriptionId,
        status: 'active',
      },
      order: { purchasedAt: 'DESC' },
    });
  }

  /**
   * Cancel add-on
   */
  async cancelAddon(userAddonId: number): Promise<UserAddon> {
    const userAddon = await this.userAddonRepo.findOne({
      where: { id: userAddonId },
    });

    if (!userAddon) {
      throw new NotFoundException(`User add-on ${userAddonId} not found`);
    }

    userAddon.status = 'cancelled';
    await this.userAddonRepo.save(userAddon);

    this.logger.log(`❌ Cancelled add-on ${userAddonId}`);

    return userAddon;
  }

  /**
   * Renew recurring add-ons (called by cron job)
   */
  async renewRecurringAddons(): Promise<void> {
    const now = new Date();

    const expiredAddons = await this.userAddonRepo.find({
      where: {
        status: 'active',
      },
    });

    const toRenew = expiredAddons.filter(
      a => a.nextBillingDate && a.nextBillingDate <= now,
    );

    this.logger.log(`🔄 Renewing ${toRenew.length} add-ons`);

    for (const userAddon of toRenew) {
      // Emit billing event
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

      // Update next billing date
      if (userAddon.nextBillingDate) {
        const nextBillingDate = new Date(userAddon.nextBillingDate);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        userAddon.nextBillingDate = nextBillingDate;
        await this.userAddonRepo.save(userAddon);
      }
    }
  }
}
