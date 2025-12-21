import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateSubscriptionInvoiceDto } from './dto/create-subscription-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';

interface IBillingGrpcService {
  createInvoice(data: any): any;
  getAllInvoices(data: any): any;
  getInvoiceById(data: any): any;
  getInvoicesByCustomer(data: any): any;
  getInvoicesBySubscription(data: any): any;
  updateInvoiceStatus(data: any): any;
  retryPayment(data: any): any;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  includeCancelled?: boolean;
}

@Injectable()
export class BillingService implements OnModuleInit {
  private billingService: IBillingGrpcService;

  constructor(
    @Inject('BILLING_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.billingService = this.client.getService<IBillingGrpcService>('BillingService');
  }

  async createInvoice(dto: CreateInvoiceDto) {
    // Prepare data for billing-svc
    // Convert dueDate to ISO string for gRPC transmission
    const dueDateStr = dto.dueDate 
      ? new Date(dto.dueDate).toISOString() 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const invoiceData = {
      // orderId and ids are UUID strings in the new model
      orderId: dto.orderId || '',
      orderNumber: dto.orderNumber || `INV-${Date.now()}`,
      customerId: dto.customerId,
      items: dto.items.map(item => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal: dto.subtotal,
      tax: dto.tax || 0,
      shippingCost: dto.shippingCost || 0,
      discount: dto.discount || 0,
      totalAmount: dto.totalAmount,
      dueDate: dueDateStr,
      notes: dto.notes || '',
      billingPeriod: dto.billingPeriod || 'onetime',
      businessModel: dto.businessModel || 'subscription',
    };

    const response: any = await firstValueFrom(this.billingService.createInvoice(invoiceData));
    return response.invoice;
  }

  async getAllInvoices(options?: PaginationOptions) {
    const response: any = await firstValueFrom(this.billingService.getAllInvoices({
      page: options?.page || 1,
      limit: options?.limit || 20,
      includeCancelled: options?.includeCancelled || false,
    }));
    return response;
  }

  async getInvoiceById(id: string) {
    const response: any = await firstValueFrom(this.billingService.getInvoiceById({ id }));
    return response.invoice;
  }

  async updateInvoiceStatus(id: string, dto: UpdateInvoiceStatusDto) {
    const response: any = await firstValueFrom(
      this.billingService.updateInvoiceStatus({ 
        id, 
        status: dto.status 
      })
    );
    return response.invoice;
  }

  async retryPayment(id: string) {
    return firstValueFrom(this.billingService.retryPayment({ id }));
  }

  /**
   * Create invoice for subscription payment
   * Called from frontend when user clicks "Đăng Ký Ngay" button
   */
  async createSubscriptionInvoice(dto: CreateSubscriptionInvoiceDto) {
    // Convert subscription invoice DTO to standard invoice format
    const invoiceData = {
      orderId: 0,
      orderNumber: `SUB-${dto.subscriptionId}-${Date.now()}`,
      customerId: dto.customerId,
      subscriptionId: dto.subscriptionId,
      items: [
        {
          productId: 0,
          description: `Subscription Payment - Subscription #${dto.subscriptionId}`,
          quantity: 1,
          unitPrice: dto.amount,
          totalPrice: dto.amount,
        },
      ],
      subtotal: dto.amount,
      tax: 0,
      shippingCost: 0,
      discount: 0,
      totalAmount: dto.amount,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
      notes: dto.notes || 'Subscription payment',
      billingPeriod: 'monthly',
      businessModel: 'subscription',
    };

    const response: any = await firstValueFrom(this.billingService.createInvoice(invoiceData));
    return { invoice: response.invoice || response };
  }

  /**
   * Get all invoices for a customer
   */
  async getInvoicesByCustomer(customerId: string) {
    try {
      const response: any = await firstValueFrom(
        this.billingService.getInvoicesByCustomer({ customerId })
      );
      return { invoices: response.invoices || [] };
    } catch (error) {
      return { invoices: [] };
    }
  }

  /**
   * Get all invoices for a subscription
   */
  async getInvoicesBySubscription(subscriptionId: string) {
    try {
      const response: any = await firstValueFrom(
        this.billingService.getInvoicesBySubscription({ subscriptionId })
      );
      return { invoices: response.invoices || [] };
    } catch (error) {
      return { invoices: [] };
    }
  }
}
