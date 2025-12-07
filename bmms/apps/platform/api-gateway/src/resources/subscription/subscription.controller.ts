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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { JwtGuard } from '../../guards/jwt.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtUserPayload } from '../../decorators/current-user.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
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
  async createSubscription(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    // Ensure subscription is created for the authenticated user
    if (!dto.customerId && user) {
      dto.customerId = user.userId;
    }
    // Only admin can create subscriptions for other users
    if (dto.customerId !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException('You can only create subscriptions for yourself');
    }
    return this.subscriptionService.createSubscription(dto);
  }

  // ============ User-specific endpoints ============

  @Get('my')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get current user subscriptions',
    description: 'Retrieve all subscriptions for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User subscriptions retrieved successfully',
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
  async getMySubscriptions(@CurrentUser() user: JwtUserPayload) {
    return this.subscriptionService.getSubscriptionsByCustomer(user.userId);
  }

  @Get('my/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get specific subscription for current user',
    description: 'Retrieve detailed information about a specific subscription that belongs to the user'
  })
  @ApiParam({ name: 'id', description: 'Subscription ID', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription found', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Subscription does not belong to user' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async getMySubscriptionById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    
    if (subscription?.subscription?.customerId !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException('You do not have access to this subscription');
    }
    
    return subscription;
  }

  // ============ General endpoints with auth ============

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
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
    status: 403, 
    description: 'Subscription does not belong to user' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async getSubscriptionById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    
    // Admin can access all, regular users can only access their own
    if (user.role !== 'admin' && subscription?.subscription?.customerId !== user.userId) {
      throw new ForbiddenException('You do not have access to this subscription');
    }
    
    return subscription;
  }

  @Get('customer/:customerId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get all subscriptions for a customer',
    description: 'Retrieve all subscriptions (active, cancelled, expired) for a specific customer'
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
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
  @ApiResponse({ 
    status: 403, 
    description: 'Cannot access other customer subscriptions' 
  })
  async getSubscriptionsByCustomer(
    @CurrentUser() user: JwtUserPayload,
    @Param('customerId') customerId: string,
  ) {
    // Only admin or the customer themselves can access subscriptions
    if (user.role !== 'admin' && user.userId !== customerId) {
      throw new ForbiddenException('You can only access your own subscriptions');
    }
    return this.subscriptionService.getSubscriptionsByCustomer(customerId);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
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
    status: 403, 
    description: 'Cannot cancel other user subscriptions' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async cancelSubscription(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    if (user.role !== 'admin' && subscription?.subscription?.customerId !== user.userId) {
      throw new ForbiddenException('You can only cancel your own subscriptions');
    }
    return this.subscriptionService.cancelSubscription(id, dto);
  }

  @Patch(':id/renew')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
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
    status: 403, 
    description: 'Cannot renew other user subscriptions' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async renewSubscription(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    if (user.role !== 'admin' && subscription?.subscription?.customerId !== user.userId) {
      throw new ForbiddenException('You can only renew your own subscriptions');
    }
    return this.subscriptionService.renewSubscription(id);
  }

  @Post(':id/activate')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
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
    status: 403, 
    description: 'Cannot activate other user subscriptions' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription not found' 
  })
  async activateSubscription(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    if (user.role !== 'admin' && subscription?.subscription?.customerId !== user.userId) {
      throw new ForbiddenException('You can only activate your own subscriptions');
    }
    return this.subscriptionService.activateSubscription(id);
  }

  @Patch(':id/change-plan')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
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
    status: 403, 
    description: 'Cannot change plan for other user subscriptions' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Subscription or new plan not found' 
  })
  async changePlan(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePlanDto,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    if (user.role !== 'admin' && subscription?.subscription?.customerId !== user.userId) {
      throw new ForbiddenException('You can only change plan for your own subscriptions');
    }
    return this.subscriptionService.changePlan(id, dto);
  }

  @Get()
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get all subscriptions (admin only)',
    description: 'Retrieve all subscriptions in the system. Admin access required.'
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
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Manually trigger trial expiry check (admin only)',
    description: 'Manually check and process all trial subscriptions that have expired. Admin access required.'
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
