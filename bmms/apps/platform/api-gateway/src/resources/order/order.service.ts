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

interface ICustomerGrpcService {
  getCustomerByUserId(data: { userId: string }): any;
}

@Injectable()
export class OrderService implements OnModuleInit {
  private orderService: IOrderGrpcService;
  private customerService: ICustomerGrpcService;

  constructor(
    @Inject('ORDER_PACKAGE')
    private readonly client: ClientGrpc,
    @Inject('CUSTOMER_PACKAGE')
    private readonly customerClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.orderService = this.client.getService<IOrderGrpcService>('OrderService');
    this.customerService = this.customerClient.getService<ICustomerGrpcService>('CustomerService');
  }

  async createOrder(dto: CreateOrderDto) {
    return firstValueFrom(this.orderService.createOrder(dto));
  }

  async getAllOrders(page: number = 1, limit: number = 10, customerId?: string) {
    return firstValueFrom(this.orderService.getAllOrders({ page, limit, customerId }));
  }

  async getOrderById(id: string) {
    return firstValueFrom(this.orderService.getOrderById({ id }));
  }

  async getOrdersByCustomer(customerId: string, page: number = 1, limit: number = 10) {
    return firstValueFrom(this.orderService.getOrdersByCustomer({ customerId, page, limit }));
  }

  async getOrdersForUser(userId: string, page: number = 1, limit: number = 10) {
    // Resolve customerId from userId via customer-svc
    const customerResp: any = await firstValueFrom(
      this.customerService.getCustomerByUserId({ userId })
    );

    const customerId = customerResp?.customer?.id;
    if (!customerId) {
      // No customer record yet → user has no orders
      return { orders: [], total: 0, page, limit };
    }

    return this.getOrdersByCustomer(customerId, page, limit);
  }

  async updateOrderStatus(id: string, dto: UpdateOrderStatusDto) {
    return firstValueFrom(this.orderService.updateOrderStatus({ 
      id, 
      status: dto.status,
      notes: dto.notes 
    }));
  }

  async cancelOrder(id: string, reason?: string) {
    return firstValueFrom(this.orderService.cancelOrder({ id, reason }));
  }

  async addItemToOrder(orderId: string, productId: string, quantity: number, unitPrice: number) {
    return firstValueFrom(this.orderService.addItemToOrder({ 
      orderId, 
      productId, 
      quantity, 
      price: unitPrice 
    }));
  }
}
