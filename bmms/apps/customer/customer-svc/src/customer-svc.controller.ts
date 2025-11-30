import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { CustomerSvcService } from './customer-svc.service';

@Controller()
export class CustomerSvcController {
  private readonly logger = new Logger(CustomerSvcController.name);

  constructor(private readonly service: CustomerSvcService) {}

  @GrpcMethod('CustomerService', 'GetAllCustomers')
  async getAllCustomers(data: any) {
    this.logger.log('GetAllCustomers called');
    const { page = 1, limit = 10, segment } = data;
    
    const customers = await this.service.findAll(page, limit, segment);
    return {
      customers,
      total: customers.length,
      page,
      limit,
    };
  }

  @GrpcMethod('CustomerService', 'GetCustomerById')
  async getCustomerById(data: { id: number }) {
    try {
      this.logger.log(`GetCustomerById called with id: ${data.id}`);
      const customer = await this.service.findOne(data.id);
      this.logger.log(`GetCustomerById success: ${JSON.stringify(customer)}`);
      return { customer };
    } catch (error) {
      this.logger.error(`GetCustomerById error for id ${data.id}:`, error);
      if (error.status === 404 || error.name === 'NotFoundException') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: `Customer with id ${data.id} not found`,
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  }

  @GrpcMethod('CustomerService', 'GetCustomerByEmail')
  async getCustomerByEmail(data: { email: string }) {
    try {
      this.logger.log(`GetCustomerByEmail called with email: ${data.email}`);
      const customer = await this.service.findByEmail(data.email);
      this.logger.log(`GetCustomerByEmail success: ${JSON.stringify(customer)}`);
      return { customer };
    } catch (error) {
      this.logger.error(`GetCustomerByEmail error for email ${data.email}:`, error);
      if (error.status === 404 || error.name === 'NotFoundException') {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: `Customer with email ${data.email} not found`,
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  }

  @GrpcMethod('CustomerService', 'GetCustomerByUserId')
  async getCustomerByUserId(data: { userId: number }) {
    this.logger.log(`GetCustomerByUserId called with userId: ${data.userId}`);
    const customer = await this.service.findByUserId(data.userId);
    return { customer };
  }

  @GrpcMethod('CustomerService', 'UpdateCustomer')
  async updateCustomer(data: any) {
    this.logger.log(`UpdateCustomer called with id: ${data.id}`);
    const { id, ...updateData } = data;
    const customer = await this.service.update(id, updateData);
    return { customer };
  }

  @GrpcMethod('CustomerService', 'DeleteCustomer')
  async deleteCustomer(data: { id: number }) {
    this.logger.log(`DeleteCustomer called with id: ${data.id}`);
    await this.service.remove(data.id);
    return { success: true, message: 'Customer deleted successfully' };
  }

  @GrpcMethod('CustomerService', 'CreateCustomerInternal')
  async createCustomerInternal(data: { name: string; email: string }) {
    this.logger.log(`CreateCustomerInternal called for email: ${data.email}`);
    const customer = await this.service.create(data);
    return { customer };
  }
}
