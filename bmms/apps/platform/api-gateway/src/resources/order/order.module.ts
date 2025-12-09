import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { orderGrpcOptions } from '../../client-options/order.grpc-client';
import { customerGrpcClientOptions } from '../../client-options/customer.grpc-client';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [ClientsModule.register([orderGrpcOptions, {
    ...customerGrpcClientOptions,
    name: 'CUSTOMER_PACKAGE',
  }])],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
