import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface Subscription {
  id: number;
  customerId: number;
  planId: number;
  planName: string;
  amount: number;
  billingCycle: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  isTrialUsed: boolean;
  trialStart: string;
  trialEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string;
  cancellationReason: string;
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  status: string;
  totalAmount: number;
  dueAmount: number;
  dueDate: string;
}

interface SubscriptionGrpcService {
  getAllSubscriptions(data: Record<string, never>): any;
  getSubscriptionsByCustomer(data: { customerId: number }): any;
  renewSubscription(data: { id: number }): any;
  updateSubscriptionStatus(data: { id: number; newStatus: string; reason?: string }): any;
  checkTrialExpiry(data: Record<string, never>): any;
}

interface BillingGrpcService {
  getAllInvoices(data: { page?: number; limit?: number; includeCancelled?: boolean }): any;
  getInvoicesByCustomer(data: { customerId: number; page?: number; limit?: number }): any;
  updateInvoiceStatus(data: { id: number; status: string }): any;
}

interface SubscriptionListResponse {
  subscriptions: Subscription[];
  message?: string;
}

interface InvoiceListResponse {
  invoices: Invoice[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

@Injectable()
export class SubscriptionRenewalTask implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionRenewalTask.name);
  private subscriptionService!: SubscriptionGrpcService;
  private billingService!: BillingGrpcService;

  constructor(
    @Inject('SUBSCRIPTION_PACKAGE') private readonly subscriptionClient: ClientGrpc,
    @Inject('BILLING_PACKAGE') private readonly billingClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.subscriptionService =
      this.subscriptionClient.getService<SubscriptionGrpcService>('SubscriptionService');
    this.billingService =
      this.billingClient.getService<BillingGrpcService>('BillingService');

    // Start all scheduled tasks
    this.startScheduledTasks();
  }

  private startScheduledTasks() {
    // Run subscription renewals every day at 2 AM
    this.scheduleDaily(2, 0, () => this.handleSubscriptionRenewals());

    // Run overdue subscription check every 6 hours
    this.scheduleEvery(6 * 60 * 60 * 1000, () => this.handleOverdueSubscriptions());

    // Run trial ending notifications every day at 9 AM
    this.scheduleDaily(9, 0, () => this.handleTrialEndingNotifications());

    // Run overdue invoice check every hour
    this.scheduleEvery(60 * 60 * 1000, () => this.handleOverdueInvoices());

    this.logger.log('[JobScheduler] All scheduled tasks started');
  }

  private scheduleDaily(hour: number, minute: number, callback: () => void) {
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
    );

    // If scheduled time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const timeUntilScheduled = scheduledTime.getTime() - now.getTime();

    // Schedule first run
    setTimeout(() => {
      callback();
      // Then repeat daily
      setInterval(callback, 24 * 60 * 60 * 1000);
    }, timeUntilScheduled);

