import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentHistory } from './entities/payment-history.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { SubscriptionPaymentDto, SubscriptionPaymentResponseDto } from './dto/subscription-payment.dto';
import { ClientKafka } from '@nestjs/microservices';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    @Inject('EVENT_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  // =================== INITIATE PAYMENT ===================
  /**
   * Khởi tạo thanh toán mới từ invoice
   */
  async initiatePayment(dto: CreatePaymentDto): Promise<Payment> {
    try {
      this.logger.log(`📝 Initiating payment for invoice ${dto.invoiceId}`);

      // Check if payment already exists for invoice
      const existing = await this.paymentRepository.findOne({
        where: { invoiceId: dto.invoiceId },
      });

      if (existing && existing.status === 'completed') {
        throw new BadRequestException(
          `Invoice ${dto.invoiceId} already paid`,
        );
      }

      // Generate invoiceNumber if not provided
      const invoiceNumber = dto.invoiceNumber || `INV-${dto.invoiceId}-${Date.now()}`;

      // Create new payment record
      const payment = this.paymentRepository.create({
        invoiceId: dto.invoiceId,
        invoiceNumber: invoiceNumber,
        customerId: dto.customerId,
        totalAmount: dto.amount,
        status: 'initiated',
        createdAt: new Date(),
      });

      const savedPayment = await this.paymentRepository.save(payment);

      // Log payment history
      await this.logPaymentHistory(
        savedPayment.id,
        dto.invoiceId,
        'initiated',
        `Payment initiated for invoice ${invoiceNumber}`,
      );

      this.logger.log(`✅ Payment initiated: ${savedPayment.id}`);
      return savedPayment;
    } catch (error) {
      this.logger.error(`❌ Error initiating payment:`, error);
      throw error;
    }
  }

  // =================== CONFIRM PAYMENT ===================
  /**
   * Xác nhận thanh toán (thường được gọi từ Payment Gateway callback)
   */
  async confirmPayment(dto: ConfirmPaymentDto): Promise<Payment> {
    try {
      this.logger.log(`💳 Confirming payment ${dto.paymentId}`);

      // Find payment record
      const payment = await this.paymentRepository.findOne({
        where: { id: dto.paymentId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${dto.paymentId} not found`);
      }

      if (payment.status === 'completed') {
        this.logger.warn(`⚠️ Payment already completed: ${dto.paymentId}`);
        return payment;
      }

      // Update payment status
      if (dto.status === 'success') {
        payment.status = 'completed';
        payment.transactionId = dto.transactionId || '';
        payment.paidAmount = dto.amount || payment.totalAmount;
        payment.paidAt = new Date();

        this.logger.log(`✅ Payment successful: ${payment.transactionId}`);

        await this.logPaymentHistory(
          payment.id,
          payment.invoiceId,
          'success',
          `Payment successful via ${dto.method || 'unknown'}`,
        );
      } else if (dto.status === 'failed') {
        payment.status = 'failed';
        payment.failureReason = dto.failureReason || 'Payment failed';
        payment.failedAt = new Date();

        this.logger.log(`❌ Payment failed: ${payment.failureReason}`);

        await this.logPaymentHistory(
          payment.id,
          payment.invoiceId,
          'failed',
          dto.failureReason || 'Payment failed',
        );
      }

      const updated = await this.paymentRepository.save(payment);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error confirming payment:`, error);
      throw error;
    }
  }

  // =================== SUBSCRIPTION PAYMENT ===================
  /**
   * Xử lý thanh toán subscription
   * - Tạo payment record
   * - Mock thanh toán (sau này thay bằng VNPay/Momo)
   * - Emit event payment.success để billing và subscription service xử lý
   */
  async processSubscriptionPayment(dto: SubscriptionPaymentDto): Promise<SubscriptionPaymentResponseDto> {
    try {
      this.logger.log(`💳 Processing subscription payment for subscription ${dto.subscriptionId}`);
      this.logger.log(`   Customer: ${dto.customerId}`);
      this.logger.log(`   Amount: ${dto.amount}`);
      this.logger.log(`   Plan: ${dto.planName || 'N/A'}`);

      // Generate transaction ID (mock - sau này sẽ từ VNPay/Momo)
      const transactionId = `SUB-TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      
      // Generate invoice number for subscription
      const invoiceNumber = `INV-SUB-${Date.now()}`;

      // Create payment record
      const payment = this.paymentRepository.create({
        invoiceId: 0, // Will be updated when billing creates invoice
        invoiceNumber: invoiceNumber,
        customerId: dto.customerId,
        totalAmount: dto.amount,
        paidAmount: dto.amount,
        status: 'completed',
        transactionId: transactionId,
        createdAt: new Date(),
        paidAt: new Date(),
      });

      const savedPayment = await this.paymentRepository.save(payment);
      this.logger.log(`✅ Payment record created: ${savedPayment.id}`);

      // Log payment history
      await this.logPaymentHistory(
        savedPayment.id,
        0, // No invoice ID yet
        'success',
        `Subscription payment for ${dto.planName || 'subscription'} - Transaction: ${transactionId}`,
      );

      // ⭐ Emit subscription.payment.success event
      // Billing và Subscription service sẽ lắng nghe event này
      this.logger.log(`📤 Emitting subscription.payment.success event...`);
      
      this.kafkaClient.emit('subscription.payment.success', {
        eventId: crypto.randomUUID(),
        eventType: 'subscription.payment.success',
        timestamp: new Date(),
        source: 'payment-svc',
        data: {
          paymentId: savedPayment.id,
          subscriptionId: dto.subscriptionId,
          customerId: dto.customerId,
          amount: dto.amount,
          currency: dto.currency || 'VND',
          method: dto.paymentMethod || 'CREDIT_CARD',
          transactionId: transactionId,
          planName: dto.planName,
          paidAt: new Date(),
        },
      });

      this.logger.log(`✅ Subscription payment completed successfully`);

      return {
        success: true,
        message: 'Thanh toán thành công',
        transactionId: transactionId,
        paymentId: savedPayment.id,
        invoiceId: 0, // Will be created by billing service
        paidAt: new Date(),
      };

    } catch (error) {
      this.logger.error(`❌ Error processing subscription payment:`, error);
      
      // Emit failure event
      this.kafkaClient.emit('subscription.payment.failed', {
        eventId: crypto.randomUUID(),
        eventType: 'subscription.payment.failed',
        timestamp: new Date(),
        source: 'payment-svc',
        data: {
          subscriptionId: dto.subscriptionId,
          customerId: dto.customerId,
          amount: dto.amount,
          reason: error.message || 'Payment processing failed',
          canRetry: true,
        },
      });

      throw new BadRequestException(error.message || 'Thanh toán thất bại');
    }
  }

  // =================== GET PAYMENT BY ID ===================
  /**
   * Lấy thông tin thanh toán theo ID
   */
  async getById(id: number): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${id} not found`);
      }

      return payment;
    } catch (error) {
      this.logger.error(`❌ Error getting payment by ID:`, error);
      throw error;
    }
  }

  // =================== GET PAYMENTS BY INVOICE ===================
  /**
   * Lấy danh sách thanh toán theo hóa đơn
   */
  async getByInvoice(invoiceId: number): Promise<Payment[]> {
    try {
      this.logger.log(`🔍 Getting payments for invoice ${invoiceId}`);

      const payments = await this.paymentRepository.find({
        where: { invoiceId },
        order: { createdAt: 'DESC' },
      });

      return payments;
    } catch (error) {
      this.logger.error(`❌ Error getting payments by invoice:`, error);
      throw error;
    }
  }

  // =================== LIST ALL PAYMENTS ===================
  /**
   * Danh sách tất cả các thanh toán
   */
  async list(): Promise<Payment[]> {
    try {
      const payments = await this.paymentRepository.find({
        order: { createdAt: 'DESC' },
      });

      this.logger.log(`📋 Retrieved ${payments.length} payments`);
      return payments;
    } catch (error) {
      this.logger.error(`❌ Error listing payments:`, error);
      throw error;
    }
  }

  // =================== PAYMENT STATISTICS ===================
  /**
   * Thống kê thanh toán tổng hợp
   */
  async getPaymentStats(): Promise<any> {
    try {
      this.logger.log(`📊 Generating payment statistics`);

      // Total statistics
      const total = await this.paymentRepository.find();
      const completed = total.filter((p) => p.status === 'completed');
      const failed = total.filter((p) => p.status === 'failed');
      const pending = total.filter((p) => p.status === 'initiated' || p.status === 'processing');

      // Calculate amounts
      const totalAmount = total.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
      const completedAmount = completed.reduce(
        (sum, p) => sum + (p.paidAmount || p.totalAmount || 0),
        0,
      );
      const pendingAmount = pending.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

      // Aggregate by status
      const byStatus = {
        initiated: total.filter((p) => p.status === 'initiated').length,
        processing: total.filter((p) => p.status === 'processing').length,
        completed: completed.length,
        failed: failed.length,
      };

      const stats = {
        summary: {
          totalPayments: total.length,
          completedPayments: completed.length,
          failedPayments: failed.length,
          pendingPayments: pending.length,
        },
        amounts: {
          totalAmount: totalAmount,
          completedAmount: completedAmount,
          pendingAmount: pendingAmount,
          failureRate: total.length > 0 
            ? ((failed.length / total.length) * 100).toFixed(2) + '%' 
            : '0%',
        },
        byStatus: byStatus,
        recentTransactions: total.slice(0, 10), // Last 10 transactions
      };

      this.logger.log(`✅ Payment statistics generated`);
      return stats;
    } catch (error) {
      this.logger.error(`❌ Error generating payment stats:`, error);
      throw error;
    }
  }

  // =================== EVENT HANDLERS (From Kafka) ===================

  /**
   * Xử lý event INVOICE_CREATED từ Billing service
   */
  async registerInvoice(invoiceData: {
    invoiceId: number;
    invoiceNumber: string;
    orderId?: number | null;  // Optional orderId
    customerId: number;
    totalAmount: number;
    dueDate: Date;
  }) {
    try {
      this.logger.log(
        `📝 Registering invoice ${invoiceData.invoiceNumber}`,
      );

      // Check if invoice already registered
      const existing = await this.paymentRepository.findOne({
        where: { invoiceId: invoiceData.invoiceId },
      });

      if (existing) {
        this.logger.warn(
          `⚠️ Invoice already registered: ${invoiceData.invoiceNumber}`,
        );
        return existing;
      }

      // Create payment record for invoice
      const payment = this.paymentRepository.create({
        invoiceId: invoiceData.invoiceId,
        invoiceNumber: invoiceData.invoiceNumber,
        customerId: invoiceData.customerId,
        totalAmount: invoiceData.totalAmount,
        status: 'initiated',
        dueDate: invoiceData.dueDate,
        createdAt: new Date(),
      });

      const saved = await this.paymentRepository.save(payment);

      await this.logPaymentHistory(
        saved.id,
        invoiceData.invoiceId,
        'initiated',
        `Invoice registered from billing service`,
      );

      this.logger.log(
        `✅ Invoice registered: ${invoiceData.invoiceNumber}`,
      );

      return saved;
    } catch (error) {
      this.logger.error(`❌ Error registering invoice:`, error);
      throw error;
    }
  }

  /**
   * Tìm payment record theo invoice ID
   */
  async findByInvoiceId(invoiceId: number) {
    return this.paymentRepository.findOne({
      where: { invoiceId },
    });
  }

  /**
   * Đánh dấu thanh toán thành công
   */
  async markPaymentSuccess(data: {
    paymentId: number;
    invoiceId: number;
    amount: number;
    method?: string;  // Optional
    transactionId: string;
    paidAt?: Date;  // Optional
  }) {
    try {
      this.logger.log(
        `💳 Marking payment as successful: ${data.paymentId}`,
      );

      const payment = await this.paymentRepository.findOne({
        where: { invoiceId: data.invoiceId },
      });

      if (!payment) {
        this.logger.warn(
          `⚠️ Payment record not found for invoice ${data.invoiceId}`,
        );
        return;
      }

      payment.status = 'completed';
      payment.transactionId = data.transactionId;
      payment.paidAmount = data.amount;
      payment.paidAt = new Date();

      const updated = await this.paymentRepository.save(payment);

      await this.logPaymentHistory(
        payment.id,
        data.invoiceId,
        'success',
        `Payment successful - Transaction: ${data.transactionId}`,
      );

      this.logger.log(`✅ Payment marked as successful`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error marking payment as successful:`, error);
      throw error;
    }
  }

  /**
   * Đánh dấu thanh toán thất bại
   */
  async markPaymentFailed(data: {
    paymentId: number;
    invoiceId: number;
    reason: string;
    errorCode?: string;  // Optional
  }) {
    try {
      this.logger.log(`❌ Marking payment as failed: ${data.paymentId}`);

      const payment = await this.paymentRepository.findOne({
        where: { invoiceId: data.invoiceId },
      });

      if (!payment) {
        this.logger.warn(
          `⚠️ Payment record not found for invoice ${data.invoiceId}`,
        );
        return;
      }

      payment.status = 'failed';
      payment.failureReason = data.reason;
      payment.failedAt = new Date();

      const updated = await this.paymentRepository.save(payment);

      await this.logPaymentHistory(
        payment.id,
        data.invoiceId,
        'failed',
        `Payment failed - Reason: ${data.reason}`,
      );

      this.logger.log(`✅ Payment marked as failed`);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error marking payment as failed:`, error);
      throw error;
    }
  }

  /**
   * Cập nhật trạng thái hóa đơn
   */
  async updateInvoiceStatus(invoiceId: number, status: string) {
    try {
      this.logger.log(
        `🔄 Updating invoice ${invoiceId} status to ${status}`,
      );

      await this.paymentRepository.update(
        { invoiceId },
        { status: "completed", updatedAt: new Date() },
      );

      this.logger.log(`✅ Invoice status updated to ${status}`);
    } catch (error) {
      this.logger.error(`❌ Error updating invoice status:`, error);
      throw error;
    }
  }

  // =================== HELPER METHODS ===================

  /**
   * Log payment history
   */
  private async logPaymentHistory(
    paymentId: number,
    invoiceId: number,
    action: 'initiated' | 'processing' | 'success' | 'failed' | 'refunded',
    details?: string,
  ) {
    try {
      const history = this.paymentHistoryRepository.create({
        paymentId,
        invoiceId,
        action,
        details,
        createdAt: new Date(),
      });

      await this.paymentHistoryRepository.save(history);
    } catch (error) {
      this.logger.error(`⚠️ Error logging payment history:`, error);
    }
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }  /**
   * Create pending payment (stub for event listener)
   */
  async createPendingPayment(data: {
    invoiceId: number;
    invoiceNumber: string;
    orderId: number | null;
    customerId: number;
    amount: number;
    currency: string;
    method: string;
    status: string;
  }): Promise<Payment> {
    this.logger.log(`📝 Creating pending payment for invoice ${data.invoiceNumber}`);
    
    const payment = this.paymentRepository.create({
      invoiceId: data.invoiceId,
      invoiceNumber: data.invoiceNumber,
      customerId: data.customerId,
      totalAmount: data.amount,
      status: 'initiated', // Use enum value instead of data.status
      createdAt: new Date(),
    });

    const savedPayment = await this.paymentRepository.save(payment);
    this.logger.log(`✅ Pending payment created: ${savedPayment.id}`);
    
    return savedPayment;
  }



// =================== STUB METHODS FOR EVENT HANDLERS ===================

  /**
   * Create retry payment attempt (stub for future VNPay integration)
   */
  async createRetryPayment(data: {
    originalPaymentId: number;
    invoiceId: number;
    orderId: number | null;
    customerId: number | null;
    amount: number;
    retryCount: number;
  }): Promise<Payment> {
    this.logger.log(`🔄 Creating retry payment for invoice ${data.invoiceId} (attempt #${data.retryCount})`);
    
    // TODO: Implement retry payment creation logic
    const payment = this.paymentRepository.create({
      invoiceId: data.invoiceId,
      customerId: data.customerId || 0, // Use 0 as default if null
      totalAmount: data.amount,
      status: 'initiated',
      createdAt: new Date(),
    });

    const savedPayment = await this.paymentRepository.save(payment);
    this.logger.log(`✅ Retry payment created: ${savedPayment.id}`);
    
    return savedPayment;
  }

  /**
   * Mark payment as refunded (stub for future VNPay integration)
   */
  async markPaymentRefunded(data: {
    paymentId: string;
    invoiceId: number;
    refundAmount: number;
    reason: string;
    refundedAt?: Date;  // Add optional refundedAt
  }): Promise<void> {
    this.logger.log(`💰 Marking payment ${data.paymentId} as refunded`);
    
    const paymentId = parseInt(data.paymentId, 10);
    
    // TODO: Implement refund logic
    // For now, mark as failed (since refunded is not in enum)
    await this.paymentRepository.update(
      { id: paymentId },
      { 
        status: 'failed', // Use 'failed' as closest enum value
        failureReason: `REFUNDED: ${data.reason}`,
        updatedAt: new Date(),
      }
    );

    await this.logPaymentHistory(
      paymentId,
      data.invoiceId,
      'refunded',
      `Refunded ${data.refundAmount} VND. Reason: ${data.reason}`,
    );

    this.logger.log(`✅ Payment ${data.paymentId} marked as refunded`);
  }

  // =================== EVENT EMITTER METHODS FOR TESTING ===================

  /**
   * Emit payment.success event (for testing flow)
   */
  async emitPaymentSuccess(data: {
    paymentId: number;
    invoiceId: number;
    orderId: number | null;
    customerId: number | null;
    amount: number;
    method: string;
    transactionId: string;
    paidAt?: Date;
  }): Promise<void> {
    this.logger.log(`📤 Emitting payment.success event for payment ${data.paymentId}`);
    
    this.kafkaClient.emit('payment.success', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.success',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: data.paymentId,
        invoiceId: data.invoiceId,
        orderId: data.orderId,
        customerId: data.customerId,
        amount: data.amount,
        method: data.method,
        transactionId: data.transactionId,
        paidAt: data.paidAt || new Date(),
      },
    });

    this.logger.log(`✅ payment.success event emitted`);
  }

  /**
   * Emit payment.failed event (for testing flow)
   */
  async emitPaymentFailed(data: {
    paymentId: number;
    invoiceId: number;
    orderId: number | null;
    customerId: number | null;
    amount: number;
    method: string;
    reason: string;
    errorCode?: string;
    canRetry?: boolean;
  }): Promise<void> {
    this.logger.log(`📤 Emitting payment.failed event for payment ${data.paymentId}`);
    
    this.kafkaClient.emit('payment.failed', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.failed',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: data.paymentId,
        invoiceId: data.invoiceId,
        orderId: data.orderId,
        customerId: data.customerId,
        amount: data.amount,
        method: data.method,
        reason: data.reason,
        errorCode: data.errorCode || 'UNKNOWN',
        canRetry: data.canRetry !== undefined ? data.canRetry : true,
      },
    });

    this.logger.log(`✅ payment.failed event emitted`);
  }

  /**
   * Emit payment.retry event (for testing flow)
   */
  async emitPaymentRetry(data: {
    paymentId: number;
    invoiceId: number;
    orderId: number | null;
    customerId: number | null;
    amount: number;
    retryCount: number;
    previousFailureReason: string;
  }): Promise<void> {
    this.logger.log(`📤 Emitting payment.retry event for payment ${data.paymentId}`);
    
    this.kafkaClient.emit('payment.retry', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.retry',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: data.paymentId,
        invoiceId: data.invoiceId,
        orderId: data.orderId,
        customerId: data.customerId,
        amount: data.amount,
        retryCount: data.retryCount,
        previousFailureReason: data.previousFailureReason,
      },
    });

    this.logger.log(`✅ payment.retry event emitted`);
  }

  /**
   * Emit payment.initiated event (called from event listener)
   */
  async emitPaymentInitiated(data: {
    paymentId: number;
    invoiceId: number;
    orderId: number | null;
    customerId: number | null;
    amount: number;
    currency: string;
    method: string;
    paymentUrl?: string;
  }): Promise<void> {
    this.logger.log(`📤 Emitting payment.initiated event for payment ${data.paymentId}`);
    
    this.kafkaClient.emit('payment.initiated', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.initiated',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: data.paymentId,
        invoiceId: data.invoiceId,
        invoiceNumber: `INV-${data.invoiceId}`,
        orderId: data.orderId,
        customerId: data.customerId,
        amount: data.amount,
        currency: data.currency,
        method: data.method,
        paymentUrl: data.paymentUrl || `http://localhost:3000/payments/${data.paymentId}`,
      },
    });

    this.logger.log(`✅ payment.initiated event emitted`);
  }

  /**
   * Emit payment.refunded event (for testing flow)
   */
  async emitPaymentRefunded(data: {
    paymentId: number;
    invoiceId: number;
    orderId: number | null;
    customerId: number | null;
    refundAmount: number;
    reason: string;
    refundedAt?: Date;
  }): Promise<void> {
    this.logger.log(`📤 Emitting payment.refunded event for payment ${data.paymentId}`);
    
    this.kafkaClient.emit('payment.refunded', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.refunded',
      timestamp: new Date(),
      source: 'payment-svc',
      data: {
        paymentId: data.paymentId,
        invoiceId: data.invoiceId,
        orderId: data.orderId,
        customerId: data.customerId,
        refundAmount: data.refundAmount,
        reason: data.reason,
        refundedAt: data.refundedAt || new Date(),
      },
    });

    this.logger.log(`✅ payment.refunded event emitted`);
  }

}