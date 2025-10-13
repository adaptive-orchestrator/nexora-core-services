
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentService } from './payment-svc.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { Payment } from './entities/payment.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // =================== LIST ALL PAYMENTS ===================
  // ⚠️ IMPORTANT: Route phải được order sao cho specific routes trước generic routes
  // Nếu `@Get()` đứng trước `@Get(':id')` sẽ không parse được :id
  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả các thanh toán' })
  async list(): Promise<Payment[]> {
    return this.paymentService.list();
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
}