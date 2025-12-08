import { Injectable, Logger } from '@nestjs/common';

/**
 * Payment Retry Configuration
 */
export interface PaymentRetryConfig {
  // Maximum number of retry attempts
  maxAttempts: number;
  
  // Initial delay in milliseconds (default: 1 hour)
  initialDelayMs: number;
  
  // Maximum delay in milliseconds (default: 7 days)
  maxDelayMs: number;
  
  // Exponential backoff multiplier (default: 2)
  backoffMultiplier: number;
  
  // Grace period before marking as expired (default: 15 days)
  gracePeriodDays: number;
}

/**
 * Payment Retry Status
 */
export interface PaymentRetryStatus {
  subscriptionId: string;
  invoiceId: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  lastRetryAt: Date | null;
  failureReason: string;
  canRetry: boolean;
  isInGracePeriod: boolean;
  daysUntilExpiration: number;
}

/**
 * Payment Retry Result
 */
export interface PaymentRetryResult {
  success: boolean;
  subscriptionId: string;
  invoiceId: string;
  attempt: number;
  message: string;
  nextRetryAt?: Date;
  error?: string;
}

/**
 * Payment Retry Service
 * 
 * Handles automatic payment retry logic for failed subscription payments
 * 
 * Retry Strategy:
 * - Attempt 1: 1 hour after failure
 * - Attempt 2: 2 hours after attempt 1
 * - Attempt 3: 4 hours after attempt 2
 * - Attempt 4: 8 hours after attempt 3
 * - Attempt 5: 1 day after attempt 4
 * - Attempt 6: 2 days after attempt 5
 * - Attempt 7: 3 days after attempt 6
 * 
 * Grace Period: 15 days total before subscription expires
 */
@Injectable()
export class PaymentRetryService {
  private readonly logger = new Logger(PaymentRetryService.name);
  private readonly config: PaymentRetryConfig;

  // Default configuration
  private readonly defaultConfig: PaymentRetryConfig = {
    maxAttempts: 7,
    initialDelayMs: 60 * 60 * 1000, // 1 hour
    maxDelayMs: 3 * 24 * 60 * 60 * 1000, // 3 days
    backoffMultiplier: 2,
    gracePeriodDays: 15,
  };

  constructor(config?: PaymentRetryConfig) {
    this.config = config || this.defaultConfig;
    
    this.logger.log('PaymentRetryService initialized');
    this.logger.log(`   Max attempts: ${this.config.maxAttempts}`);
    this.logger.log(`   Initial delay: ${this.formatDuration(this.config.initialDelayMs)}`);
    this.logger.log(`   Grace period: ${this.config.gracePeriodDays} days`);
  }

  /**
   * Calculate next retry delay with exponential backoff
   * 
   * @param attemptNumber - Current attempt number (1-based)
   * @returns Delay in milliseconds
   */
  calculateRetryDelay(attemptNumber: number): number {
    if (attemptNumber < 1) {
      throw new Error('Attempt number must be >= 1');
    }

    // Calculate exponential backoff: initialDelay * (multiplier ^ (attempt - 1))
    const delay = this.config.initialDelayMs * Math.pow(
      this.config.backoffMultiplier,
      attemptNumber - 1
    );

    // Cap at maximum delay
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Calculate next retry date
   * 
   * @param attemptNumber - Current attempt number
   * @param fromDate - Base date for calculation (default: now)
   * @returns Next retry date
   */
  calculateNextRetryDate(attemptNumber: number, fromDate: Date = new Date()): Date {
    const delay = this.calculateRetryDelay(attemptNumber);
    return new Date(fromDate.getTime() + delay);
  }

  /**
   * Get retry schedule for all attempts
   * 
   * @param firstFailureDate - Date of first payment failure
   * @returns Array of retry dates
   */
  getRetrySchedule(firstFailureDate: Date = new Date()): Date[] {
    const schedule: Date[] = [];
    let currentDate = new Date(firstFailureDate);

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      currentDate = this.calculateNextRetryDate(attempt, currentDate);
      schedule.push(new Date(currentDate));
    }

    return schedule;
  }

  /**
   * Check if payment can be retried
   * 
   * @param attempt - Current attempt number
   * @param firstFailureDate - Date of first payment failure
   * @returns True if can retry
   */
  canRetry(attempt: number, firstFailureDate: Date): boolean {
    // Check if within max attempts
    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    // Check if within grace period
    const daysSinceFailure = this.getDaysSince(firstFailureDate);
    if (daysSinceFailure >= this.config.gracePeriodDays) {
      return false;
    }

    return true;
  }

  /**
   * Check if subscription is in grace period
   * 
   * @param firstFailureDate - Date of first payment failure
   * @returns True if in grace period
   */
  isInGracePeriod(firstFailureDate: Date): boolean {
    const daysSinceFailure = this.getDaysSince(firstFailureDate);
    return daysSinceFailure < this.config.gracePeriodDays;
  }

  /**
   * Calculate days until expiration
   * 
   * @param firstFailureDate - Date of first payment failure
   * @returns Days remaining in grace period (0 if expired)
   */
  getDaysUntilExpiration(firstFailureDate: Date): number {
    const daysSinceFailure = this.getDaysSince(firstFailureDate);
    const daysRemaining = this.config.gracePeriodDays - daysSinceFailure;
    return Math.max(0, Math.ceil(daysRemaining));
  }

