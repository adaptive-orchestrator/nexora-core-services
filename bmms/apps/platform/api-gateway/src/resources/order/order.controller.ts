import { 
  Controller, 
  Post, 
  Get, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  Query,
  ParseIntPipe 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderResponseDto } from './dto/order-response.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully', type: OrderResponseDto })
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
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
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.getOrderById(id);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Get orders by customer ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Customer orders retrieved successfully' })
  async getOrdersByCustomer(
    @Param('customerId') customerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.orderService.getOrdersByCustomer(customerId, page, limit);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot cancel order' })
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason?: string,
  ) {
    return this.orderService.cancelOrder(id, reason);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to order' })
  @ApiResponse({ status: 200, description: 'Item added to order', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot add item to order' })
  async addItemToOrder(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() body: { productId: number | string; quantity: number; price?: number; unitPrice?: number },
  ) {
    const productId = String(body.productId);
    const quantity = body.quantity;
    const price = body.price ?? body.unitPrice ?? 0;
    return this.orderService.addItemToOrder(orderId, productId, quantity, price);
  }
}