    this.logger.log(
      `[JobScheduler] Scheduled daily task at ${hour}:${minute.toString().padStart(2, '0')}`,
    );
  }

  private scheduleEvery(intervalMs: number, callback: () => void) {
    // Run immediately
    callback();
    // Then repeat at interval
    setInterval(callback, intervalMs);

    const hours = intervalMs / (60 * 60 * 1000);
    this.logger.log(`[JobScheduler] Scheduled task every ${hours} hours`);
  }

  // ============ Task Handlers ============

  /**
   * Run every day at 2 AM - Auto-renew subscriptions ending soon
   */
  async handleSubscriptionRenewals(): Promise<void> {
    this.logger.log('[JobScheduler] Starting subscription renewal check...');

    try {
      const subscriptionsToRenew = await this.getSubscriptionsEndingSoon();

      this.logger.log(`Found ${subscriptionsToRenew.length} subscriptions to renew`);

      for (const subscription of subscriptionsToRenew) {
        try {
          await this.renewSubscription(subscription);
          this.logger.log(`[JobScheduler] Renewed subscription #${subscription.id}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `[ERROR] Failed to renew subscription #${subscription.id}: ${errorMessage}`,
          );
        }
      }

      this.logger.log('[JobScheduler] Subscription renewal check completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ERROR] Subscription renewal task failed: ${errorMessage}`);
    }
  }

  /**
   * Run every 6 hours - Check and process overdue subscriptions
   */
  async handleOverdueSubscriptions(): Promise<void> {
    this.logger.log('[WARNING] Checking for overdue subscriptions...');

    try {
      const overdueSubscriptions = await this.getOverdueSubscriptions();

      this.logger.log(`Found ${overdueSubscriptions.length} overdue subscriptions`);

      for (const subscription of overdueSubscriptions) {
        try {
          const daysOverdue = this.calculateDaysOverdue(subscription.currentPeriodEnd);

          if (daysOverdue > 7) {
            // Cancel subscription after 7 days overdue
            await this.cancelOverdueSubscription(subscription);
            this.logger.log(`[JobScheduler] Cancelled overdue subscription #${subscription.id}`);
          } else {
            // Send reminder
            await this.sendPaymentReminder(subscription, daysOverdue);
            this.logger.log(`[JobScheduler] Reminder sent for subscription #${subscription.id}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `[ERROR] Failed to process overdue subscription #${subscription.id}: ${errorMessage}`,
          );
        }
      }

      this.logger.log('[JobScheduler] Overdue subscription check completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ERROR] Overdue subscription task failed: ${errorMessage}`);
    }
  }

  /**
   * Run every day at 9 AM - Send trial ending notifications
   */
  async handleTrialEndingNotifications(): Promise<void> {
    this.logger.log('[JobScheduler] Checking for trials ending soon...');

    try {
      const trialsEndingSoon = await this.getTrialsEndingSoon();

      this.logger.log(`Found ${trialsEndingSoon.length} trials ending soon`);

      for (const subscription of trialsEndingSoon) {
        try {
          const daysUntilEnd = this.calculateDaysUntilTrialEnd(subscription.trialEnd);

          if (daysUntilEnd === 3 || daysUntilEnd === 1) {
            await this.sendTrialEndingNotification(subscription, daysUntilEnd);
            this.logger.log(
              `[JobScheduler] Trial ending notification sent for subscription #${subscription.id} (${daysUntilEnd} days left)`,
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `[ERROR] Failed to send trial notification for #${subscription.id}: ${errorMessage}`,
          );
        }
      }

      this.logger.log('[JobScheduler] Trial ending notification check completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ERROR] Trial notification task failed: ${errorMessage}`);
    }
  }

  /**
   * Run every hour - Check and send overdue invoice reminders
   */
  async handleOverdueInvoices(): Promise<void> {
    this.logger.log('[JobScheduler] Checking for overdue invoices...');

    try {
      const overdueInvoices = await this.getOverdueInvoices();

      this.logger.log(`Found ${overdueInvoices.length} overdue invoices`);

      for (const invoice of overdueInvoices) {
        try {
          const daysOverdue = this.calculateDaysOverdue(invoice.dueDate);

          if (daysOverdue === 1 || daysOverdue === 3 || daysOverdue === 7) {
            await this.sendOverdueInvoiceReminder(invoice, daysOverdue);
            this.logger.log(`[JobScheduler] Overdue invoice reminder sent for #${invoice.id}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `[ERROR] Failed to send invoice reminder for #${invoice.id}: ${errorMessage}`,
          );
        }
      }

      this.logger.log('[JobScheduler] Overdue invoice check completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ERROR] Overdue invoice task failed: ${errorMessage}`);
    }
  }

  // ============ Data Fetching Methods ============

  /**
   * Get all active subscriptions ending within the next 24 hours
   */
  private async getSubscriptionsEndingSoon(): Promise<Subscription[]> {
    try {
      const result: SubscriptionListResponse = await firstValueFrom(
        this.subscriptionService.getAllSubscriptions({}),
      );

      const subscriptions: Subscription[] = result?.subscriptions || [];
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Filter active subscriptions ending within next 24 hours and not set to cancel
      return subscriptions.filter((sub: Subscription) => {
        if (sub.status !== 'active' || sub.cancelAtPeriodEnd) {
          return false;
        }
        const periodEnd = new Date(sub.currentPeriodEnd);
        return periodEnd >= now && periodEnd <= tomorrow;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get subscriptions ending soon: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Get all subscriptions with past_due status or expired period
   */
  private async getOverdueSubscriptions(): Promise<Subscription[]> {
    try {
      const result: SubscriptionListResponse = await firstValueFrom(
        this.subscriptionService.getAllSubscriptions({}),
      );

      const subscriptions: Subscription[] = result?.subscriptions || [];
      const now = new Date();

      // Filter subscriptions that are past_due or have expired period
      return subscriptions.filter((sub: Subscription) => {
        if (sub.status === 'past_due') {
          return true;
        }
        // Also check if active subscription has expired period (payment failed)
        if (sub.status === 'active') {
          const periodEnd = new Date(sub.currentPeriodEnd);
          return periodEnd < now;
        }
        return false;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get overdue subscriptions: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Get all trial subscriptions ending within the next 3 days
   */
  private async getTrialsEndingSoon(): Promise<Subscription[]> {
    try {
      const result: SubscriptionListResponse = await firstValueFrom(
        this.subscriptionService.getAllSubscriptions({}),
      );

      const subscriptions: Subscription[] = result?.subscriptions || [];
      const now = new Date();
      const threeDaysLater = new Date(now);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      // Filter trial subscriptions ending within next 3 days
      return subscriptions.filter((sub: Subscription) => {
        if (sub.status !== 'trial' || !sub.trialEnd) {
          return false;
        }
        const trialEnd = new Date(sub.trialEnd);
        return trialEnd >= now && trialEnd <= threeDaysLater;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get trials ending soon: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Get all unpaid invoices that are past due date
   */
  private async getOverdueInvoices(): Promise<Invoice[]> {
    try {
      const result: InvoiceListResponse = await firstValueFrom(
        this.billingService.getAllInvoices({ page: 1, limit: 1000, includeCancelled: false }),
      );

      const invoices: Invoice[] = result?.invoices || [];
      const today = new Date();

      // Filter invoices that are unpaid/overdue and past due date
      return invoices.filter((invoice: Invoice) => {
        const isUnpaid = ['unpaid', 'draft', 'overdue'].includes(invoice.status);
        if (!isUnpaid) {
          return false;
        }
        const dueDate = new Date(invoice.dueDate);
        return dueDate < today;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get overdue invoices: ${errorMessage}`);
      return [];
    }
  }

  // ============ Action Methods ============

  /**
   * Renew a subscription via gRPC
   */
  private async renewSubscription(subscription: Subscription): Promise<void> {
    try {
      await firstValueFrom(
        this.subscriptionService.renewSubscription({
          id: subscription.id,
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Renewal failed: ${errorMessage}`);
    }
  }

  /**
   * Cancel an overdue subscription
   */
  private async cancelOverdueSubscription(subscription: Subscription): Promise<void> {
    try {
      await firstValueFrom(
        this.subscriptionService.updateSubscriptionStatus({
          id: subscription.id,
          newStatus: 'cancelled',
          reason: 'Payment overdue for more than 7 days',
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Cancellation failed: ${errorMessage}`);
    }
  }

  // ============ Notification Methods (Mock - integrate with notification service) ============

  private async sendTrialEndingNotification(
    subscription: Subscription,
    daysLeft: number,
  ): Promise<void> {
    // TODO: Integrate with notification service (email/SMS)
    this.logger.log(
      `[JobScheduler] [NOTIFICATION] Trial ending: Subscription #${subscription.id} ` +
      `(Customer #${subscription.customerId}) expires in ${daysLeft} days. ` +
      `Plan: ${subscription.planName}, Amount: $${subscription.amount}`,
    );
  }

  private async sendOverdueInvoiceReminder(
    invoice: Invoice,
    daysOverdue: number,
  ): Promise<void> {
    // TODO: Integrate with notification service (email/SMS)
    this.logger.log(
      `[JobScheduler] [NOTIFICATION] Overdue invoice: Invoice #${invoice.id} ` +
      `(${invoice.invoiceNumber}) for Customer #${invoice.customerId} ` +
      `is ${daysOverdue} days overdue. Amount due: $${invoice.dueAmount}`,
    );
  }

  private async sendPaymentReminder(
    subscription: Subscription,
    daysOverdue: number,
  ): Promise<void> {
    // TODO: Integrate with notification service (email/SMS)
    this.logger.log(
      `[JobScheduler] [NOTIFICATION] Payment reminder: Subscription #${subscription.id} ` +
      `(Customer #${subscription.customerId}) is ${daysOverdue} days overdue. ` +
      `Plan: ${subscription.planName}. Please update payment method.`,
    );
  }

  // ============ Utility Methods ============

  private calculateDaysOverdue(endDate: string | Date): number {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = today.getTime() - end.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  private calculateDaysUntilTrialEnd(trialEnd: string | Date): number {
    const end = new Date(trialEnd);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}
