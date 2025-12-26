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
  getCustomerByUserId(data: { userId: string }): any;
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

    // Validate that customerId (userId) is provided
    if (!dto.customerId) {
      throw new BadRequestException('customerId (userId) is required');
    }

    // 1. Get customer by userId (since JWT provides userId, not customerId)
    let customer: any;
    try {
      const customerResponse: any = await firstValueFrom(
        this.customerService.getCustomerByUserId({ userId: dto.customerId })
      );
      customer = customerResponse.customer;
      debug.log('[SubscriptionSvc.create] Customer found:', customer.id);
    } catch (error) {
      throw new NotFoundException(`Customer with userId ${dto.customerId} not found`);
    }
    
    // Use the actual customer ID for subscription
    const actualCustomerId = customer.id;

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
        { customerId: actualCustomerId, status: SubscriptionStatus.ACTIVE },
        { customerId: actualCustomerId, status: SubscriptionStatus.PENDING },
      ],
    });

    if (existingSubscription) {
      // If already has ACTIVE subscription, throw error
      if (existingSubscription.status === SubscriptionStatus.ACTIVE) {
        throw new BadRequestException(
          `Customer already has an active subscription (ID: ${existingSubscription.id})`
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
        customerId: actualCustomerId,  // Use actual customer ID from customer service
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
   * @param customerIdOrUserId - Can be either customer ID or user ID (will lookup customer if needed)
   */
  async listByCustomer(customerIdOrUserId: string): Promise<Subscription[]> {
    // Try to find customer by userId first (since JWT provides userId)
    let actualCustomerId = customerIdOrUserId;
    
    try {
      const customerResponse: any = await firstValueFrom(
        this.customerService.getCustomerByUserId({ userId: customerIdOrUserId })
      );
      actualCustomerId = customerResponse.customer.id;
      debug.log(`[SubscriptionSvc.listByCustomer] Found customer ${actualCustomerId} for userId ${customerIdOrUserId}`);
    } catch (error) {
      // If not found by userId, assume it's already a customer ID
      debug.log(`[SubscriptionSvc.listByCustomer] Using ID as customerId: ${customerIdOrUserId}`);
    }
    
    return this.subscriptionRepo.find({
      where: { customerId: actualCustomerId },
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

  // =================== STRIPE INTEGRATION METHODS ===================

  /**
   * Check subscription status for a customer
   * Used by other services (e.g., project-svc) to verify access
   */
  async checkSubscriptionStatus(customerIdOrUserId: string): Promise<{
    isActive: boolean;
    status: string;
    planId: string;
    planName: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId?: string;
  }> {
    debug.log(`[SubscriptionSvc] Checking subscription status for: ${customerIdOrUserId}`);
    
    // Try to get actual customer ID from userId
    let actualCustomerId = customerIdOrUserId;
    try {
      const customerResponse: any = await firstValueFrom(
        this.customerService.getCustomerByUserId({ userId: customerIdOrUserId })
      );
      if (customerResponse?.customer?.id) {
        actualCustomerId = customerResponse.customer.id;
        debug.log(`[SubscriptionSvc] Resolved userId ${customerIdOrUserId} to customerId ${actualCustomerId}`);
      }
    } catch (error) {
      debug.log(`[SubscriptionSvc] Could not resolve userId, using as customerId: ${error}`);
    }
    
    const subscription = await this.subscriptionRepo.findOne({
      where: { 
        customerId: actualCustomerId,
        status: SubscriptionStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      // Check for trial subscription
      const trialSubscription = await this.subscriptionRepo.findOne({
        where: { 
          customerId: actualCustomerId,
          status: SubscriptionStatus.TRIAL,
        },
        order: { createdAt: 'DESC' },
      });

      if (trialSubscription) {
        return {
          isActive: true,
          status: 'trial',
          planId: trialSubscription.planId,
          planName: trialSubscription.planName || '',
          currentPeriodEnd: trialSubscription.trialEnd?.toISOString() || '',
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: trialSubscription.metadata?.stripeSubscriptionId,
        };
      }

      return {
        isActive: false,
        status: 'expired',
        planId: '',
        planName: '',
        currentPeriodEnd: '',
        cancelAtPeriodEnd: false,
      };
    }

    return {
      isActive: subscription.isActive() || subscription.isOnTrial(),
      status: subscription.status,
      planId: subscription.planId,
      planName: subscription.planName || '',
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || '',
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      stripeSubscriptionId: subscription.metadata?.stripeSubscriptionId,
    };
  }

  /**
   * Get plan limits for quota checking
   * Returns resource limits based on the customer's active plan
   */
  async getPlanLimits(customerIdOrUserId: string, planId?: string): Promise<{
    isActive: boolean;
    planId: string;
    planName: string;
    maxProjects: number;
    maxTeamMembers: number;
    maxStorageGb: number;
    maxApiCalls: number;
    features: string[];
    currentPeriodEnd: string;
  }> {
    debug.log(`[SubscriptionSvc] Getting plan limits for: ${customerIdOrUserId}`);

    // Try to get actual customer ID from userId
    let actualCustomerId = customerIdOrUserId;
    try {
      const customerResponse: any = await firstValueFrom(
        this.customerService.getCustomerByUserId({ userId: customerIdOrUserId })
      );
      if (customerResponse?.customer?.id) {
        actualCustomerId = customerResponse.customer.id;
        debug.log(`[SubscriptionSvc] Resolved userId ${customerIdOrUserId} to customerId ${actualCustomerId}`);
      }
    } catch (error) {
      debug.log(`[SubscriptionSvc] Could not resolve userId, using as customerId: ${error}`);
    }

    // Get active subscription
    const subscription = await this.subscriptionRepo.findOne({
      where: [
        { customerId: actualCustomerId, status: SubscriptionStatus.ACTIVE },
        { customerId: actualCustomerId, status: SubscriptionStatus.TRIAL },
      ],
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      // Return default free tier limits
      return {
        isActive: false,
        planId: 'free',
        planName: 'Free',
        maxProjects: 1,
        maxTeamMembers: 1,
        maxStorageGb: 1,
        maxApiCalls: 1000,
        features: [],
        currentPeriodEnd: '',
      };
    }

    // Get plan details from catalogue service
    try {
      const planResponse: any = await firstValueFrom(
        this.catalogueService.getPlanById({ id: planId || subscription.planId })
      );
      const plan = planResponse.plan;

      // Parse features from plan
      const features = plan.features ? 
        (typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features) : [];

      // Get limits from plan metadata or use defaults based on plan tier
      const limits = this.getPlanLimitsByTier(plan.name || subscription.planName || 'free');

      return {
        isActive: true,
        planId: subscription.planId,
        planName: subscription.planName || '',
        maxProjects: limits.maxProjects,
        maxTeamMembers: limits.maxTeamMembers,
        maxStorageGb: limits.maxStorageGb,
        maxApiCalls: limits.maxApiCalls,
        features: Array.isArray(features) ? features : [],
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || '',
      };
    } catch (error) {
      debug.log(`[SubscriptionSvc] Error getting plan details: ${error}`);
      // Return based on subscription data
      const limits = this.getPlanLimitsByTier(subscription.planName || 'free');
      return {
        isActive: true,
        planId: subscription.planId,
        planName: subscription.planName || '',
        ...limits,
        features: [],
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || '',
      };
    }
  }

  /**
   * Get limits based on plan tier name
   */
  private getPlanLimitsByTier(planName: string): {
    maxProjects: number;
    maxTeamMembers: number;
    maxStorageGb: number;
    maxApiCalls: number;
  } {
    const name = planName.toLowerCase();
    
    if (name.includes('enterprise') || name.includes('unlimited')) {
      return { maxProjects: 1000, maxTeamMembers: 500, maxStorageGb: 1000, maxApiCalls: 10000000 };
    }
    if (name.includes('professional') || name.includes('pro')) {
      return { maxProjects: 50, maxTeamMembers: 50, maxStorageGb: 100, maxApiCalls: 500000 };
    }
    if (name.includes('premium') || name.includes('business')) {
      return { maxProjects: 25, maxTeamMembers: 25, maxStorageGb: 50, maxApiCalls: 100000 };
    }
    if (name.includes('starter') || name.includes('basic')) {
      return { maxProjects: 5, maxTeamMembers: 5, maxStorageGb: 10, maxApiCalls: 10000 };
    }
    
    // Default (free tier)
    return { maxProjects: 1, maxTeamMembers: 1, maxStorageGb: 1, maxApiCalls: 1000 };
  }

  /**
   * Get active subscription for a customer
   */
  async getActiveSubscription(customerId: string): Promise<Subscription | null> {
    const subscription = await this.subscriptionRepo.findOne({
      where: [
        { customerId, status: SubscriptionStatus.ACTIVE },
        { customerId, status: SubscriptionStatus.TRIAL },
      ],
      order: { createdAt: 'DESC' },
    });

    return subscription;
  }

  // =================== WEBHOOK EVENT HANDLERS ===================
  // These are called from payment-svc via gRPC when Stripe webhooks are received

  /**
   * Handle payment succeeded event from Stripe webhook
   * Activates pending subscriptions
   */
  async handlePaymentSucceeded(data: {
    paymentId: string;
    customerId: string;
    orderId?: string;
    amount: number;
    stripePaymentIntentId?: string;
    subscriptionId?: string;
  }): Promise<{ success: boolean; message: string }> {
    debug.log(`[SubscriptionSvc] Handling payment succeeded for customer: ${data.customerId}`);

    try {
      // Find pending subscription for this customer
      const subscription = data.subscriptionId 
        ? await this.subscriptionRepo.findOne({ where: { id: data.subscriptionId } })
        : await this.subscriptionRepo.findOne({
            where: { customerId: data.customerId, status: SubscriptionStatus.PENDING },
            order: { createdAt: 'DESC' },
          });

      if (!subscription) {
        debug.log(`[SubscriptionSvc] No pending subscription found for customer ${data.customerId}`);
        return { success: true, message: 'No pending subscription to activate' };
      }

      // Activate the subscription
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.metadata = {
        ...subscription.metadata,
        lastPaymentId: data.paymentId,
        lastPaymentDate: new Date().toISOString(),
        stripePaymentIntentId: data.stripePaymentIntentId,
      };

      await this.subscriptionRepo.save(subscription);

      // Log history
      await this.historyRepo.save(
        this.historyRepo.create({
          subscriptionId: subscription.id,
          action: 'activated',
          previousStatus: SubscriptionStatus.PENDING,
          newStatus: SubscriptionStatus.ACTIVE,
          details: `Activated after payment ${data.paymentId}`,
          metadata: { paymentId: data.paymentId },
        })
      );

      // Emit activation event
      const event = createBaseEvent(EventTopics.SUBSCRIPTION_ACTIVATED, 'subscription-svc');
      this.kafka.emit(EventTopics.SUBSCRIPTION_ACTIVATED, {
        ...event,
        data: {
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          planId: subscription.planId,
          activatedAt: new Date(),
          paymentId: data.paymentId,
        },
      });

      debug.log(`[SubscriptionSvc] Subscription ${subscription.id} activated after payment`);
      return { success: true, message: `Subscription ${subscription.id} activated` };
    } catch (error) {
      console.error(`[SubscriptionSvc] Error handling payment succeeded:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Handle Stripe subscription updated event
   * Updates local subscription based on Stripe data
   */
  async handleStripeSubscriptionUpdated(data: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    status: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string;
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; message: string }> {
    debug.log(`[SubscriptionSvc] Handling Stripe subscription updated: ${data.stripeSubscriptionId}`);

    try {
      // Find subscription by Stripe subscription ID in metadata
      const subscriptions = await this.subscriptionRepo.find();
      const subscription = subscriptions.find(
        s => s.metadata?.stripeSubscriptionId === data.stripeSubscriptionId
      );

      if (!subscription) {
        // Try to find by customer ID from metadata
        const customerId = data.metadata?.customer_id;
        if (customerId) {
          const subByCustomer = await this.subscriptionRepo.findOne({
            where: { customerId },
            order: { createdAt: 'DESC' },
          });
          if (subByCustomer) {
            return this.updateSubscriptionFromStripe(subByCustomer, data);
          }
        }
        debug.log(`[SubscriptionSvc] No subscription found for Stripe ID: ${data.stripeSubscriptionId}`);
        return { success: true, message: 'Subscription not found in local DB' };
      }

      return this.updateSubscriptionFromStripe(subscription, data);
    } catch (error) {
      console.error(`[SubscriptionSvc] Error handling subscription updated:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async updateSubscriptionFromStripe(
    subscription: Subscription,
    data: {
      status: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd: boolean;
      canceledAt?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const previousStatus = subscription.status;

    // Map Stripe status to our status
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      canceled: SubscriptionStatus.CANCELLED,
      unpaid: SubscriptionStatus.PAST_DUE,
      past_due: SubscriptionStatus.PAST_DUE,
      trialing: SubscriptionStatus.TRIAL,
    };

    if (statusMap[data.status]) {
      subscription.status = statusMap[data.status];
    }

    if (data.currentPeriodEnd) {
      subscription.currentPeriodEnd = new Date(data.currentPeriodEnd);
    }

    subscription.cancelAtPeriodEnd = data.cancelAtPeriodEnd;

    if (data.canceledAt) {
      subscription.cancelledAt = new Date(data.canceledAt);
    }

    await this.subscriptionRepo.save(subscription);

    // Log history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'stripe_sync',
        previousStatus,
        newStatus: subscription.status,
        details: `Synced from Stripe: status=${data.status}`,
      })
    );

    debug.log(`[SubscriptionSvc] Subscription ${subscription.id} synced from Stripe`);
    return { success: true, message: `Subscription ${subscription.id} updated from Stripe` };
  }

  /**
   * Handle Stripe subscription deleted event
   * Cancels local subscription
   */
  async handleStripeSubscriptionDeleted(data: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    canceledAt?: string;
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; message: string }> {
    debug.log(`[SubscriptionSvc] Handling Stripe subscription deleted: ${data.stripeSubscriptionId}`);

    try {
      const subscriptions = await this.subscriptionRepo.find();
      const subscription = subscriptions.find(
        s => s.metadata?.stripeSubscriptionId === data.stripeSubscriptionId
      );

      if (!subscription) {
        return { success: true, message: 'Subscription not found in local DB' };
      }

      const previousStatus = subscription.status;
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = data.canceledAt ? new Date(data.canceledAt) : new Date();

      await this.subscriptionRepo.save(subscription);

      // Log history
      await this.historyRepo.save(
        this.historyRepo.create({
          subscriptionId: subscription.id,
          action: 'cancelled',
          previousStatus,
          newStatus: SubscriptionStatus.CANCELLED,
          details: 'Cancelled via Stripe webhook',
        })
      );

      // Emit event
      const event = createBaseEvent(EventTopics.SUBSCRIPTION_CANCELLED, 'subscription-svc');
      this.kafka.emit(EventTopics.SUBSCRIPTION_CANCELLED, {
        ...event,
        data: {
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          cancelledAt: subscription.cancelledAt,
          reason: 'Stripe subscription deleted',
        },
      });

      debug.log(`[SubscriptionSvc] Subscription ${subscription.id} cancelled from Stripe webhook`);
      return { success: true, message: `Subscription ${subscription.id} cancelled` };
    } catch (error) {
      console.error(`[SubscriptionSvc] Error handling subscription deleted:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Handle Stripe invoice paid event
   * Extends subscription period
   */
  async handleInvoicePaid(data: {
    stripeInvoiceId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    amountPaid: number;
    currency: string;
    paidAt: string;
  }): Promise<{ success: boolean; message: string }> {
    debug.log(`[SubscriptionSvc] Handling invoice paid: ${data.stripeInvoiceId}`);

    try {
      const subscriptions = await this.subscriptionRepo.find();
      const subscription = subscriptions.find(
        s => s.metadata?.stripeSubscriptionId === data.stripeSubscriptionId
      );

      if (!subscription) {
        return { success: true, message: 'Subscription not found in local DB' };
      }

      // Extend the subscription period
      const previousPeriodEnd = subscription.currentPeriodEnd;
      subscription.currentPeriodStart = subscription.currentPeriodEnd || new Date();
      subscription.currentPeriodEnd = new Date(subscription.currentPeriodStart);

      if (subscription.billingCycle === 'monthly') {
        subscription.currentPeriodEnd.setMonth(subscription.currentPeriodEnd.getMonth() + 1);
      } else if (subscription.billingCycle === 'yearly') {
        subscription.currentPeriodEnd.setFullYear(subscription.currentPeriodEnd.getFullYear() + 1);
      }

      // Ensure subscription is active
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        subscription.status = SubscriptionStatus.ACTIVE;
      }

      subscription.metadata = {
        ...subscription.metadata,
        lastInvoiceId: data.stripeInvoiceId,
        lastPaymentDate: data.paidAt,
        lastPaymentAmount: data.amountPaid,
      };

      await this.subscriptionRepo.save(subscription);

      // Log history
      await this.historyRepo.save(
        this.historyRepo.create({
          subscriptionId: subscription.id,
          action: 'renewed',
          newStatus: subscription.status,
          details: `Renewed after invoice ${data.stripeInvoiceId} paid`,
          metadata: { 
            invoiceId: data.stripeInvoiceId,
            amount: data.amountPaid,
            previousPeriodEnd: previousPeriodEnd?.toISOString(),
            newPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          },
        })
      );

      // Emit renewal event
      const event = createBaseEvent(EventTopics.SUBSCRIPTION_RENEWED, 'subscription-svc');
      this.kafka.emit(EventTopics.SUBSCRIPTION_RENEWED, {
        ...event,
        data: {
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          currentPeriodEnd: subscription.currentPeriodEnd,
          invoiceId: data.stripeInvoiceId,
          amount: data.amountPaid,
        },
      });

      debug.log(`[SubscriptionSvc] Subscription ${subscription.id} renewed after invoice payment`);
      return { success: true, message: `Subscription ${subscription.id} renewed` };
    } catch (error) {
      console.error(`[SubscriptionSvc] Error handling invoice paid:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ============= STRIPE INTEGRATION HELPER METHODS =============

  /**
   * Find a pending subscription for a customer
   */
  async findPendingByCustomer(customerId: string): Promise<Subscription | null> {
    debug.log(`[SubscriptionSvc.findPendingByCustomer] Searching for pending subscription for customer ${customerId}`);
    
    return this.subscriptionRepo.findOne({
      where: { 
        customerId, 
        status: SubscriptionStatus.PENDING 
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Link a Stripe subscription ID to a local subscription
   */
  async linkStripeSubscription(customerId: string, stripeSubscriptionId: string): Promise<void> {
    debug.log(`[SubscriptionSvc.linkStripeSubscription] Linking Stripe subscription ${stripeSubscriptionId} to customer ${customerId}`);
    
    // Find the most recent subscription for this customer
    const subscription = await this.subscriptionRepo.findOne({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      debug.log(`[SubscriptionSvc.linkStripeSubscription] No subscription found for customer ${customerId}`);
      return;
    }

    // Update with Stripe subscription ID
    subscription.stripeSubscriptionId = stripeSubscriptionId;
    subscription.metadata = {
      ...subscription.metadata,
      stripeLinkedAt: new Date().toISOString(),
    };

    await this.subscriptionRepo.save(subscription);
    debug.log(`[SubscriptionSvc.linkStripeSubscription] Linked Stripe subscription to local subscription ${subscription.id}`);
  }

  /**
   * Update subscription by Stripe subscription ID
   */
  async updateByStripeId(
    stripeSubscriptionId: string, 
    updates: { 
      status?: SubscriptionStatus; 
      currentPeriodEnd?: Date; 
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<void> {
    debug.log(`[SubscriptionSvc.updateByStripeId] Updating subscription with Stripe ID ${stripeSubscriptionId}`);
    
    const subscription = await this.subscriptionRepo.findOne({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      debug.log(`[SubscriptionSvc.updateByStripeId] No subscription found with Stripe ID ${stripeSubscriptionId}`);
      return;
    }

    const previousStatus = subscription.status;

    if (updates.status !== undefined) {
      subscription.status = updates.status;
    }
    if (updates.currentPeriodEnd !== undefined) {
      subscription.currentPeriodEnd = updates.currentPeriodEnd;
    }
    if (updates.cancelAtPeriodEnd !== undefined) {
      subscription.cancelAtPeriodEnd = updates.cancelAtPeriodEnd;
    }

    await this.subscriptionRepo.save(subscription);

    // Log history if status changed
    if (previousStatus !== subscription.status) {
      await this.historyRepo.save(
        this.historyRepo.create({
          subscriptionId: subscription.id,
          action: 'status_changed',
          previousStatus,
          newStatus: subscription.status,
          details: `Status updated via Stripe webhook`,
          metadata: { stripeSubscriptionId },
        })
      );
    }

    debug.log(`[SubscriptionSvc.updateByStripeId] Updated subscription ${subscription.id}`);
  }

  /**
   * Cancel subscription by Stripe subscription ID
   */
  async cancelByStripeId(stripeSubscriptionId: string, reason?: string): Promise<void> {
    debug.log(`[SubscriptionSvc.cancelByStripeId] Cancelling subscription with Stripe ID ${stripeSubscriptionId}`);
    
    const subscription = await this.subscriptionRepo.findOne({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      debug.log(`[SubscriptionSvc.cancelByStripeId] No subscription found with Stripe ID ${stripeSubscriptionId}`);
      return;
    }

    const previousStatus = subscription.status;
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason || 'Cancelled via Stripe';

    await this.subscriptionRepo.save(subscription);

    // Log history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'cancelled',
        previousStatus,
        newStatus: SubscriptionStatus.CANCELLED,
        details: reason || 'Cancelled via Stripe webhook',
        metadata: { stripeSubscriptionId },
      })
    );

    // Emit cancellation event
    const event = createBaseEvent(EventTopics.SUBSCRIPTION_CANCELLED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_CANCELLED, {
      ...event,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        reason: reason || 'Cancelled via Stripe',
        cancelledAt: subscription.cancelledAt,
      },
    });

    debug.log(`[SubscriptionSvc.cancelByStripeId] Cancelled subscription ${subscription.id}`);
  }

  /**
   * Extend subscription period by Stripe subscription ID (after invoice payment)
   */
  async extendPeriodByStripeId(stripeSubscriptionId: string): Promise<void> {
    debug.log(`[SubscriptionSvc.extendPeriodByStripeId] Extending period for Stripe ID ${stripeSubscriptionId}`);
    
    const subscription = await this.subscriptionRepo.findOne({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      debug.log(`[SubscriptionSvc.extendPeriodByStripeId] No subscription found with Stripe ID ${stripeSubscriptionId}`);
      return;
    }

    const previousPeriodEnd = subscription.currentPeriodEnd;
    
    // Set new period start from current period end (or now if not set)
    subscription.currentPeriodStart = subscription.currentPeriodEnd || new Date();
    subscription.currentPeriodEnd = new Date(subscription.currentPeriodStart);

    // Extend based on billing cycle
    if (subscription.billingCycle === 'monthly') {
      subscription.currentPeriodEnd.setMonth(subscription.currentPeriodEnd.getMonth() + 1);
    } else if (subscription.billingCycle === 'yearly') {
      subscription.currentPeriodEnd.setFullYear(subscription.currentPeriodEnd.getFullYear() + 1);
    }

    // Ensure subscription is active
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      subscription.status = SubscriptionStatus.ACTIVE;
    }

    await this.subscriptionRepo.save(subscription);

    // Log history
    await this.historyRepo.save(
      this.historyRepo.create({
        subscriptionId: subscription.id,
        action: 'renewed',
        newStatus: subscription.status,
        details: `Period extended via Stripe payment`,
        metadata: { 
          stripeSubscriptionId,
          previousPeriodEnd: previousPeriodEnd?.toISOString(),
          newPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        },
      })
    );

    // Emit renewal event
    const event = createBaseEvent(EventTopics.SUBSCRIPTION_RENEWED, 'subscription-svc');
    this.kafka.emit(EventTopics.SUBSCRIPTION_RENEWED, {
      ...event,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });

    debug.log(`[SubscriptionSvc.extendPeriodByStripeId] Extended subscription ${subscription.id} period to ${subscription.currentPeriodEnd}`);
  }}