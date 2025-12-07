import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { OrderSvcService } from './order-svc.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller()
export class OrderSvcController {
  constructor(private readonly service: OrderSvcService) {}

  @GrpcMethod('OrderService', 'CreateOrder')
  async createOrder(data: any) {
    console.log('[OrderController] Received data:', JSON.stringify(data));
    console.log('[OrderController] customerId:', data.customerId);
    console.log('[OrderController] customerId type:', typeof data.customerId);
    const order = await this.service.create(data);
    return { order };
  }

  @GrpcMethod('OrderService', 'GetAllOrders')
  async getAllOrders(data: { page?: number; limit?: number; customerId?: string }) {
    const orders = await this.service.list(data.page || 1, data.limit || 10);
    return { orders, total: orders.length, page: data.page || 1, limit: data.limit || 10 };
  }

  @GrpcMethod('OrderService', 'GetOrderById')
  async getOrderById(data: { id: string }) {
    const order = await this.service.getById(data.id);
    return { order };
  }

  @GrpcMethod('OrderService', 'GetOrdersByCustomer')
  async getOrdersByCustomer(data: { customerId: string; page?: number; limit?: number }) {
    const orders = await this.service.listByCustomer(data.customerId);
    return { orders, total: orders.length, page: data.page || 1, limit: data.limit || 10 };
  }

  @GrpcMethod('OrderService', 'UpdateOrderStatus')
  async updateOrderStatus(data: { id: string; status: string }) {
    const order = await this.service.updateStatus(data.id, { status: data.status } as UpdateStatusDto);
    return { order };
  }

  @GrpcMethod('OrderService', 'CancelOrder')
  async cancelOrder(data: { id: string; reason?: string }) {
    const order = await this.service.cancel(data.id, data.reason);
    return { order };
  }

  @GrpcMethod('OrderService', 'AddItemToOrder')
  async addItemToOrder(data: { orderId: string; productId: string; quantity: number; price: number }) {
    const order = await this.service.addItem(data.orderId, {
      productId: data.productId,
      quantity: data.quantity,
      price: data.price,
    });
    return { order };
  }

  @GrpcMethod('OrderService', 'GetOrderStats')
  async getOrderStats(data: any) {
    const stats = await this.service.getStats();
    return stats;
  }
}