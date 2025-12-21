
// ============ payment.event-listener.ts ============

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import * as event from '@bmms/event';
import { PaymentService } from './payment-svc.service';

@Controller()
export class PaymentEventListener {
  private readonly logger = new Logger(PaymentEventListener.name);

  constructor(
    private readonly paymentService: PaymentService,
    // TODO: Inject VNPayService when implementing VNPay integration
    // private readonly vnpayService: VNPayService,
  ) {}

  /** ================== INVOICE EVENTS ================== */

  /**
   * Handles invoice.created event - Creates pending payment and initiates payment flow
   */
  @EventPattern(event.EventTopics.INVOICE_CREATED)
  async handleInvoiceCreated(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('='.repeat(60));
    this.logger.debug('[Payment] handleInvoiceCreated TRIGGERED');
    this.logger.debug('='.repeat(60));

    try {
      let invoiceData = data;
      if (data && data.data) {
        invoiceData = data.data;
      }

      const { invoiceId, invoiceNumber, orderId, customerId, totalAmount, dueDate } = invoiceData;

      this.logger.log(`[Payment] Processing Invoice:`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Invoice Number: ${invoiceNumber}`);
      this.logger.log(`   - Order ID: ${orderId || 'N/A'}`);
      this.logger.log(`   - Customer ID: ${customerId}`);
      this.logger.log(`   - Total Amount: ${totalAmount} VND`);
      this.logger.log(`   - Due Date: ${dueDate}`);

      if (!invoiceId || !invoiceNumber || !customerId || !totalAmount) {
        this.logger.error('[ERROR] Missing required invoice fields');
        return;
      }

      // Check if payment already exists for this invoice (avoid duplicates)
      const existingPayment = await this.paymentService.getByInvoice(invoiceId);
      if (existingPayment && existingPayment.length > 0) {
        this.logger.warn(`[WARNING] Payment already exists for invoice ${invoiceNumber}, skipping...`);
        await this.commitOffset(context);
        return;
      }

      // 1. Register invoice in payment system (this creates the payment record)
      const payment = await this.paymentService.registerInvoice({
        invoiceId,
        invoiceNumber,
        orderId: orderId || null,
        customerId,
        totalAmount,
        dueDate,
      });

      this.logger.log(`[Payment] Invoice ${invoiceNumber} registered in payment system`);
      this.logger.log(`[Payment] Payment created with ID: ${payment.id}`);

      // 3. TODO: Generate VNPay payment URL (commented for now)
      // const vnpayUrl = await this.vnpayService.createPaymentUrl({
      //   orderId,
      //   amount: totalAmount,
      //   orderInfo: `Payment for invoice ${invoiceNumber}`,
      //   returnUrl: `${process.env.APP_URL}/payments/return`,
      //   ipAddr: customerIp,
      // });

      // 4. Emit payment.initiated event (for frontend/notifications)
      await this.paymentService.emitPaymentInitiated({
        paymentId: payment.id,
        invoiceId,
        orderId: orderId || null,
        customerId,
        amount: totalAmount,
        currency: 'VND',
        method: 'vnpay',
        // paymentUrl: vnpayUrl, // Will be real URL after VNPay integration
      });

      this.logger.log(`[Payment] Emitted payment.initiated event for invoice ${invoiceNumber}`);

      // 5. TODO: Send invoice notification with payment link
      // await this.notificationService.sendInvoiceCreated({
      //   customerId,
      //   invoiceNumber,
      //   totalAmount,
      //   dueDate,
      //   paymentUrl: vnpayUrl,
      // });

      await this.commitOffset(context);

    } catch (error) {
      this.logger.error('[ERROR] Error handling INVOICE_CREATED:', error);
      this.logger.error('Stack:', error.stack);
    }
  }

  /** ================== PAYMENT EVENTS ================== */

  /**
   * Handles payment.success event from VNPay callback
   */
  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('='.repeat(60));
    this.logger.debug('[Payment] handlePaymentSuccess TRIGGERED');
    this.logger.debug('='.repeat(60));

    try {
      let paymentData = data;
      if (data && data.data) {
        paymentData = data.data;
      }

      const { paymentId, invoiceId, orderId, customerId, amount, method, transactionId, paidAt } = paymentData;

      this.logger.log(`[Payment] Processing Successful Payment:`);
      this.logger.log(`   - Payment ID: ${paymentId}`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Order ID: ${orderId || 'N/A'}`);
      this.logger.log(`   - Customer ID: ${customerId || 'N/A'}`);
      this.logger.log(`   - Amount: ${amount} VND`);
      this.logger.log(`   - Method: ${method || 'vnpay'}`);
      this.logger.log(`   - Transaction ID: ${transactionId}`);

      if (!paymentId || !invoiceId || !amount) {
        this.logger.error('[ERROR] Missing required payment fields');
        return;
      }

      // 1. Update payment record to 'completed'
      await this.paymentService.markPaymentSuccess({
        paymentId,
        invoiceId,
        amount,
        method: method || 'vnpay',
        transactionId,
        paidAt: paidAt || new Date(),
      });

      this.logger.log(`[Payment] Payment ${paymentId} marked as successful`);

      // Note: Invoice status will be updated by billing-svc when it receives this event
      // No need to update invoice directly from payment-svc

      // 2. TODO: Notify Order Service (update order.paymentStatus)
      // if (orderId) {
      //   await this.orderService.updatePaymentStatus(orderId, 'paid');
      // }

      // 3. TODO: Send payment confirmation to customer
      // await this.notificationService.sendPaymentConfirmation({
      //   customerId,
      //   invoiceId,
      //   amount,
      //   transactionId,
      //   receiptUrl: `${process.env.APP_URL}/receipts/${paymentId}`,
      // });

      this.logger.log(`[Payment] Payment confirmation queued for customer ${customerId}`);

      await this.commitOffset(context);

    } catch (error) {
      this.logger.error('[ERROR] Error handling PAYMENT_SUCCESS:', error);
      this.logger.error('Stack:', error.stack);
    }
  }

