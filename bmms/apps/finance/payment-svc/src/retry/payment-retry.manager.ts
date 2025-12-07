import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { PaymentRetry } from '../entities/payment-retry.entity';
import {
  PaymentRetryService,
  type PaymentRetryConfig,
  type PaymentRetryResult,
} from './payment-retry.service';

/**
 * Payment Retry Manager
 * 
 * Manages payment retry database operations and orchestrates retry attempts
 */
@Injectable()
export class PaymentRetryManager {
  private readonly logger = new Logger(PaymentRetryManager.name);
  private readonly retryService: PaymentRetryService;

  constructor(
    @InjectRepository(PaymentRetry)
    private readonly retryRepository: Repository<PaymentRetry>,
    config?: PaymentRetryConfig,
  ) {
    this.retryService = new PaymentRetryService(config);
    this.logger.log('[Payment] PaymentRetryManager initialized');
  }

  /**
   * Schedule a payment retry
   * 
   * @param paymentId - Payment ID
   * @param invoiceId - Invoice ID
   * @param subscriptionId - Subscription ID
   * @param failureReason - Reason for payment failure
   * @returns Created retry record
   */
  async scheduleRetry(
    paymentId: string,
    invoiceId: string,
    subscriptionId: string,
    failureReason: string,
  ): Promise<PaymentRetry> {
    this.logger.log(`[Payment] Scheduling retry for payment ${paymentId}`);

    // Check if retry already exists
    let retry = await this.retryRepository.findOne({
      where: { paymentId },
    });

    if (retry) {
      this.logger.warn(`[WARNING] Retry already exists for payment ${paymentId}`);
      return retry;
    }

    // Analyze failure
    const analysis = this.retryService.analyzeFailure(failureReason);

    // Create retry record
    const firstFailureAt = new Date();
    const nextRetryAt = this.retryService.calculateNextRetryDate(1, firstFailureAt);

    retry = this.retryRepository.create({
      paymentId,
      invoiceId,
      subscriptionId,
      attemptNumber: 0,
      status: 'pending',
      firstFailureAt,
      nextRetryAt: analysis.retryable ? nextRetryAt : null,
      failureReason,
      retryHistory: [],
      metadata: {
        failureType: analysis.type as any,
        retryable: analysis.retryable,
        customerNotified: false,
        notificationsSent: 0,
      },
    });

    await this.retryRepository.save(retry);

    this.logger.log(
      `[Payment] Retry scheduled for payment ${paymentId} - ` +
      `Next attempt: ${nextRetryAt?.toISOString() || 'N/A'}`
    );

    return retry;
  }

  /**
   * Record a retry attempt
   * 
   * @param retryId - Retry record ID
   * @param success - Whether retry succeeded
   * @param error - Error message if failed
   * @returns Updated retry record
   */
  async recordAttempt(
    retryId: string,
    success: boolean,
    error?: string,
  ): Promise<PaymentRetry> {
    const retry = await this.retryRepository.findOne({
      where: { id: retryId },
    });

    if (!retry) {
      throw new Error(`Retry record ${retryId} not found`);
    }

    const newAttemptNumber = retry.attemptNumber + 1;
    const now = new Date();

    // Update retry history
    const historyEntry = {
      attemptNumber: newAttemptNumber,
      attemptedAt: now,
      success,
      error,
      delayMs: this.retryService.calculateRetryDelay(newAttemptNumber),
    };

    retry.retryHistory = [...(retry.retryHistory || []), historyEntry];
    retry.attemptNumber = newAttemptNumber;
    retry.lastRetryAt = now;
    retry.lastError = error || null;

    if (success) {
      // Payment succeeded
      retry.status = 'succeeded';
      retry.succeededAt = now;
      retry.nextRetryAt = null;
      
      this.logger.log(
        `[Payment] Payment retry succeeded for payment ${retry.paymentId} ` +
        `(attempt ${newAttemptNumber}/${retry.maxAttempts})`
      );
    } else {
      // Payment failed again
      const canRetry = this.retryService.canRetry(
        newAttemptNumber,
        retry.firstFailureAt,
      );

      if (canRetry) {
        // Schedule next retry
        retry.status = 'pending';
        retry.nextRetryAt = this.retryService.calculateNextRetryDate(
          newAttemptNumber + 1,
          retry.firstFailureAt,
        );
        
        this.logger.warn(
          `[WARNING] Payment retry failed for payment ${retry.paymentId} ` +
          `(attempt ${newAttemptNumber}/${retry.maxAttempts}) - ` +
          `Next retry: ${retry.nextRetryAt.toISOString()}`
        );
      } else {
        // Exhausted all retries
        retry.status = 'exhausted';
        retry.nextRetryAt = null;
        
        this.logger.error(
          `[ERROR] Payment retries exhausted for payment ${retry.paymentId} ` +
          `after ${newAttemptNumber} attempts`
        );
      }
    }

    await this.retryRepository.save(retry);

    // Log retry attempt
    this.retryService.logRetryAttempt(
      retry.subscriptionId,
      newAttemptNumber,
      success,
      error,
    );

    return retry;
  }

