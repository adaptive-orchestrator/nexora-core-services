import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateSubscriptionInvoiceDto } from './dto/create-subscription-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';

/**
 * Controller for /billing routes
 * Provides simpler API for subscription billing from frontend
 */
@ApiTags('Billing')
@Controller('billing')
export class BillingAliasController {
  constructor(private readonly billingService: BillingService) {}

  @Post('create-invoice')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create invoice for subscription payment',
    description: 'Create a simple invoice for subscription payment. Called from frontend when user subscribes to a plan.'
  })
  @ApiResponse({ status: 201, description: 'Invoice created successfully', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid data' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async createSubscriptionInvoice(@Body() dto: CreateSubscriptionInvoiceDto) {
    return this.billingService.createSubscriptionInvoice(dto);
  }

  @Get('customer/:customerId')
  @ApiOperation({ 
    summary: 'Get all invoices for a customer',
    description: 'Retrieve all invoices for a specific customer'
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  async getInvoicesByCustomer(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.billingService.getInvoicesByCustomer(customerId);
  }

  @Get('subscription/:subscriptionId')
  @ApiOperation({ 
    summary: 'Get all invoices for a subscription',
    description: 'Retrieve all invoices for a specific subscription'
  })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  async getInvoicesBySubscription(@Param('subscriptionId', ParseIntPipe) subscriptionId: number) {
    return this.billingService.getInvoicesBySubscription(subscriptionId);
  }
}