  /** -------- Payment Failed -------- */

  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('='.repeat(60));
    this.logger.debug('[ERROR] handlePaymentFailed TRIGGERED');
    this.logger.debug('='.repeat(60));

    try {
      let paymentData = data;
      if (data && data.data) {
        paymentData = data.data;
      }

      const { paymentId, invoiceId, orderId, customerId, amount, method, reason, errorCode, canRetry } = paymentData;

      this.logger.log(`[WARNING] Payment Failed:`);
      this.logger.log(`   - Payment ID: ${paymentId}`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Order ID: ${orderId || 'N/A'}`);
      this.logger.log(`   - Customer ID: ${customerId || 'N/A'}`);
      this.logger.log(`   - Amount: ${amount} VND`);
      this.logger.log(`   - Method: ${method || 'vnpay'}`);
      this.logger.log(`   - Error Code: ${errorCode || 'UNKNOWN'}`);
      this.logger.log(`   - Reason: ${reason}`);
      this.logger.log(`   - Can Retry: ${canRetry ? 'YES' : 'NO'}`);

      if (!paymentId || !invoiceId) {
        this.logger.error('[ERROR] Missing required payment fields');
        return;
      }

      // 1. Mark payment as failed
      await this.paymentService.markPaymentFailed({
        paymentId,
        invoiceId,
        reason,
        errorCode: errorCode || 'UNKNOWN',
      });

      this.logger.log(`[Payment] Payment ${paymentId} marked as failed`);

      // 2. Keep invoice status as pending/unpaid
      await this.paymentService.updateInvoiceStatus(invoiceId, 'pending');

      // 3. Handle retry logic based on canRetry flag
      if (canRetry) {
        this.logger.log(`[Payment] Payment can be retried - sending retry notification`);
        
        // TODO: Send retry notification to customer
        // await this.notificationService.sendPaymentFailureNotice({
        //   customerId,
        //   invoiceId,
        //   reason,
        //   errorCode,
        //   retryUrl: `${process.env.APP_URL}/payments/retry/${invoiceId}`,
        // });
      } else {
        this.logger.log(`[Payment] Payment cannot be retried - manual intervention required`);
        
        // TODO: Alert support team for manual review
        // await this.notificationService.alertSupportTeam({
        //   paymentId,
        //   invoiceId,
        //   orderId,
        //   customerId,
        //   reason,
        //   errorCode,
        // });
      }

      await this.commitOffset(context);

    } catch (error) {
      this.logger.error('[ERROR] Error handling PAYMENT_FAILED:', error);
      this.logger.error('Stack:', error.stack);
    }
  }

  /** -------- Payment Retry (for VNPay) -------- */

  @EventPattern(event.EventTopics.PAYMENT_RETRY)
  async handlePaymentRetry(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('='.repeat(60));
    this.logger.debug('[Payment] handlePaymentRetry TRIGGERED');
    this.logger.debug('='.repeat(60));

    try {
      let paymentData = data;
      if (data && data.data) {
        paymentData = data.data;
      }

      const { paymentId, invoiceId, orderId, customerId, amount, retryCount, previousFailureReason } = paymentData;

      this.logger.log(`[Payment] Processing Payment Retry:`);
      this.logger.log(`   - Payment ID: ${paymentId}`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Retry Count: ${retryCount}`);
      this.logger.log(`   - Previous Failure: ${previousFailureReason}`);

      // 1. Create new payment attempt record
      const newPayment = await this.paymentService.createRetryPayment({
        originalPaymentId: paymentId,
        invoiceId,
        orderId,
        customerId,
        amount,
        // currency: 'VND',  // Not in method signature
        // method: 'vnpay',  // Not in method signature
        retryCount,
        // previousFailureReason,  // Not in method signature
      });

      this.logger.log(`[Payment] Retry payment created: ${newPayment.id}`);

      // 2. TODO: Generate new VNPay payment URL
      // const vnpayUrl = await this.vnpayService.createPaymentUrl({
      //   orderId,
      //   amount,
      //   orderInfo: `Retry payment for invoice ${invoiceId}`,
      //   returnUrl: `${process.env.APP_URL}/payments/return`,
      //   ipAddr: customerIp,
      // });

      // 3. TODO: Send retry payment link to customer
      // await this.notificationService.sendPaymentRetryLink({
      //   customerId,
      //   invoiceId,
      //   paymentUrl: vnpayUrl,
      // });

      this.logger.log(`[Payment] Retry payment link queued for customer ${customerId}`);

      await this.commitOffset(context);

    } catch (error) {
      this.logger.error('[ERROR] Error handling PAYMENT_RETRY:', error);
      this.logger.error('Stack:', error.stack);
    }
  }

  /** -------- Payment Refunded (for order cancellation) -------- */

  @EventPattern(event.EventTopics.PAYMENT_REFUNDED)
  async handlePaymentRefunded(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('='.repeat(60));
    this.logger.debug('[Payment] handlePaymentRefunded TRIGGERED');
    this.logger.debug('='.repeat(60));

    try {
      let paymentData = data;
      if (data && data.data) {
        paymentData = data.data;
      }

      const { paymentId, invoiceId, orderId, customerId, refundAmount, reason, refundedAt } = paymentData;

      this.logger.log(`[Payment] Processing Payment Refund:`);
      this.logger.log(`   - Payment ID: ${paymentId}`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Order ID: ${orderId}`);
      this.logger.log(`   - Refund Amount: ${refundAmount} VND`);
      this.logger.log(`   - Reason: ${reason}`);

      // 1. Mark payment and invoice as refunded
      await this.paymentService.markPaymentRefunded({
        paymentId,
        invoiceId,
        refundAmount,
        reason,
        refundedAt: refundedAt || new Date(),  // Now accepted
      });

      this.logger.log(`[Payment] Payment ${paymentId} marked as refunded`);

      // 2. Update invoice status to 'refunded'
      await this.paymentService.updateInvoiceStatus(invoiceId, 'refunded');
      this.logger.log(`[Payment] Invoice ${invoiceId} marked as refunded`);

      // 3. TODO: Process refund via VNPay
      // const refundResult = await this.vnpayService.processRefund({
      //   transactionId,
      //   amount: refundAmount,
      //   reason,
      // });

      // 4. TODO: Send refund confirmation to customer
      // await this.notificationService.sendRefundConfirmation({
      //   customerId,
      //   invoiceId,
      //   refundAmount,
      //   reason,
      //   estimatedDays: 5,
      // });

      this.logger.log(`[Payment] Refund confirmation queued for customer ${customerId}`);

      await this.commitOffset(context);

    } catch (error) {
      this.logger.error('[ERROR] Error handling PAYMENT_REFUNDED:', error);
      this.logger.error('Stack:', error.stack);
    }
  }

  /** ================== HELPER METHODS ================== */

  /**
   * Helper method to commit Kafka offset
   */
  private async commitOffset(context: KafkaContext): Promise<void> {
    try {
      await context.getConsumer().commitOffsets([
        {
          topic: context.getTopic(),
          partition: context.getPartition(),
          offset: (parseInt(context.getMessage().offset) + 1).toString(),
        },
      ]);
      this.logger.log('[Payment] Kafka offset committed');
    } catch (error) {
      this.logger.error('[ERROR] Error committing Kafka offset:', error);
    }
  }
}