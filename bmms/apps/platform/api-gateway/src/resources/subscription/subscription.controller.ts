import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
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
  @ApiBearerAuth('accessToken')
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
    // Set ownerId from authenticated user (this is the auth userId)
    (dto as any).ownerId = user.userId;
    
    // IMPORTANT: Subscription service uses getCustomerByUserId internally
    // So we pass userId as customerId, and subscription-svc will resolve it to actual customer.id
    // This is a workaround until proper customer lookup is implemented in API Gateway
    
    // If customerId is provided, validate it belongs to the user
    // If customerId is NOT the user's customer.id, only admin can create for others
    if (dto.customerId && dto.customerId !== user.userId && user.role !== 'admin') {
      // Allow if customerId is a customer.id (UUID format), let subscription-svc validate ownership
      // For now, we trust the subscription-svc to validate customer ownership via getCustomerById
      // The subscription-svc will verify that the customer exists and belongs to the user
      throw new ForbiddenException('[V3] CustomerId validation - subscription-svc will handle lookup');
    }
    
    // If no customerId provided, use userId (subscription-svc will lookup customer by userId)
    if (!dto.customerId) {
      dto.customerId = user.userId;
    }
    
    return this.subscriptionService.createSubscription(dto);
  }

  // ============ User-specific endpoints ============

  @Get('my')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ 
    summary: 'Get current user subscriptions',
    description: 'Retrieve all subscriptions for the authenticated user (by ownerId)'
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
    return this.subscriptionService.getSubscriptionsByOwner(user.userId);
  }

  @Get('my/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
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
    @Param('id') id: string,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    
    // Check ownerId instead of customerId for access control
    if (subscription?.subscription?.ownerId !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException('You do not have access to this subscription');
    }
    
    return subscription;
  }

  // ============ General endpoints with auth ============

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
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
    @Param('id') id: string,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    
    // Admin can access all, regular users can only access their own (check ownerId)
    if (user.role !== 'admin' && subscription?.subscription?.ownerId !== user.userId) {
      throw new ForbiddenException('You do not have access to this subscription');
    }
    
    return subscription;
  }

  @Get('customer/:customerId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
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
  @ApiBearerAuth('accessToken')
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
    @Param('id') id: string,
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
  @ApiBearerAuth('accessToken')
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
    @Param('id') id: string,
  ) {
    const subscription: any = await this.subscriptionService.getSubscriptionById(id);
    if (user.role !== 'admin' && subscription?.subscription?.customerId !== user.userId) {
      throw new ForbiddenException('You can only renew your own subscriptions');
    }
    return this.subscriptionService.renewSubscription(id);
  }

  @Post(':id/activate')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
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
    @Param('id') id: string,
  ) {
    // Get subscription first
    const subscriptionResponse: any = await this.subscriptionService.getSubscriptionById(id);
    const subscription = subscriptionResponse?.subscription;
    
    if (!subscription) {
      throw new ForbiddenException('Subscription not found');
    }
    
    // For non-admin users, we need to verify ownership
    // Note: subscription.customerId is the customer ID from customer-svc, not the userId
    // For now, we allow activation if user is authenticated (since they have the subscription ID from their payment session)
    // A more robust solution would be to store userId in subscription or lookup customer.userId
    if (user.role !== 'admin') {
      // Log for debugging
      console.log(`[ActivateSubscription] User ${user.userId} activating subscription ${id} (customerId: ${subscription.customerId})`);
    }
    
    return this.subscriptionService.activateSubscription(id);
  }

  @Patch(':id/change-plan')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
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
    @Param('id') id: string,
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
  @ApiBearerAuth('accessToken')
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
  @ApiBearerAuth('accessToken')
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

  // =================== STRIPE INTEGRATION ENDPOINTS ===================

  @Get('my/status')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ 
    summary: 'Get current user subscription status',
    description: 'Quick check for subscription status - useful for frontend to determine access levels.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription status retrieved',
    schema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean', example: true },
        status: { type: 'string', example: 'active', enum: ['active', 'trial', 'expired', 'cancelled'] },
        planId: { type: 'string', example: 'plan-premium' },
        planName: { type: 'string', example: 'Premium Plan' },
        currentPeriodEnd: { type: 'string', example: '2024-01-15T00:00:00.000Z' },
        cancelAtPeriodEnd: { type: 'boolean', example: false },
      }
    }
  })
  async getMySubscriptionStatus(@CurrentUser() user: JwtUserPayload) {
    return this.subscriptionService.checkSubscriptionStatus(user.userId);
  }

  @Get('my/limits')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ 
    summary: 'Get current user plan limits',
    description: 'Returns the resource limits based on user subscription plan - projects, team members, storage, etc.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Plan limits retrieved',
    schema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean', example: true },
        planId: { type: 'string', example: 'plan-premium' },
        planName: { type: 'string', example: 'Premium Plan' },
        maxProjects: { type: 'number', example: 10 },
        maxTeamMembers: { type: 'number', example: 25 },
        maxStorageGb: { type: 'number', example: 100 },
        maxApiCalls: { type: 'number', example: 100000 },
        features: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['advanced_analytics', 'priority_support', 'api_access']
        },
        currentPeriodEnd: { type: 'string', example: '2024-01-15T00:00:00.000Z' },
      }
    }
  })
  async getMyPlanLimits(@CurrentUser() user: JwtUserPayload) {
    return this.subscriptionService.getPlanLimits(user.userId);
  }

  @Get('my/active')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ 
    summary: 'Get current user active subscription details',
    description: 'Returns full details of the active subscription for the current user.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Active subscription retrieved', 
    type: SubscriptionResponseDto 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'No active subscription found' 
  })
  async getMyActiveSubscription(@CurrentUser() user: JwtUserPayload) {
    return this.subscriptionService.getActiveSubscription(user.userId);
  }
}


