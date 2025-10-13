
// ============ payment.event-listener.ts ============

import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import * as event from '@bmms/event';
import { PaymentService } from './payment-svc.service';

@Controller()
export class PaymentEventListener {
  private readonly logger = new Logger(PaymentEventListener.name);

  constructor(private readonly paymentService: PaymentService) {}

  /** -------- Invoice Events -------- */

  @EventPattern('invoice.created')
  async handleInvoiceCreated(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('='.repeat(60));
    this.logger.debug('🎉 handleInvoiceCreated TRIGGERED');
    this.logger.debug('='.repeat(60));

    try {
      // Extract data (Kafka sends full event, but @Payload() gets all fields)
      let invoiceData = data;
      if (data && data.data) {
        invoiceData = data.data;
      }

      const { invoiceId, invoiceNumber, customerId, totalAmount, dueDate } =
        invoiceData;

      this.logger.log(`📊 Processing Invoice:`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Invoice Number: ${invoiceNumber}`);
      this.logger.log(`   - Customer ID: ${customerId}`);
      this.logger.log(`   - Total Amount: ${totalAmount}`);
      this.logger.log(`   - Due Date: ${dueDate}`);

      // Validate required fields
      if (!invoiceId || !invoiceNumber || !customerId) {
        this.logger.error('❌ Missing required invoice fields');
        return;
      }

      // ✅ YOUR BUSINESS LOGIC HERE
      // 1. Store invoice in Payment database
      await this.paymentService.registerInvoice({
        invoiceId,
        invoiceNumber,
        customerId,
        totalAmount,
        dueDate,
      });

      this.logger.log(
        `✅ Invoice ${invoiceNumber} registered in payment system`,
      );

      // 2. Send invoice to customer (commented for now)
      // await this.notificationService.sendInvoiceToCustomer({
      //   customerId,
      //   invoiceNumber,
      //   totalAmount,
      //   dueDate,
      // });

      // 3. Check if payment already made (for cases where payment comes before invoice)
      const existingPayment =
        await this.paymentService.findByInvoiceId(invoiceId);
      if (existingPayment) {
        this.logger.log(
          `⚠️ Payment already exists for invoice ${invoiceNumber}`,
        );
      }

      // ✅ Commit Kafka offset after successful processing
      await context.getConsumer().commitOffsets([
        {
          topic: context.getTopic(),
          partition: context.getPartition(),
          offset: (parseInt(context.getMessage().offset) + 1).toString(),
        },
      ]);
      this.logger.log('✅ Message committed to Kafka');

    } catch (error) {
      this.logger.error('❌ Error handling INVOICE_CREATED:', error);
      this.logger.error('Stack:', error.stack);
      // ⚠️ Don't commit offset on error, so message will be retried
    }
  }

  /** -------- Payment Success -------- */

  @EventPattern('payment.success')
  async handlePaymentSuccess(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('🎉 handlePaymentSuccess TRIGGERED');

    try {
      let paymentData = data;
      if (data && data.data) {
        paymentData = data.data;
      }

      const { paymentId, invoiceId, amount, transactionId } = paymentData;

      this.logger.log(`💳 Processing Payment:`);
      this.logger.log(`   - Payment ID: ${paymentId}`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Amount: ${amount}`);
      this.logger.log(`   - Transaction ID: ${transactionId}`);

      if (!paymentId || !invoiceId || !amount) {
        this.logger.error('❌ Missing required payment fields');
        return;
      }

      // ✅ YOUR BUSINESS LOGIC HERE
      // 1. Update payment record status
      await this.paymentService.markPaymentSuccess({
        paymentId,
        invoiceId,
        amount,
        transactionId,
      });

      this.logger.log(`✅ Payment ${paymentId} marked as successful`);

      // 2. Update invoice status
      await this.paymentService.updateInvoiceStatus(invoiceId, 'paid');
      this.logger.log(`✅ Invoice ${invoiceId} marked as paid`);

      // 3. Send confirmation to customer
      // await this.notificationService.sendPaymentConfirmation({
      //   customerId,
      //   invoiceId,
      //   amount,
      //   transactionId,
      // });

      // ✅ Commit offset
      await context.getConsumer().commitOffsets([
        {
          topic: context.getTopic(),
          partition: context.getPartition(),
          offset: (parseInt(context.getMessage().offset) + 1).toString(),
        },
      ]);

      this.logger.log('✅ Message committed to Kafka');

    } catch (error) {
      this.logger.error('❌ Error handling PAYMENT_SUCCESS:', error);
    }
  }

  /** -------- Payment Failed -------- */

  @EventPattern('payment.failed')
  async handlePaymentFailed(
    @Payload() data: any,
    @Ctx() context: KafkaContext,
  ) {
    this.logger.debug('🎉 handlePaymentFailed TRIGGERED');

    try {
      let paymentData = data;
      if (data && data.data) {
        paymentData = data.data;
      }

      const { paymentId, invoiceId, reason } = paymentData;

      this.logger.log(`⚠️ Payment Failed:`);
      this.logger.log(`   - Payment ID: ${paymentId}`);
      this.logger.log(`   - Invoice ID: ${invoiceId}`);
      this.logger.log(`   - Reason: ${reason}`);

      if (!paymentId || !invoiceId) {
        this.logger.error('❌ Missing required payment fields');
        return;
      }

      // ✅ YOUR BUSINESS LOGIC HERE
      // 1. Mark payment as failed
      await this.paymentService.markPaymentFailed({
        paymentId,
        invoiceId,
        reason,
      });

      this.logger.log(`✅ Payment ${paymentId} marked as failed`);

      // 2. Keep invoice status as pending/unpaid
      await this.paymentService.updateInvoiceStatus(invoiceId, 'pending');

      // 3. Send retry notification
      // await this.notificationService.sendPaymentFailureNotice({
      //   invoiceId,
      //   reason,
      //   retryUrl: `${process.env.APP_URL}/payments/retry/${invoiceId}`,
      // });

      // ✅ Commit offset
      await context.getConsumer().commitOffsets([
        {
          topic: context.getTopic(),
          partition: context.getPartition(),
          offset: (parseInt(context.getMessage().offset) + 1).toString(),
        },
      ]);

      this.logger.log('✅ Message committed to Kafka');

    } catch (error) {
      this.logger.error('❌ Error handling PAYMENT_FAILED:', error);
    }
  }
}