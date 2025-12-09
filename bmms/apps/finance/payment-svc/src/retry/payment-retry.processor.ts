import { Injectable, Logger } from '@nestjs/common';
import { PaymentRetryManager } from './payment-retry.manager';
import { PaymentService } from '../payment-svc.service';

/**
 * Payment Retry Processor
 * 
 * Scheduled task that processes due payment retries
 */
@Injectable()
export class PaymentRetryProcessor {
  private readonly logger = new Logger(PaymentRetryProcessor.name);
  private isProcessing = false;

  constructor(
    private readonly retryManager: PaymentRetryManager,
    private readonly paymentService: PaymentService,
  ) {
    this.logger.log('[Payment] PaymentRetryProcessor initialized');
  }

  /**
   * Process payment retries
   * This should be called by a scheduler service
   */
  async processRetries(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('[WARNING] Retry processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      this.logger.log('[Payment] Starting payment retry processing...');

      // Get all retries that are due
      const dueRetries = await this.retryManager.getDueRetries();

      if (dueRetries.length === 0) {
        this.logger.log('[Payment] No retries due for processing');
        return;
      }

      this.logger.log(`[Payment] Processing ${dueRetries.length} due retries...`);

      let succeeded = 0;
      let failed = 0;
      let exhausted = 0;

      // Process each retry
      for (const retry of dueRetries) {
        try {
          await this.processRetry(retry.id);
          
          // Re-fetch to get updated status
          const updated = await this.retryManager.getRetryStatus(retry.paymentId);
          
          if (updated?.canRetry === false) {
            if (updated.attempt >= updated.maxAttempts) {
              exhausted++;
            }
          } else {
            succeeded++;
          }
        } catch (error) {
          failed++;
          this.logger.error(
            `[ERROR] Failed to process retry ${retry.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[Payment] Retry processing complete in ${duration}ms - ` +
        `Succeeded: ${succeeded}, Failed: ${failed}, Exhausted: ${exhausted}`
      );

      // TODO: Emit statistics event via Kafka
      // this.kafkaClient.emit('payment.retry.batch.completed', {...});

    } catch (error) {
      this.logger.error(
        `[ERROR] Error during retry processing: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single retry
   * 
   * @param retryId - Retry record ID
   */
  private async processRetry(retryId: string): Promise<void> {
    // Mark as processing
    await this.retryManager.markProcessing(retryId);

    const retry = await this.retryManager.getRetryStatus(retryId);
    if (!retry) {
      throw new Error(`Retry ${retryId} not found`);
    }

    this.logger.log(
      `[Payment] Processing retry for subscription ${retry.subscriptionId}, ` +
      `invoice ${retry.invoiceId} (attempt ${retry.attempt + 1}/${retry.maxAttempts})`
    );

    // TODO: Emit retry attempt event
    // this.kafkaClient.emit('payment.retry.attempted', {...});

    let success = false;
    let error: string | undefined;

    try {
      // Attempt payment
      const payments = await this.paymentService.getByInvoice(retry.invoiceId);
      
      if (!payments || payments.length === 0) {
        throw new Error(`No payment found for invoice ${retry.invoiceId}`);
      }

      const payment = payments[0];

      // Retry the payment by initiating a new attempt
      await this.paymentService.initiatePayment({
        invoiceId: retry.invoiceId,
        invoiceNumber: payment.invoiceNumber,
        amount: payment.totalAmount,
        customerId: payment.customerId,
        method: 'auto_retry',
        description: `Retry attempt ${retry.attempt + 1}`,
      });

      success = true;
      this.logger.log(
        `[Payment] Payment retry succeeded for subscription ${retry.subscriptionId}`
      );

      // TODO: Emit success event
      // this.kafkaClient.emit('payment.retry.succeeded', {...});

    } catch (err) {
      error = err.message;
      this.logger.warn(
        `[WARNING] Payment retry failed for subscription ${retry.subscriptionId}: ${error}`
      );

      // TODO: Emit failure event
      // this.kafkaClient.emit('payment.retry.failed', {...});
    }

    // Record attempt
    const updatedRetry = await this.retryManager.recordAttempt(retryId, success, error);

    // If exhausted, emit exhausted event
    if (updatedRetry.status === 'exhausted') {
      this.logger.error(
        `[ERROR] Payment retries exhausted for subscription ${retry.subscriptionId}`
      );

      // TODO: Emit exhausted event
      // this.kafkaClient.emit('payment.retry.exhausted', {...});

      // TODO: Trigger subscription suspension/cancellation
    }
  }

  /**
   * Cleanup old retry records
   */
  async cleanupOldRetries(): Promise<void> {
    try {
      this.logger.log('[Payment] Starting cleanup of old retry records...');
      
      const deleted = await this.retryManager.cleanupOldRetries(90);
      
this.logger.log(`[Payment] Cleaned up ${deleted} old retry records`);
    } catch (error) {
      this.logger.error(
        `[ERROR] Error during cleanup: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get retry processing statistics (for monitoring)
   */
  async logStatistics(): Promise<void> {
    try {
      const stats = await this.retryManager.getStatistics();
      
      this.logger.log('[Payment] Payment Retry Statistics:');
      this.logger.log(`   Total: ${stats.total}`);
      this.logger.log(`   Pending: ${stats.pending}`);
      this.logger.log(`   Retrying: ${stats.retrying}`);
      this.logger.log(`   Succeeded: ${stats.succeeded}`);
      this.logger.log(`   Exhausted: ${stats.exhausted}`);
      this.logger.log(`   Cancelled: ${stats.cancelled}`);
      this.logger.log(`   Success Rate: ${stats.successRate}`);

      // TODO: Emit statistics event
      // this.kafkaClient.emit('payment.retry.statistics', {...});
    } catch (error) {
      this.logger.error(
        `[ERROR] Error logging statistics: ${error.message}`,
        error.stack,
      );
    }
  }
}
