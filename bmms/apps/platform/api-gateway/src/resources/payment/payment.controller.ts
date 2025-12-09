import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService, PaginatedPaymentsResponse } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PaymentResponseDto, PaymentStatsDto } from './dto/payment-response.dto';
import { JwtGuard } from '../../guards/jwt.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtUserPayload } from '../../decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ============ User-specific endpoints ============

  @Get('my')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user payments' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'User payments retrieved successfully' })
  async getMyPayments(
    @CurrentUser() user: JwtUserPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedPaymentsResponse> {
    // Get payments filtered by user's customerId
    return this.paymentService.getPaymentsByCustomer(user.userId, page, limit);
  }

  @Get('my/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get specific payment for current user' })
  @ApiResponse({ status: 200, description: 'Payment found', type: PaymentResponseDto })
  @ApiResponse({ status: 403, description: 'Payment does not belong to user' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getMyPaymentById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const payment: any = await this.paymentService.getPaymentById(id);
    
    // Verify payment belongs to user (through invoice -> customer relationship)
    // For now, we'll check if the payment's associated data matches the user
    if (user.role !== 'admin' && payment?.payment?.customerId !== user.userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }
    
    return payment;
  }

  // ============ Admin endpoints ============

  @Get()
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments with pagination (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getAllPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedPaymentsResponse> {
    return this.paymentService.getAllPayments(page, limit);
  }

  @Get('stats/summary')
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment stats retrieved', type: PaymentStatsDto })
  async getPaymentStats() {
    return this.paymentService.getPaymentStats();
  }

  @Get('invoice/:invoiceId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payments by invoice ID' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async getPaymentsByInvoice(
    @CurrentUser() user: JwtUserPayload,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    // TODO: Verify invoice belongs to user before returning payments
    return this.paymentService.getPaymentsByInvoice(invoiceId);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment found', type: PaymentResponseDto })
  @ApiResponse({ status: 403, description: 'Payment does not belong to user' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const payment: any = await this.paymentService.getPaymentById(id);
    
    // Admin can access all, regular users can only access their own
    if (user.role !== 'admin' && payment?.payment?.customerId !== user.userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }
    
    return payment;
  }

  @Post('initiate')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate new payment' })
  @ApiResponse({ status: 201, description: 'Payment initiated successfully', type: PaymentResponseDto })
  async initiatePayment(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: InitiatePaymentDto,
  ) {
    // TODO: Verify invoice belongs to user before initiating payment
    return this.paymentService.initiatePayment(dto);
  }

  @Post('confirm')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm payment result' })
  @ApiResponse({ status: 200, description: 'Payment confirmed', type: PaymentResponseDto })
  async confirmPayment(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: ConfirmPaymentDto,
  ) {
    // TODO: Verify payment transaction belongs to user before confirming
    return this.paymentService.confirmPayment(dto);
  }

  @Post('pay')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process payment immediately (for testing/simple flow)' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully', type: PaymentResponseDto })
  async processPayment(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: { invoiceId: number; amount: number; paymentMethod: string },
  ) {
    // TODO: Verify invoice belongs to user before processing payment
    return this.paymentService.processPayment(dto);
  }
}
