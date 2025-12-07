import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import * as crypto from 'crypto';

import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { InvoiceHistory } from './entities/invoice-history.entity';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { PaymentRecordDto } from './dto/payment-record.dto';
import { EventTopics } from '@bmms/event';

// Import billing strategies
import { BillingStrategyService } from './strategies/billing-strategy.service';

// Debug flag - set to false to reduce console output
const DEBUG = process.env.BILLING_DEBUG === 'true';
const log = (...args: any[]) => DEBUG && console.log(...args);


@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,

    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,

    @InjectRepository(InvoiceHistory)
    private readonly historyRepo: Repository<InvoiceHistory>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,

    // Inject billing strategy service
    private readonly billingStrategy: BillingStrategyService,
  ) {}

  // ============= CRUD =============

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    // Check if invoice already exists for this order (only if orderId is provided)
    if (dto.orderId) {
      const existing = await this.invoiceRepo.findOne({
        where: { orderId: dto.orderId },
      });

      if (existing) {
        throw new ConflictException(`Invoice for order ${dto.orderId} already exists`);
      }
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    // Parse dueDate - handle both string and Date
    let dueDate: Date;
    if (dto.dueDate) {
      dueDate = typeof dto.dueDate === 'string' ? new Date(dto.dueDate) : dto.dueDate;
    } else {
      dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    }

    const invoice = await this.invoiceRepo.save(
      this.invoiceRepo.create({
        invoiceNumber,
        orderId: dto.orderId,
        orderNumber: dto.orderNumber,
        customerId: dto.customerId,
        subtotal: dto.subtotal || 0,
        tax: dto.tax || 0,
        shippingCost: dto.shippingCost || 0,
        discount: dto.discount || 0,
        totalAmount: dto.totalAmount,
        dueAmount: dto.totalAmount,
        dueDate: dueDate,
        notes: dto.notes,
        status: 'draft',
      }),
    );

    // Create items
    const items = await Promise.all(
      dto.items.map((item) =>
        this.itemRepo.save(
          this.itemRepo.create({
            invoiceId: invoice.id,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          }),
        ),
      ),
    );

    invoice.items = items;

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'created',
        details: `Invoice created for order ${dto.orderNumber}`,
      }),
    );

    // Emit event (no verbose logging)
    this.kafka.emit(EventTopics.INVOICE_CREATED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVOICE_CREATED,
      timestamp: new Date(),
      source: 'billing-svc',
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderId: invoice.orderId,
        orderNumber: invoice.orderNumber,
        customerId: invoice.customerId,
        totalAmount: invoice.totalAmount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        createdAt: invoice.createdAt,
      },
    });

    return invoice;
  }

  async list(options?: {
    page?: number;
    limit?: number;
    includeCancelled?: boolean;
  }): Promise<{ invoices: Invoice[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;
    const includeCancelled = options?.includeCancelled || false;

    const queryBuilder = this.invoiceRepo.createQueryBuilder('invoice');

    // DON'T load relations for list - improves performance significantly
    // Relations will be loaded only when getting single invoice by ID

    // Exclude cancelled invoices by default
    if (!includeCancelled) {
      queryBuilder.andWhere('invoice.status != :cancelled', { cancelled: 'cancelled' });
    }

    // Select only necessary columns for list view
    queryBuilder
      .select([
        'invoice.id',
        'invoice.invoiceNumber',
        'invoice.orderNumber',
        'invoice.customerId',
        'invoice.status',
        'invoice.totalAmount',
        'invoice.paidAmount',
        'invoice.dueAmount',
        'invoice.dueDate',
        'invoice.createdAt',
      ])
      .orderBy('invoice.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [invoices, total] = await queryBuilder.getManyAndCount();

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listByCustomer(customerId: string, options?: {
    page?: number;
    limit?: number;
    includeCancelled?: boolean;
  }): Promise<{ invoices: Invoice[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const skip = (page - 1) * limit;
    const includeCancelled = options?.includeCancelled || false;

    const queryBuilder = this.invoiceRepo.createQueryBuilder('invoice')
      .where('invoice.customerId = :customerId', { customerId });

    if (!includeCancelled) {
      queryBuilder.andWhere('invoice.status != :cancelled', { cancelled: 'cancelled' });
    }

    // Select only necessary columns
    queryBuilder
      .select([
        'invoice.id',
        'invoice.invoiceNumber',
        'invoice.orderNumber',
        'invoice.customerId',
        'invoice.status',
        'invoice.totalAmount',
        'invoice.paidAmount',
        'invoice.dueAmount',
        'invoice.dueDate',
        'invoice.createdAt',
      ])
      .orderBy('invoice.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [invoices, total] = await queryBuilder.getManyAndCount();

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listBySubscription(subscriptionId: string, options?: {
    page?: number;
    limit?: number;
    includeCancelled?: boolean;
  }): Promise<{ invoices: Invoice[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const skip = (page - 1) * limit;
    const includeCancelled = options?.includeCancelled || false;

    const queryBuilder = this.invoiceRepo.createQueryBuilder('invoice')
      .where('invoice.subscriptionId = :subscriptionId', { subscriptionId });

    if (!includeCancelled) {
      queryBuilder.andWhere('invoice.status != :cancelled', { cancelled: 'cancelled' });
    }

    // Select only necessary columns
    queryBuilder
      .select([
        'invoice.id',
        'invoice.invoiceNumber',
        'invoice.subscriptionId',
        'invoice.customerId',
        'invoice.status',
        'invoice.totalAmount',
        'invoice.paidAmount',
        'invoice.dueAmount',
        'invoice.dueDate',
        'invoice.createdAt',
      ])
      .orderBy('invoice.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [invoices, total] = await queryBuilder.getManyAndCount();

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['items', 'payments'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    return invoice;
  }

  async getByInvoiceNumber(invoiceNumber: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { invoiceNumber },
      relations: ['items', 'payments'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceNumber} not found`);
    }

    return invoice;
  }

  // ============= STATUS MANAGEMENT =============

  async updateStatus(id: string, dto: UpdateInvoiceStatusDto): Promise<Invoice> {
    const invoice = await this.getById(id);
    const previousStatus = invoice.status;

    invoice.status = dto.status;

    if (dto.status === 'sent') {
      invoice.issuedAt = new Date();
    }

    const updated = await this.invoiceRepo.save(invoice);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'status_changed',
        details: `Status changed from ${previousStatus} to ${dto.status}. ${dto.notes || ''}`,
      }),
    );

    this.kafka.emit(EventTopics.INVOICE_UPDATED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVOICE_UPDATED,
      timestamp: new Date(),
      source: 'billing-svc',
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        previousStatus,
        newStatus: dto.status,
      },
    });

    return updated;
  }

  /**
   * Update invoice status (simple version for internal use)
   */
  async updateInvoiceStatus(invoiceId: string, status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled'): Promise<void> {
    try {
      const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
      
      if (!invoice) {
        return;
      }

      const previousStatus = invoice.status;
      invoice.status = status;

      if (status === 'sent') {
        invoice.issuedAt = new Date();
      }

      if (status === 'paid') {
        invoice.paidAt = new Date();
        invoice.paidAmount = invoice.totalAmount;
        invoice.dueAmount = 0;
      }

      await this.invoiceRepo.save(invoice);

      // Save history
      await this.historyRepo.save(
        this.historyRepo.create({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'status_changed',
          details: `Status changed from ${previousStatus} to ${status}`,
        }),
      );

      // Emit INVOICE_UPDATED event
      this.kafka.emit(EventTopics.INVOICE_UPDATED, {
        eventId: crypto.randomUUID(),
        eventType: EventTopics.INVOICE_UPDATED,
        timestamp: new Date(),
        source: 'billing-svc',
        data: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customerId,
          previousStatus,
          newStatus: status,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Emit ORDER_COMPLETED event for inventory to deduct stock
   */
  async emitOrderCompleted(orderId: string, invoiceId: string): Promise<void> {
    try {
      this.kafka.emit(EventTopics.ORDER_COMPLETED, {
        eventId: crypto.randomUUID(),
        eventType: EventTopics.ORDER_COMPLETED,
        timestamp: new Date(),
        source: 'billing-svc',
        data: {
          orderId,
          invoiceId,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      // Silent fail
    }
  }

  // ============= PAYMENT MANAGEMENT =============

  async recordPayment(id: string, dto: PaymentRecordDto): Promise<Invoice> {
    const invoice = await this.getById(id);

    if (invoice.isPaid()) {
      throw new BadRequestException(`Invoice ${id} is already paid`);
    }

    if (dto.amount > invoice.getRemainingAmount()) {
      throw new BadRequestException(
        `Payment amount exceeds remaining balance. Remaining: ${invoice.getRemainingAmount()}`,
      );
    }

    // Create payment record
    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        invoiceId: invoice.id,
        method: dto.method,
        amount: dto.amount,
        transactionId: dto.transactionId,
        notes: dto.notes,
      }),
    );

    // Update invoice
    invoice.paidAmount = Number(invoice.paidAmount) + dto.amount;
    invoice.dueAmount = invoice.getRemainingAmount();

    if (invoice.isPaid()) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
    }

    const updated = await this.invoiceRepo.save(invoice);

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'payment_recorded',
        details: `Payment of ${dto.amount} recorded via ${dto.method}. Transaction: ${dto.transactionId}`,
      }),
    );

    this.kafka.emit(EventTopics.PAYMENT_SUCCESS, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.PAYMENT_SUCCESS,
      timestamp: new Date(),
      source: 'billing-svc',
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderId: invoice.orderId,
        customerId: invoice.customerId,
        amount: dto.amount,
        method: dto.method,
        transactionId: dto.transactionId,
      },
    });

    return updated;
  }

  async retryPayment(id: string): Promise<Invoice> {
    const invoice = await this.getById(id);

    if (invoice.isPaid()) {
      throw new BadRequestException(`Invoice ${id} is already paid`);
    }

    // TODO: Implement retry payment logic with payment provider
    // This could integrate with payment gateway APIs

    // Retry logic placeholder
    return invoice;
  }

  // ============= UTILITIES =============

  async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    
    // Use UUID-based approach to completely avoid race conditions
    // Format: INV-YYYY-MM-XXXXXX where XXXXXX is a unique random string
    const uniqueId = crypto.randomBytes(6).toString('hex').toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    
    // Format: INV-2025-11-A1B2C3D4E5F6 (completely unique, no sequence needed)
    return `INV-${year}-${month}-${timestamp}${uniqueId}`;
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    return this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.dueDate <= :today', { today: new Date() })
      .andWhere('invoice.status != :paid', { paid: 'paid' })
      .getMany();
  }

  async markOverdueInvoices(): Promise<void> {
    const overdueInvoices = await this.getOverdueInvoices();

    for (const invoice of overdueInvoices) {
      if (invoice.status !== 'overdue') {
        invoice.status = 'overdue';
        await this.invoiceRepo.save(invoice);

        this.kafka.emit(EventTopics.INVOICE_OVERDUE, {
          eventId: crypto.randomUUID(),
          eventType: EventTopics.INVOICE_OVERDUE,
          timestamp: new Date(),
          source: 'billing-svc',
          data: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerId: invoice.customerId,
            dueAmount: invoice.dueAmount,
            dueDate: invoice.dueDate,
          },
        });
      }
    }
  }

  async getInvoiceStats(customerId: string): Promise<any> {
    // Get all invoices for stats (include cancelled, no pagination limit)
    const result = await this.listByCustomer(customerId, { 
      page: 1, 
      limit: 10000, 
      includeCancelled: true 
    });
    const invoices = result.invoices;

    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter((i) => i.isPaid()).length;
    const overdue = invoices.filter((i) => i.isOverdue()).length;
    const totalAmount = invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
    const paidAmount = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);

    return {
      totalInvoices,
      paidInvoices,
      unpaidInvoices: totalInvoices - paidInvoices,
      overdueInvoices: overdue,
      totalAmount: Number(totalAmount.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      outstandingAmount: Number((totalAmount - paidAmount).toFixed(2)),
    };
  }

  // ============= SUBSCRIPTION BILLING =============

  /**
   * Create recurring invoice for subscription
   */
  async createRecurringInvoice(data: {
    subscriptionId: string;
    customerId: string;
    planName: string;
    amount: number;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
  }): Promise<Invoice> {
    // Check if invoice already exists for this billing period
    const existing = await this.invoiceRepo.findOne({
      where: {
        subscriptionId: data.subscriptionId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
    });

    if (existing) {
      return existing;
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await this.invoiceRepo.save(
      this.invoiceRepo.create({
        invoiceNumber,
        subscriptionId: data.subscriptionId,
        customerId: data.customerId,
        invoiceType: 'recurring',
        subtotal: data.amount,
        tax: 0,
        shippingCost: 0,
        discount: 0,
        totalAmount: data.amount,
        dueAmount: data.amount,
        dueDate: data.dueDate,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        notes: `Recurring invoice for ${data.planName} (${data.periodStart.toLocaleDateString()} - ${data.periodEnd.toLocaleDateString()})`,
        status: 'draft',
      }),
    );

    // Create invoice item
    await this.itemRepo.save(
      this.itemRepo.create({
        invoiceId: invoice.id,
        description: `Subscription: ${data.planName}`,
        quantity: 1,
        unitPrice: data.amount,
        totalPrice: data.amount,
      }),
    );

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'created',
        details: `Recurring invoice created for subscription ${data.subscriptionId}`,
      }),
    );

    this.kafka.emit(EventTopics.INVOICE_CREATED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVOICE_CREATED,
      timestamp: new Date(),
      source: 'billing-svc',
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        subscriptionId: data.subscriptionId,
        customerId: invoice.customerId,
        totalAmount: invoice.totalAmount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        invoiceType: 'recurring',
        createdAt: invoice.createdAt,
      },
    });

    return invoice;
  }

  // ============= NEW: SMART BILLING WITH STRATEGY PATTERN =============

  /**
   * Create invoice using automatic strategy selection
   * 
   * Strategy is selected based on:
   * 1. metadata.businessModel (from order/subscription)
   * 2. ENV var BILLING_MODE (for dev mode)
   * 3. Default to onetime
   * 
   * Usage:
   * - Retail: await billingService.createWithStrategy({...}, 'retail')
   * - Subscription: await billingService.createWithStrategy({...}, 'subscription')
   * - Freemium: await billingService.createWithStrategy({...}, 'freemium', addons)
   */
  async createWithStrategy(
    dto: CreateInvoiceDto,
    businessModel?: string,
    addons?: Array<{ addonId: string; name: string; price: number }>,
  ): Promise<Invoice> {
    // Check if invoice already exists
    const existing = await this.invoiceRepo.findOne({
      where: { orderId: dto.orderId },
    });

    if (existing) {
      throw new ConflictException(`Invoice for order ${dto.orderId} already exists`);
    }

    // Use strategy to calculate amounts
    const billingResult = await this.billingStrategy.calculate({
      orderId: dto.orderId?.toString(),
      customerId: dto.customerId?.toString(),
      items: dto.items.map(item => ({
        productId: item.productId?.toString(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      addons,
      metadata: {
        businessModel,
        billingPeriod: dto.billingPeriod as any,
        isFreeTier: dto.isFreeTier,
      },
    });

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Create invoice with calculated amounts
    const invoiceData = {
      invoiceNumber,
      orderId: dto.orderId,
      orderNumber: dto.orderNumber,
      customerId: dto.customerId,
      subtotal: billingResult.subtotal,
      tax: billingResult.tax,
      shippingCost: dto.shippingCost || 0,
      discount: billingResult.discount,
      totalAmount: billingResult.totalAmount,
      dueAmount: billingResult.totalAmount,
      dueDate: dto.dueDate,
      notes: dto.notes,
      status: 'draft' as any,
    };

    const invoice = await this.invoiceRepo.save(
      this.invoiceRepo.create(invoiceData),
    );

    // Create items
    const items = await Promise.all(
      dto.items.map((item) =>
        this.itemRepo.save(
          this.itemRepo.create({
            invoiceId: invoice.id,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          }),
        ),
      ),
    );

    invoice.items = items;

    // Save history
    await this.historyRepo.save(
      this.historyRepo.create({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        action: 'created',
        details: `Invoice created with ${billingResult.billingMode} billing mode`,
      }),
    );

    this.kafka.emit(EventTopics.INVOICE_CREATED, {
      eventId: crypto.randomUUID(),
      eventType: EventTopics.INVOICE_CREATED,
      timestamp: new Date(),
      source: 'billing-svc',
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderId: invoice.orderId,
        orderNumber: invoice.orderNumber,
        customerId: invoice.customerId,
        totalAmount: invoice.totalAmount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        billingMode: billingResult.billingMode,
        businessModel,
        createdAt: invoice.createdAt,
      },
    });

    return invoice;
  }
}
