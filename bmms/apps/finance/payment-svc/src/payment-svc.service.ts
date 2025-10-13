import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentHistory } from './entities/payment-history.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
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

      // Create new payment record
      const payment = this.paymentRepository.create({
        invoiceId: dto.invoiceId,
        invoiceNumber: dto.invoiceNumber,
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
        `Payment initiated for invoice ${dto.invoiceNumber}`,
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
        payment.transactionId = dto.transactionId;
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
        payment.failureReason = dto.reason || 'Payment failed';
        payment.failedAt = new Date();

        this.logger.log(`❌ Payment failed: ${payment.failureReason}`);

        await this.logPaymentHistory(
          payment.id,
          payment.invoiceId,
          'failed',
          dto.reason || 'Payment failed',
        );
      }

      const updated = await this.paymentRepository.save(payment);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error confirming payment:`, error);
      throw error;
    }
  }

  // =================== GET PAYMENT BY ID ===================
  /**
   * Lấy thông tin thanh toán theo ID
   */
  async getById(id: number): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: id.toString() },
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
    paymentId: string;
    invoiceId: number;
    amount: number;
    transactionId: string;
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
    paymentId: string;
    invoiceId: number;
    reason: string;
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
    paymentId: string | number,
    invoiceId: number,
    action: 'initiated' | 'processing' | 'success' | 'failed' | 'refunded',
    details?: string,
  ) {
    try {
      const history = this.paymentHistoryRepository.create({
        paymentId: typeof paymentId === 'string' ? paymentId : paymentId.toString(),
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
  }
}