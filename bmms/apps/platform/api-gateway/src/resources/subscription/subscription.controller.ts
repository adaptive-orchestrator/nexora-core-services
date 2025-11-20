import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
// @ApiBearerAuth('accessToken')  // Uncomment when auth is ready
// @UseGuards(JwtAuthGuard)  // Uncomment when auth is ready
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create new subscription',
    description: 'Create a new subscription for a customer with a specific plan. Optionally enable trial period if plan supports it.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Subscription created successfully', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - Invalid data or customer already has active subscription' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Customer or Plan not found' 
  })
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.createSubscription(dto);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get subscription by ID',
    description: 'Retrieve detailed information about a specific subscription'
  })
  @ApiParam({ name: 'id', description: 'Subscription ID', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription found', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async getSubscriptionById(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.getSubscriptionById(id);
  }

  @Get('customer/:customerId')
  @ApiOperation({ 
    summary: 'Get all subscriptions for a customer',
    description: 'Retrieve all subscriptions (active, cancelled, expired) for a specific customer'
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Customer subscriptions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        subscriptions: {
          type: 'array',
          items: { $ref: '#/components/schemas/SubscriptionResponseDto' }
        }
      }
    }
  })
  async getSubscriptionsByCustomer(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.subscriptionService.getSubscriptionsByCustomer(customerId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ 
    summary: 'Cancel subscription',
    description: 'Cancel a subscription. Can be immediate or scheduled for end of billing period.'
  })
  @ApiParam({ name: 'id', description: 'Subscription ID', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription cancelled successfully', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Subscription already cancelled' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async cancelSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionService.cancelSubscription(id, dto);
  }

  @Patch(':id/renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Renew subscription',
    description: 'Manually renew a subscription. This is typically handled automatically by scheduler.'
  })
  @ApiParam({ name: 'id', description: 'Subscription ID', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription renewed successfully', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Subscription cannot be renewed (e.g., already cancelled)' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async renewSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.renewSubscription(id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Activate subscription after payment',
    description: 'Activate a pending subscription after successful payment confirmation.'
  })
  @ApiParam({ name: 'id', description: 'Subscription ID', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription activated successfully', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Subscription cannot be activated (must be in PENDING status)' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async activateSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.activateSubscription(id);
  }

  @Patch(':id/change-plan')
  @ApiOperation({ 
    summary: 'Change subscription plan',
    description: 'Upgrade or downgrade subscription plan. Can be immediate or scheduled for end of current billing period.'
  })
  @ApiParam({ name: 'id', description: 'Subscription ID', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Plan changed successfully', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Can only change plan for active subscriptions' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription or new plan not found' 
  })
  async changePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptionService.changePlan(id, dto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all subscriptions (admin)',
    description: 'Retrieve all subscriptions in the system for testing/admin purposes'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All subscriptions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        subscriptions: {
          type: 'array',
          items: { $ref: '#/components/schemas/SubscriptionResponseDto' }
        }
      }
    }
  })
  async getAllSubscriptions() {
    return this.subscriptionService.getAllSubscriptions();
  }

  @Post('check-trial-expiry')
  @ApiOperation({ 
    summary: 'Manually trigger trial expiry check (testing)',
    description: 'Manually check and process all trial subscriptions that have expired. Used for testing before implementing scheduler.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Trial expiry check completed',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', example: 5 },
        converted: { type: 'number', example: 4 },
        failed: { type: 'number', example: 1 },
        message: { type: 'string', example: 'Processed 5 subscriptions. Converted: 4, Failed: 1' }
      }
    }
  })
  async checkTrialExpiry() {
    return this.subscriptionService.checkTrialExpiry();
  }
}
