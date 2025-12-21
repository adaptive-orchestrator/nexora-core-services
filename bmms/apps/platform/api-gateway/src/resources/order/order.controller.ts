import { 
  Controller, 
  Post, 
  Get, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { JwtGuard } from '../../guards/jwt.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtUserPayload } from '../../decorators/current-user.decorator';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully', type: OrderResponseDto })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    console.log('[OrderController] Creating order for user:', user.userId);
    console.log('[OrderController] Order customerId:', dto.customerId);
    return this.orderService.createOrder(dto);
  }

  // ============ User-specific endpoints (authenticated) ============

  @Get('my')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get current user orders' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'User orders retrieved successfully' })
  async getMyOrders(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Get orders only for the authenticated user
    return this.orderService.getOrdersForUser(user.userId, page, limit);
  }

  @Get('my/:id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get specific order for current user' })
  @ApiResponse({ status: 200, description: 'Order found', type: OrderResponseDto })
  @ApiResponse({ status: 403, description: 'Order does not belong to user' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getMyOrderById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ) {
    const order: any = await this.orderService.getOrderById(id);
    
    // Verify the order belongs to the authenticated user
    if (order?.order?.customerId !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException('You do not have access to this order');
    }
    
    return order;
  }

  // ============ Admin endpoints (all data access) ============

  @Get()
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get all orders (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getAllOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('customerId') customerId?: string,
  ) {
    return this.orderService.getAllOrders(page, limit, customerId);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found', type: OrderResponseDto })
  @ApiResponse({ status: 403, description: 'Order does not belong to user' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ) {
    const order: any = await this.orderService.getOrderById(id);
    
    // Admin can access all orders, regular users can only access their own
    if (user.role !== 'admin' && order?.order?.customerId !== user.userId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    
    return order;
  }

  @Get('customer/:customerId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get orders by customer ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Customer orders retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Cannot access other customer orders' })
  async getOrdersByCustomer(
    @CurrentUser() user: JwtUserPayload,
    @Param('customerId') customerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Only admin or the customer themselves can access orders
    if (user.role !== 'admin' && String(user.userId) !== customerId) {
      throw new ForbiddenException('You can only access your own orders');
    }
    return this.orderService.getOrdersByCustomer(customerId, page, limit);
  }

  @Patch(':id/status')
  @UseGuards(JwtGuard, AdminGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Update order status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Order status updated', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot cancel order' })
  @ApiResponse({ status: 403, description: 'Cannot cancel other user orders' })
  async cancelOrder(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ) {
    // Verify the order belongs to the user before cancelling
    const order: any = await this.orderService.getOrderById(id);
    if (user.role !== 'admin' && order?.order?.customerId !== user.userId) {
      throw new ForbiddenException('You can only cancel your own orders');
    }
    return this.orderService.cancelOrder(id, reason);
  }

  @Post(':id/items')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Add item to order' })
  @ApiResponse({ status: 200, description: 'Item added to order', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot add item to order' })
  @ApiResponse({ status: 403, description: 'Cannot modify other user orders' })
  async addItemToOrder(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') orderId: string,
    @Body() body: { productId: number | string; quantity: number; price?: number; unitPrice?: number },
  ) {
    // Verify the order belongs to the user before adding items
    const order: any = await this.orderService.getOrderById(orderId);
    if (user.role !== 'admin' && order?.order?.customerId !== user.userId) {
      throw new ForbiddenException('You can only modify your own orders');
    }
    
    const productId = String(body.productId);
    const quantity = body.quantity;
    const price = body.price ?? body.unitPrice ?? 0;
    return this.orderService.addItemToOrder(orderId, productId, quantity, price);
  }
}
