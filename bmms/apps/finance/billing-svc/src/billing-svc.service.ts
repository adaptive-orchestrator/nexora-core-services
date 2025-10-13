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

import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { InvoiceHistory } from './entities/invoice-history.entity';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { PaymentRecordDto } from './dto/payment-record.dto';
import { EventTopics } from '@bmms/event';



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
  ) {}

  // ============= CRUD =============

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    // Check if invoice already exists for this order
    const existing = await this.invoiceRepo.findOne({
      where: { orderId: dto.orderId },
    });

    if (existing) {
      throw new ConflictException(`Invoice for order ${dto.orderId} already exists`);
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await this.invoiceRepo.save(
      this.invoiceRepo.create({
        invoiceNumber,
        orderId: dto.orderId,
        orderNumber: dto.orderNumber,
        customerId: dto.customerId,
        subtotal: dto.subtotal,
        tax: dto.tax,
        shippingCost: dto.shippingCost || 0,
        discount: dto.discount || 0,
        totalAmount: dto.totalAmount,
        dueAmount: dto.totalAmount,
        dueDate: dto.dueDate,
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

     console.log('📤 Emitting INVOICE_CREATED event...');
  
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


  console.log('✅ INVOICE_CREATED event emitted successfully');
  console.log('📋 Event data:', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderId: invoice.orderId,
  });
  
    return invoice;
  }

  async list(): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      relations: ['items', 'payments'],
      order: { createdAt: 'DESC' },
    });
  }

  async listByCustomer(customerId: number): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: { customerId },
      relations: ['items', 'payments'],
      order: { createdAt: 'DESC' },
    });
  }

  async getById(id: number): Promise<Invoice> {
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

  async updateStatus(id: number, dto: UpdateInvoiceStatusDto): Promise<Invoice> {
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

  // ============= PAYMENT MANAGEMENT =============

  async recordPayment(id: number, dto: PaymentRecordDto): Promise<Invoice> {
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

  async retryPayment(id: number): Promise<Invoice> {
    const invoice = await this.getById(id);

    if (invoice.isPaid()) {
      throw new BadRequestException(`Invoice ${id} is already paid`);
    }

    // TODO: Implement retry payment logic with payment provider
    // This could integrate with payment gateway APIs

    console.log(`🔄 Retry payment for invoice ${invoice.invoiceNumber}`);

    return invoice;
  }

  // ============= UTILITIES =============

  async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const latestInvoice = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.invoiceNumber LIKE :pattern', {
        pattern: `INV-${year}-${month}-%`,
      })
      .orderBy('invoice.invoiceNumber', 'DESC')
      .take(1)
      .getOne();

    let sequence = 1;
    if (latestInvoice) {
      const lastSequence = parseInt(latestInvoice.invoiceNumber.split('-')[3], 10);
      sequence = lastSequence + 1;
    }

    const sequenceStr = String(sequence).padStart(5, '0');
    return `INV-${year}-${month}-${sequenceStr}`;
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

    console.log(`⚠️ Marked ${overdueInvoices.length} invoices as overdue`);
  }

  async getInvoiceStats(customerId: number): Promise<any> {
    const invoices = await this.listByCustomer(customerId);

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
}