  /**
   * Get payment retry status
   * 
   * @param subscriptionId - Subscription ID
   * @param invoiceId - Invoice ID
   * @param attempt - Current attempt number
   * @param firstFailureDate - Date of first failure
   * @param failureReason - Reason for failure
   * @returns Retry status
   */
  getRetryStatus(
    subscriptionId: string,
    invoiceId: string,
    attempt: number,
    firstFailureDate: Date,
    failureReason: string
  ): PaymentRetryStatus {
    const canRetry = this.canRetry(attempt, firstFailureDate);
    const isInGracePeriod = this.isInGracePeriod(firstFailureDate);
    const daysUntilExpiration = this.getDaysUntilExpiration(firstFailureDate);

    let nextRetryAt: Date | null = null;
    let lastRetryAt: Date | null = null;

    if (attempt > 0) {
      // Calculate last retry date (when current attempt happened)
      const schedule = this.getRetrySchedule(firstFailureDate);
      if (attempt <= schedule.length) {
        lastRetryAt = schedule[attempt - 1];
      }
    }

    if (canRetry) {
      nextRetryAt = this.calculateNextRetryDate(attempt + 1, firstFailureDate);
    }

    return {
      subscriptionId,
      invoiceId,
      attempt,
      maxAttempts: this.config.maxAttempts,
      nextRetryAt,
      lastRetryAt,
      failureReason,
      canRetry,
      isInGracePeriod,
      daysUntilExpiration,
    };
  }

  /**
   * Determine failure type and if it's retryable
   * 
   * @param failureReason - Error reason from payment gateway
   * @returns Object with type and retryable flag
   */
  analyzeFailure(failureReason: string): {
    type: string;
    retryable: boolean;
    message: string;
  } {
    const reason = failureReason.toLowerCase();

    // Non-retryable failures (permanent)
    if (
      reason.includes('card_expired') ||
      reason.includes('invalid_card') ||
      reason.includes('card_declined') ||
      reason.includes('invalid_account')
    ) {
      return {
        type: 'permanent',
        retryable: false,
        message: 'Payment method invalid - customer must update payment method',
      };
    }

    // Temporary failures (retryable)
    if (
      reason.includes('insufficient_funds') ||
      reason.includes('temporary_failure') ||
      reason.includes('processing_error') ||
      reason.includes('timeout') ||
      reason.includes('gateway_error')
    ) {
      return {
        type: 'temporary',
        retryable: true,
        message: 'Temporary payment failure - will retry automatically',
      };
    }

    // Default: treat as temporary and retryable
    return {
      type: 'unknown',
      retryable: true,
      message: 'Payment failed - will retry automatically',
    };
  }

  /**
   * Get retry strategy description for customer
   * 
   * @param attempt - Current attempt number
   * @returns Human-readable description
   */
  getRetryDescription(attempt: number): string {
    if (attempt >= this.config.maxAttempts) {
      return 'All retry attempts exhausted. Please update your payment method.';
    }

    const nextDelay = this.calculateRetryDelay(attempt + 1);
    const formattedDelay = this.formatDuration(nextDelay);

    return `We'll automatically retry your payment in ${formattedDelay}. ` +
           `Attempt ${attempt + 1} of ${this.config.maxAttempts}.`;
  }

  /**
   * Generate customer notification message
   * 
   * @param status - Retry status
   * @returns Customer-friendly message
   */
  generateCustomerMessage(status: PaymentRetryStatus): string {
    if (!status.canRetry) {
      if (status.attempt >= status.maxAttempts) {
        return `Your subscription payment has failed ${status.maxAttempts} times. ` +
               `Please update your payment method to continue your service.`;
      } else {
        return 'Your subscription payment has failed and cannot be retried. ' +
               'Please update your payment method.';
      }
    }

    const parts: string[] = [];

    parts.push(`Your payment failed: ${status.failureReason}`);
    
    if (status.nextRetryAt) {
      parts.push(
        `We'll automatically retry on ${status.nextRetryAt.toLocaleDateString()} ` +
        `at ${status.nextRetryAt.toLocaleTimeString()}.`
      );
    }

    parts.push(`Attempt ${status.attempt} of ${status.maxAttempts}.`);

    if (status.daysUntilExpiration > 0) {
      parts.push(
        `Your service will continue for ${status.daysUntilExpiration} more days ` +
        `while we attempt to process payment.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Log retry attempt
   * 
   * @param subscriptionId - Subscription ID
   * @param attempt - Attempt number
   * @param success - Whether retry succeeded
   * @param error - Error message if failed
   */
  logRetryAttempt(
    subscriptionId: string,
    attempt: number,
    success: boolean,
    error?: string
  ): void {
    if (success) {
      this.logger.log(
        `[Payment] Payment retry succeeded for subscription ${subscriptionId} ` +
        `(attempt ${attempt}/${this.config.maxAttempts})`
      );
    } else {
      this.logger.warn(
        `[ERROR] Payment retry failed for subscription ${subscriptionId} ` +
        `(attempt ${attempt}/${this.config.maxAttempts}): ${error}`
      );
    }
  }

  /**
   * Get retry policy description
   */
  getRetryPolicy(): string {
    const schedule = this.getRetrySchedule();
    const scheduleText = schedule
      .map((date, idx) => `Attempt ${idx + 1}: ${this.formatDuration(this.calculateRetryDelay(idx + 1))} after previous attempt`)
      .join('\n  ');

    return `
Payment Retry Policy:
- Maximum ${this.config.maxAttempts} automatic retry attempts
- Exponential backoff strategy
- ${this.config.gracePeriodDays} day grace period before expiration

Retry Schedule:
  ${scheduleText}

Total time window: ~${this.formatDuration(schedule[schedule.length - 1].getTime() - Date.now())}
    `.trim();
  }

  // ============= PRIVATE HELPERS =============

  /**
   * Calculate days since a date
   */
  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}