  /**
   * Get retries that are due for processing
   * 
   * @returns List of retries ready for processing
   */
  async getDueRetries(): Promise<PaymentRetry[]> {
    const now = new Date();
    
    const retries = await this.retryRepository.find({
      where: {
        status: 'pending',
        nextRetryAt: LessThanOrEqual(now),
      },
      order: {
        nextRetryAt: 'ASC',
      },
    });

    this.logger.log(`[Payment] Found ${retries.length} retries due for processing`);

    return retries;
  }

  /**
   * Mark retry as processing
   * 
   * @param retryId - Retry record ID
   */
  async markProcessing(retryId: string): Promise<void> {
    await this.retryRepository.update(retryId, {
      status: 'retrying',
    });
  }

  /**
   * Cancel a scheduled retry
   * 
   * @param paymentId - Payment ID
   * @returns Updated retry record
   */
  async cancelRetry(paymentId: string): Promise<PaymentRetry | null> {
    const retry = await this.retryRepository.findOne({
      where: { paymentId },
    });

    if (!retry) {
      return null;
    }

    retry.status = 'cancelled';
    retry.nextRetryAt = null;

    await this.retryRepository.save(retry);

    this.logger.log(`[Payment] Cancelled retry for payment ${paymentId}`);

    return retry;
  }

  /**
   * Get retry status
   * 
   * @param paymentId - Payment ID
   * @returns Retry status or null
   */
  async getRetryStatus(paymentId: string) {
    const retry = await this.retryRepository.findOne({
      where: { paymentId },
    });

    if (!retry) {
      return null;
    }

    return this.retryService.getRetryStatus(
      retry.subscriptionId,
      retry.invoiceId,
      retry.attemptNumber,
      retry.firstFailureAt,
      retry.failureReason,
    );
  }

  /**
   * Get all retries for a subscription
   * 
   * @param subscriptionId - Subscription ID
   * @returns List of retry records
   */
  async getSubscriptionRetries(subscriptionId: string): Promise<PaymentRetry[]> {
    return this.retryRepository.find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get retry statistics
   */
  async getStatistics() {
    const [total, pending, retrying, succeeded, exhausted, cancelled] = await Promise.all([
      this.retryRepository.count(),
      this.retryRepository.count({ where: { status: 'pending' } }),
      this.retryRepository.count({ where: { status: 'retrying' } }),
      this.retryRepository.count({ where: { status: 'succeeded' } }),
      this.retryRepository.count({ where: { status: 'exhausted' } }),
      this.retryRepository.count({ where: { status: 'cancelled' } }),
    ]);

    const successRate = total > 0 ? (succeeded / total) * 100 : 0;

    return {
      total,
      pending,
      retrying,
      succeeded,
      exhausted,
      cancelled,
      successRate: successRate.toFixed(2) + '%',
    };
  }

  /**
   * Clean up old retry records
   * 
   * @param olderThanDays - Delete records older than this many days
   * @returns Number of records deleted
   */
  async cleanupOldRetries(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.retryRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('status IN (:...statuses)', { statuses: ['succeeded', 'exhausted', 'cancelled'] })
      .execute();

    this.logger.log(`[Payment] Cleaned up ${result.affected} old retry records`);

    return result.affected || 0;
  }
}
