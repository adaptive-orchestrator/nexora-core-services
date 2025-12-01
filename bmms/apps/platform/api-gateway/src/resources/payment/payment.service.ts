import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedPaymentsResponse {
  payments: any[];
  pagination: PaginationMeta;
}

interface IPaymentGrpcService {
  initiatePayment(data: any): any;
  confirmPayment(data: any): any;
  getPaymentById(data: any): any;
  getAllPayments(data: any): any;
  getPaymentsByInvoice(data: any): any;
  getPaymentStats(data: any): any;
  processPayment(data: any): any;
}

@Injectable()
export class PaymentService implements OnModuleInit {
  private paymentService: IPaymentGrpcService;

  constructor(
    @Inject('PAYMENT_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.paymentService = this.client.getService<IPaymentGrpcService>('PaymentService');
  }

  async initiatePayment(dto: InitiatePaymentDto) {
    const response: any = await firstValueFrom(this.paymentService.initiatePayment(dto));
    return response.payment;
  }

  async confirmPayment(dto: ConfirmPaymentDto) {
    const response: any = await firstValueFrom(this.paymentService.confirmPayment(dto));
    return response.payment;
  }

  async getPaymentById(id: number) {
    const response: any = await firstValueFrom(this.paymentService.getPaymentById({ id }));
    return response.payment;
  }

  async getAllPayments(page: number = 1, limit: number = 20): Promise<PaginatedPaymentsResponse> {
    const response: any = await firstValueFrom(
      this.paymentService.getAllPayments({ page, limit })
    );
    return {
      payments: response.payments || [],
      pagination: response.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  async getPaymentsByInvoice(invoiceId: number) {
    const response: any = await firstValueFrom(
      this.paymentService.getPaymentsByInvoice({ invoiceId })
    );
    return response.payments;
  }

  async getPaymentStats() {
    return firstValueFrom(this.paymentService.getPaymentStats({}));
  }

  async processPayment(dto: { invoiceId: number; amount: number; paymentMethod: string }) {
    const response: any = await firstValueFrom(this.paymentService.processPayment(dto));
    return response;
  }
}
