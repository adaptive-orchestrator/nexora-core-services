
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from './payment-svc.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { SubscriptionPaymentDto, SubscriptionPaymentResponseDto } from './dto/subscription-payment.dto';
import { Payment } from './entities/payment.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // =================== LIST ALL PAYMENTS ===================
  // ⚠️ IMPORTANT: Route phải được order sao cho specific routes trước generic routes
  // Nếu `@Get()` đứng trước `@Get(':id')` sẽ không parse được :id
  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả các thanh toán với pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (mặc định: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số item mỗi trang (mặc định: 20, tối đa: 100)' })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.paymentService.list(page, limit);
  }

  // =================== PAYMENT STATISTICS ===================
  // ⚠️ IMPORTANT: Generic routes như /stats/summary PHẢI đứng trước @Get(':id')
  @Get('stats/summary')
  @ApiOperation({ summary: 'Thống kê thanh toán tổng hợp' })
  async getStats(): Promise<any> {
    return this.paymentService.getPaymentStats();
  }

  // =================== GET PAYMENT BY INVOICE ===================
  // ⚠️ IMPORTANT: /invoice/:invoiceId phải đứng trước generic @Get(':id')
  @Get('invoice/:invoiceId')
  @ApiOperation({ summary: 'Lấy danh sách thanh toán theo hóa đơn' })
  async getByInvoice(
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ): Promise<Payment[]> {
    return this.paymentService.getByInvoice(invoiceId);
  }

  // =================== SUBSCRIPTION PAYMENT ===================
  // API thanh toán subscription - gọi trực tiếp từ frontend
  // Sau này sẽ thay bằng VNPay/Momo integration
  @Post('subscription/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Thanh toán subscription',
    description: 'API thanh toán subscription trực tiếp. Tạo invoice, xử lý thanh toán và emit event để activate subscription.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Thanh toán thành công', 
    type: SubscriptionPaymentResponseDto 
  })
  async paySubscription(
    @Body() dto: SubscriptionPaymentDto,
  ): Promise<SubscriptionPaymentResponseDto> {
    return this.paymentService.processSubscriptionPayment(dto);
  }

  // =================== GET PAYMENT BY ID ===================
  // ⚠️ Generic route phải đứng ở cuối cùng
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin thanh toán theo ID' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin thanh toán', type: Payment })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<Payment> {
    return this.paymentService.getById(id);
  }

  // =================== INITIATE PAYMENT ===================
  @Post('initiate')
  @ApiOperation({ summary: 'Khởi tạo thanh toán mới' })
  @ApiResponse({ status: 201, description: 'Tạo thanh toán thành công', type: Payment })
  async initiatePayment(@Body() dto: CreatePaymentDto): Promise<Payment> {
    return this.paymentService.initiatePayment(dto);
  }

  // =================== CONFIRM PAYMENT ===================
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận kết quả thanh toán' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thanh toán', type: Payment })
  async confirmPayment(@Body() dto: ConfirmPaymentDto): Promise<Payment> {
    return this.paymentService.confirmPayment(dto);
  }

  // =================== TEST EVENT EMITTERS ===================

  @Post(':paymentId/test/success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.success event for testing flow' })
  async testEmitSuccess(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() data: {
      invoiceId: number;
      orderId?: number;
      customerId?: number;
      amount: number;
      transactionId?: string;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentSuccess({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      amount: data.amount,
      method: 'vnpay',
      transactionId: data.transactionId || `TEST-TXN-${Date.now()}`,
      paidAt: new Date(),
    });
    
    return { message: `payment.success event emitted for payment ${paymentId}` };
  }

  @Post(':paymentId/test/failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.failed event for testing flow' })
  async testEmitFailed(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() data: {
      invoiceId: number;
      orderId?: number;
      customerId?: number;
      amount: number;
      reason: string;
      errorCode?: string;
      canRetry?: boolean;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentFailed({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      amount: data.amount,
      method: 'vnpay',
      reason: data.reason,
      errorCode: data.errorCode,
      canRetry: data.canRetry,
    });
    
    return { message: `payment.failed event emitted for payment ${paymentId}` };
  }

  @Post(':paymentId/test/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.retry event for testing flow' })
  async testEmitRetry(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() data: {
      invoiceId: number;
      orderId?: number;
      customerId?: number;
      amount: number;
      retryCount: number;
      previousFailureReason: string;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentRetry({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      amount: data.amount,
      retryCount: data.retryCount,
      previousFailureReason: data.previousFailureReason,
    });
    
    return { message: `payment.retry event emitted for payment ${paymentId}` };
  }

  @Post(':paymentId/test/refunded')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST] Emit payment.refunded event for testing flow' })
  async testEmitRefunded(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() data: {
      invoiceId: number;
      orderId?: number;
      customerId?: number;
      refundAmount: number;
      reason: string;
    },
  ): Promise<{ message: string }> {
    await this.paymentService.emitPaymentRefunded({
      paymentId,
      invoiceId: data.invoiceId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      refundAmount: data.refundAmount,
      reason: data.reason,
      refundedAt: new Date(),
    });
    
    return { message: `payment.refunded event emitted for payment ${paymentId}` };
  }

  // =================== gRPC METHODS FOR API GATEWAY ===================
  
  @GrpcMethod('PaymentService', 'InitiatePayment')
  async grpcInitiatePayment(data: CreatePaymentDto) {
    const payment = await this.paymentService.initiatePayment(data);
    return { payment };
  }

  @GrpcMethod('PaymentService', 'ConfirmPayment')
  async grpcConfirmPayment(data: ConfirmPaymentDto) {
    const payment = await this.paymentService.confirmPayment(data);
    return { payment };
  }

  @GrpcMethod('PaymentService', 'GetPaymentById')
  async grpcGetPaymentById(data: { id: number }) {
    const payment = await this.paymentService.getById(data.id);
    return { payment };
  }

  @GrpcMethod('PaymentService', 'GetAllPayments')
  async grpcGetAllPayments(data: { page?: number; limit?: number }) {
    const page = data?.page || 1;
    const limit = data?.limit || 20;
    const result = await this.paymentService.list(page, limit);
    return { 
      payments: result.payments,
      pagination: result.pagination,
    };
  }

  @GrpcMethod('PaymentService', 'GetPaymentsByInvoice')
  async grpcGetPaymentsByInvoice(data: { invoiceId: number }) {
    const payments = await this.paymentService.getByInvoice(data.invoiceId);
    return { payments };
  }

  @GrpcMethod('PaymentService', 'GetPaymentStats')
  async grpcGetPaymentStats() {
    const stats = await this.paymentService.getPaymentStats();
    return stats;
  }
}
