import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

interface IOrderGrpcService {
  createOrder(data: any): any;
  getAllOrders(data: any): any;
  getOrderById(data: any): any;
  getOrdersByCustomer(data: any): any;
  updateOrderStatus(data: any): any;
  cancelOrder(data: any): any;
  addItemToOrder(data: any): any;
}

@Injectable()
export class OrderService implements OnModuleInit {
  private orderService: IOrderGrpcService;

  constructor(
    @Inject('ORDER_PACKAGE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.orderService = this.client.getService<IOrderGrpcService>('OrderService');
  }

  async createOrder(dto: CreateOrderDto) {
    return firstValueFrom(this.orderService.createOrder(dto));
  }

  async getAllOrders(page: number = 1, limit: number = 10, customerId?: string) {
    return firstValueFrom(this.orderService.getAllOrders({ page, limit, customerId }));
  }

  async getOrderById(id: number) {
    return firstValueFrom(this.orderService.getOrderById({ id }));
  }

  async getOrdersByCustomer(customerId: string, page: number = 1, limit: number = 10) {
    return firstValueFrom(this.orderService.getOrdersByCustomer({ customerId: Number(customerId), page, limit }));
  }

  async updateOrderStatus(id: number, dto: UpdateOrderStatusDto) {
    return firstValueFrom(this.orderService.updateOrderStatus({ 
      id, 
      status: dto.status,
      notes: dto.notes 
    }));
  }

  async cancelOrder(id: number, reason?: string) {
    return firstValueFrom(this.orderService.cancelOrder({ id, reason }));
  }

  async addItemToOrder(orderId: number, productId: string, quantity: number, unitPrice: number) {
    return firstValueFrom(this.orderService.addItemToOrder({ 
      orderId, 
      productId: Number(productId), 
      quantity, 
      price: unitPrice 
    }));
  }
}
