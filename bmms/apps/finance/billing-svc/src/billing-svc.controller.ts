import { Controller, Post, Get, Patch, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BillingService } from './billing-svc.service';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';

@Controller('api/v1/invoices')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  // =================== HTTP REST API ENDPOINTS ===================
  
  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    return this.service.list({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      includeCancelled: includeCancelled === 'true',
    });
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInvoiceStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Post(':id/retry')
  retryPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.retryPayment(id);
  }

  // =================== gRPC METHODS FOR API GATEWAY ===================
  
  @GrpcMethod('BillingService', 'CreateInvoice')
  async grpcCreateInvoice(data: any) {
    return { invoice: await this.service.create(data) };
  }

  @GrpcMethod('BillingService', 'GetAllInvoices')
  async grpcGetAllInvoices(data: { page?: number; limit?: number; includeCancelled?: boolean }) {
    const result = await this.service.list({
      page: data?.page || 1,
      limit: data?.limit || 20,
      includeCancelled: data?.includeCancelled || false,
    });
    return result;
  }

  @GrpcMethod('BillingService', 'GetInvoiceById')
  async grpcGetInvoiceById(data: { id: string }) {
    return { invoice: await this.service.getById(data.id) };
  }

  @GrpcMethod('BillingService', 'GetInvoicesByCustomer')
  async grpcGetInvoicesByCustomer(data: { customerId: string; page?: number; limit?: number; includeCancelled?: boolean }) {
    const result = await this.service.listByCustomer(data.customerId, {
      page: data?.page || 1,
      limit: data?.limit || 20,
      includeCancelled: data?.includeCancelled || false,
    });
    return result;
  }

  @GrpcMethod('BillingService', 'GetInvoicesBySubscription')
  async grpcGetInvoicesBySubscription(data: { subscriptionId: string; page?: number; limit?: number; includeCancelled?: boolean }) {
    const result = await this.service.listBySubscription(data.subscriptionId, {
      page: data?.page || 1,
      limit: data?.limit || 20,
      includeCancelled: data?.includeCancelled || false,
    });
    return result;
  }

  @GrpcMethod('BillingService', 'UpdateInvoiceStatus')
  async grpcUpdateInvoiceStatus(data: { id: string; status: string }) {
    return { invoice: await this.service.updateStatus(data.id, data.status as any) };
  }

  @GrpcMethod('BillingService', 'RetryPayment')
  async grpcRetryPayment(data: { id: string }) {
    const result = await this.service.retryPayment(data.id);
    return { message: 'Payment retry initiated', success: true };
  }
}