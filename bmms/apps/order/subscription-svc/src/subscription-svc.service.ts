import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { SubscriptionHistory } from './entities/subscription-history.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { createBaseEvent } from '@bmms/event';
import { EventTopics } from '@bmms/event';
import { ProrationService } from './proration/proration.service';
import { debug } from '@bmms/common';

interface ICatalogueGrpcService {
  getPlanById(data: { id: string }): any;
}

interface ICustomerGrpcService {
  getCustomerById(data: { id: string }): any;
}

@Injectable()
export class subscriptionSvcService implements OnModuleInit {
  private catalogueService: ICatalogueGrpcService;
  private customerService: ICustomerGrpcService;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,

    @InjectRepository(SubscriptionHistory)
    private readonly historyRepo: Repository<SubscriptionHistory>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,

    @Inject('CATALOGUE_PACKAGE')
    private readonly catalogueClient: ClientGrpc,

    @Inject('CUSTOMER_PACKAGE')
    private readonly customerClient: ClientGrpc,

    private readonly prorationService: ProrationService,
  ) {}

  onModuleInit() {
    this.catalogueService = this.catalogueClient.getService<ICatalogueGrpcService>('CatalogueService');
    this.customerService = this.customerClient.getService<ICustomerGrpcService>('CustomerService');
    debug.log('[SubscriptionSvc] gRPC services initialized');
  }

  // ============= CRUD =============

  /**
   * Create a new subscription
   */
  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    debug.log('[SubscriptionSvc.create] START - dto:', JSON.stringify(dto));

    // 1. Validate customer exists (customerId is required, if not provided it's a validation error)
    if (!dto.customerId) {
      throw new BadRequestException('customerId is required');
    }
    
    try {
      await firstValueFrom(this.customerService.getCustomerById({ id: dto.customerId }));
    } catch (error) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    // 2. Get plan details
    let planResponse: any;
    try {
      planResponse = await firstValueFrom(this.catalogueService.getPlanById({ id: dto.planId }));
    } catch (error) {
      throw new NotFoundException(`Plan ${dto.planId} not found`);
    }

    const plan = planResponse.plan;
    debug.log('[SubscriptionSvc.create] Plan found:', plan.name);

    // 3. Check if customer already has active or pending subscription
    const existingSubscription = await this.subscriptionRepo.findOne({
      where: [
        { customerId: dto.customerId, status: SubscriptionStatus.ACTIVE },
        { customerId: dto.customerId, status: SubscriptionStatus.PENDING },
      ],
    });

    if (existingSubscription) {
      // If already has ACTIVE subscription, throw error
      if (existingSubscription.status === SubscriptionStatus.ACTIVE) {
        throw new BadRequestException(
          `Customer ${dto.customerId} already has an active subscription (ID: ${existingSubscription.id})`
        );
      }
      
      // If has PENDING subscription, return it so user can continue checkout
      if (existingSubscription.status === SubscriptionStatus.PENDING) {
        debug.log(`[SubscriptionSvc.create] Customer ${dto.customerId} already has pending subscription ${existingSubscription.id}, returning existing`);
        return existingSubscription;
      }
    }

    // 4. Calculate billing period
    const now = new Date();
    let currentPeriodStart = now;
    let currentPeriodEnd = new Date(now);
    
    if (plan.billingCycle === 'monthly') {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    } else if (plan.billingCycle === 'yearly') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    }

    // 5. Handle trial period
    let status = SubscriptionStatus.PENDING; // Start as pending, activate after payment
    let trialStart: Date | undefined;
    let trialEnd: Date | undefined;
    let isTrialUsed = false;

    if (dto.useTrial && plan.trialEnabled && plan.trialDays > 0) {
      status = SubscriptionStatus.TRIAL;
      trialStart = now;
      trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + plan.trialDays);
      isTrialUsed = true;
      debug.log(`[SubscriptionSvc.create] Trial enabled for ${plan.trialDays} days`);
    } else {
      debug.log(`[SubscriptionSvc.create] Subscription created as PENDING - awaiting payment`);
    }

    // 6. Create subscription
    const subscription = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        customerId: dto.customerId,
        ownerId: dto.ownerId || dto.customerId, // Set ownerId from DTO or use customerId
        planId: dto.planId,
        planName: plan.name,
        amount: plan.price,
        billingCycle: plan.billingCycle,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        isTrialUsed,
        trialStart,
        trialEnd,
        metadata: dto.metadata,
      })
    );

    // 7. Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'created',
        newStatus: status,
        details: `Subscription created for plan ${plan.name}`,
        metadata: { planId: dto.planId, useTrial: dto.useTrial },
      })
    );

    // 8. Emit event
    const baseEvent = createBaseEvent(EventTopics.SUBSCRIPTION_CREATED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_CREATED, {
      ...baseEvent,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEnd: subscription.trialEnd,
        amount: subscription.amount,
        billingCycle: subscription.billingCycle,
        createdAt: subscription.createdAt,
      },
    });

    if (status === SubscriptionStatus.TRIAL) {
      const trialEvent = createBaseEvent(EventTopics.SUBSCRIPTION_TRIAL_STARTED, 'subscription-svc');
      this.kafka.emit(EventTopics.SUBSCRIPTION_TRIAL_STARTED, {
        ...trialEvent,
        data: {
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          trialStart: subscription.trialStart,
          trialEnd: subscription.trialEnd,
          trialDays: plan.trialDays,
        },
      });
    }

    debug.log('[SubscriptionSvc.create] Subscription created:', subscription.id);
    return subscription;
  }

  /**
   * Get all subscriptions for a customer
   */
  async listByCustomer(customerId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all subscriptions owned by a user
   */
  async listByOwner(ownerId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get subscription by ID
   */
  async findById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['history'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    return subscription;
  }

  /**
   * Activate a pending subscription (called after payment success)
   */
  async activateSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.findById(subscriptionId);

    if (subscription.status !== SubscriptionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot activate subscription with status: ${subscription.status}. Must be PENDING.`
      );
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    const updated = await this.subscriptionRepo.save(subscription);

    // Emit activation event
    const event = createBaseEvent('subscription.activated', 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_ACTIVATED, {
      ...event,
      data: {
        subscriptionId: updated.id,
        customerId: updated.customerId,
        planId: updated.planId,
        activatedAt: new Date(),
      },
    });

    debug.log(`[SubscriptionSvc] Subscription ${subscriptionId} activated`);
    return updated;
  }

  /**
   * Get all subscriptions (for admin/testing)
   */

  async findAll(): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check and process trial subscriptions that have expired
   * Called by scheduler or manual trigger
   */
  async checkAndProcessTrialExpiry(): Promise<{
    processed: number;
    converted: number;
    failed: number;
  }> {
    debug.log('[SubscriptionSvc] Checking for expired trial subscriptions...');

    const now = new Date();
    const expiredTrials = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.TRIAL,
        trialEnd: LessThanOrEqual(now),
      },
    });

    debug.log(`[SubscriptionSvc] Found ${expiredTrials.length} expired trial subscriptions`);

    let converted = 0;
    let failed = 0;

    for (const subscription of expiredTrials) {
      try {
        debug.log(`[SubscriptionSvc] Processing subscription ${subscription.id} (trial ended: ${subscription.trialEnd})`);

        // Update status to active
        subscription.status = SubscriptionStatus.ACTIVE;
        await this.subscriptionRepo.save(subscription);

        // Log history
        await this.historyRepo.save(
          this.historyRepo.create({
            subscriptionId: subscription.id,
            action: 'status_changed',
            previousStatus: SubscriptionStatus.TRIAL,
            newStatus: SubscriptionStatus.ACTIVE,
            details: `Trial period ended, converted to active`,
            metadata: { trialEnd: subscription.trialEnd },
          })
        );

        // Emit event for billing service to create first invoice
        const baseEvent = createBaseEvent(EventTopics.SUBSCRIPTION_TRIAL_ENDED, 'subscription-svc');
        this.kafka.emit(EventTopics.SUBSCRIPTION_TRIAL_ENDED, {
          ...baseEvent,
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          planName: subscription.planName,
          amount: subscription.amount,
          billingCycle: subscription.billingCycle,
          convertedToActive: true,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
        });
        debug.log(`[SubscriptionSvc] Subscription ${subscription.id} converted to active`);

        converted++;
      } catch (error) {
        console.error(`[SubscriptionSvc] Failed to process subscription ${subscription.id}:`, error);
        failed++;
      }
    }

    debug.log(`[SubscriptionSvc] Trial expiry check complete. Converted: ${converted}, Failed: ${failed}`);

    return {
      processed: expiredTrials.length,
      converted,
      failed,
    };
  }

  /**
   * Cancel a subscription
   */
  async cancel(id: string, dto: CancelSubscriptionDto): Promise<Subscription> {
    const subscription = await this.findById(id);

    if (subscription.isCancelled()) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    const previousStatus = subscription.status;

    if (dto.cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancellationReason = dto.reason;
    } else {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = dto.reason;
    }

    await this.subscriptionRepo.save(subscription);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'cancelled',
        previousStatus,
        newStatus: subscription.status,
        details: dto.reason || 'Subscription cancelled by customer',
        metadata: { cancelAtPeriodEnd: dto.cancelAtPeriodEnd },
      })
    );

    // Emit event
    const baseEvent = createBaseEvent(EventTopics.SUBSCRIPTION_CANCELLED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_CANCELLED, {
      ...baseEvent,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        planId: subscription.planId,
        cancelledAt: subscription.cancelledAt || new Date(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        reason: dto.reason,
      },
    });

    debug.log(`[SubscriptionSvc.cancel] Subscription ${id} cancelled`);
    return subscription;
  }

  /**
   * Renew a subscription (called by scheduler or payment success event)
   */

  async renew(id: string): Promise<Subscription> {
    const subscription = await this.findById(id);

    if (!subscription.shouldBill()) {
      throw new BadRequestException('Subscription cannot be renewed');
    }

    const previousPeriodEnd = subscription.currentPeriodEnd;
    subscription.currentPeriodStart = new Date(previousPeriodEnd);
    subscription.currentPeriodEnd = new Date(previousPeriodEnd);

    if (subscription.billingCycle === 'monthly') {
      subscription.currentPeriodEnd.setMonth(subscription.currentPeriodEnd.getMonth() + 1);
    } else if (subscription.billingCycle === 'yearly') {
      subscription.currentPeriodEnd.setFullYear(subscription.currentPeriodEnd.getFullYear() + 1);
    }

    // Convert from trial to active if needed
    if (subscription.isOnTrial()) {
      subscription.status = SubscriptionStatus.ACTIVE;
    }

    await this.subscriptionRepo.save(subscription);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'renewed',
        newStatus: subscription.status,
        details: `Subscription renewed until ${subscription.currentPeriodEnd.toISOString()}`,
      })
    );

    // Emit event
    const baseEvent = createBaseEvent(EventTopics.SUBSCRIPTION_RENEWED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_RENEWED, {
      ...baseEvent,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        planId: subscription.planId,
        previousPeriodEnd,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        amount: subscription.amount,
        renewedAt: new Date(),
      },
    });

    debug.log(`[SubscriptionSvc.renew] Subscription ${id} renewed`);
    return subscription;
  }

  /**
   * Change plan (upgrade/downgrade)
   */

  async changePlan(id: string, dto: ChangePlanDto): Promise<Subscription> {
    const subscription = await this.findById(id);

    if (!subscription.isActive()) {
      throw new BadRequestException('Can only change plan for active subscriptions');
    }

    // Get new plan details
    let planResponse: any;
    try {
      planResponse = await firstValueFrom(this.catalogueService.getPlanById({ id: dto.newPlanId }));
    } catch (error) {
      throw new NotFoundException(`Plan ${dto.newPlanId} not found`);
    }

    const newPlan = planResponse.plan;
    const previousPlanId = subscription.planId;
    const previousAmount = subscription.amount;

    // Calculate proration
    let prorationResult;
    if (dto.immediate) {
      prorationResult = this.prorationService.calculateImmediateChangeProration(
        previousAmount,
        newPlan.price,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        new Date(),
        newPlan.billingCycle
      );
    } else {
      prorationResult = this.prorationService.calculateProration(
        previousAmount,
        newPlan.price,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
        new Date(),
        newPlan.billingCycle
      );
    }

    const changeType = this.prorationService.getChangeType(previousAmount, newPlan.price);
    const prorationDescription = this.prorationService.generateProrationDescription(prorationResult, changeType);

    debug.log(`[Proration] ${changeType.toUpperCase()}:`, {
      oldAmount: previousAmount,
      newAmount: newPlan.price,
      creditAmount: prorationResult.creditAmount,
      chargeAmount: prorationResult.chargeAmount,
      netAmount: prorationResult.netAmount,
      remainingDays: prorationResult.remainingDays,
    });

    // Update subscription
    subscription.planId = dto.newPlanId;
    subscription.planName = newPlan.name;
    subscription.amount = newPlan.price;
    subscription.billingCycle = newPlan.billingCycle;

    if (dto.immediate) {
      // Reset billing period for immediate change
      subscription.currentPeriodStart = new Date();
      subscription.currentPeriodEnd = prorationResult.nextBillingDate;
    }

    // Store proration details in metadata
    subscription.metadata = {
      ...subscription.metadata,
      lastProration: {
        date: new Date(),
        changeType,
        oldAmount: previousAmount,
        newAmount: newPlan.price,
        creditAmount: prorationResult.creditAmount,
        netAmount: prorationResult.netAmount,
        description: prorationDescription,
      },
    };

    await this.subscriptionRepo.save(subscription);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'plan_changed',
        previousPlanId,
        newPlanId: dto.newPlanId,
        details: `Plan ${changeType}d from ${previousPlanId} to ${newPlan.name}. ${prorationDescription}`,
        metadata: { 
          immediate: dto.immediate, 
          changeType,
          proration: prorationResult,
        },
      })
    );

    // Emit plan change event
    const baseEvent = createBaseEvent(EventTopics.SUBSCRIPTION_PLAN_CHANGED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_PLAN_CHANGED, {
      ...baseEvent,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        previousPlanId,
        newPlanId: dto.newPlanId,
        previousAmount,
        newAmount: newPlan.price,
        changeType,
        effectiveDate: dto.immediate ? new Date() : subscription.currentPeriodEnd,
        proration: prorationResult,
      },
    });

    // If there's a net amount to charge/credit, emit billing event
    if (this.prorationService.shouldApplyProration(prorationResult.netAmount)) {
      if (prorationResult.netAmount > 0) {
        // Customer owes money (upgrade)
        const invoiceEvent = createBaseEvent(EventTopics.INVOICE_CREATED, 'subscription-svc');
        this.kafka.emit(EventTopics.INVOICE_CREATED, {
          ...invoiceEvent,
          data: {
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            amount: prorationResult.netAmount,
            invoiceType: 'proration_charge',
            description: `Proration charge for plan upgrade: ${prorationDescription}`,
            dueDate: new Date(),
            metadata: {
              changeType: 'upgrade',
              proration: prorationResult,
            },
          },
        });
        debug.log(`[Proration] Invoice created for upgrade: $${prorationResult.netAmount}`);
      } else if (prorationResult.netAmount < 0) {
        // Customer gets credit (downgrade)
        const creditEvent = createBaseEvent(EventTopics.BILLING_CREDIT_APPLIED, 'subscription-svc');
        this.kafka.emit(EventTopics.BILLING_CREDIT_APPLIED, {
          ...creditEvent,
          data: {
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            amount: Math.abs(prorationResult.netAmount),
            reason: `Proration credit for plan downgrade: ${prorationDescription}`,
            metadata: {
              changeType: 'downgrade',
              proration: prorationResult,
            },
          },
        });
        debug.log(`[Proration] Credit issued for downgrade: $${Math.abs(prorationResult.netAmount)}`);
      }
    }

    debug.log(`[SubscriptionSvc.changePlan] Subscription ${id} plan changed to ${newPlan.name}`);
    return subscription;
  }

  /**
   * Update subscription status (used by event listeners)
   */
  async updateStatus(
    id: string,
    newStatus: SubscriptionStatus,
    reason?: string
  ): Promise<Subscription> {
    const subscription = await this.findById(id);
    const previousStatus = subscription.status;

    subscription.status = newStatus;
    await this.subscriptionRepo.save(subscription);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'status_changed',
        previousStatus,
        newStatus,
        details: reason || `Status changed from ${previousStatus} to ${newStatus}`,
      })
    );

    // Emit event
    const baseEvent = createBaseEvent(EventTopics.SUBSCRIPTION_UPDATED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_UPDATED, {
      ...baseEvent,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        changes: { status: { from: previousStatus, to: newStatus } },
        previousStatus,
        newStatus,
      },
    });

    return subscription;
  }

  /**
   * Get subscriptions that need renewal (for scheduler)
   */
  async findSubscriptionsToRenew(): Promise<Subscription[]> {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    return this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: LessThanOrEqual(threeDaysFromNow),
      },
    });
  }

  /**
   * Convert trial to active (called when payment succeeds after trial)
   */
  async convertTrialToActive(id: string): Promise<Subscription> {
    const subscription = await this.findById(id);

    if (!subscription.isOnTrial()) {
      throw new BadRequestException('Subscription is not on trial');
    }

    const previousStatus = subscription.status;
    subscription.status = SubscriptionStatus.ACTIVE;

    await this.subscriptionRepo.save(subscription);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'trial_ended',
        previousStatus,
        newStatus: SubscriptionStatus.ACTIVE,
        details: 'Trial period ended, converted to active subscription',
      })
    );

    // Emit event
    const baseEvent = createBaseEvent(EventTopics.SUBSCRIPTION_TRIAL_ENDED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_TRIAL_ENDED, {
      ...baseEvent,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        planId: subscription.planId,
        trialEnd: subscription.trialEnd,
        convertedToActive: true,
      },
    });

    return subscription;
  }

  async getStats(): Promise<any> {
    const allSubscriptions = await this.subscriptionRepo.find();

    const activeCount = allSubscriptions.filter(s => s.status === SubscriptionStatus.ACTIVE).length;
    const cancelledCount = allSubscriptions.filter(s => s.status === SubscriptionStatus.CANCELLED).length;
    const expiredCount = allSubscriptions.filter(s => s.status === SubscriptionStatus.EXPIRED).length;

    // Calculate monthly revenue (sum of all active subscriptions)
    const monthlyRevenue = allSubscriptions
      .filter(s => s.status === SubscriptionStatus.ACTIVE)
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Calculate total revenue (all time)
    const totalRevenue = allSubscriptions
      .reduce((sum, s) => sum + Number(s.amount), 0);

    const avgSubscriptionValue = activeCount > 0 ? monthlyRevenue / activeCount : 0;

    return {
      activeCount,
      cancelledCount,
      expiredCount,
      monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgSubscriptionValue: Number(avgSubscriptionValue.toFixed(2)),
    };
  }
}

