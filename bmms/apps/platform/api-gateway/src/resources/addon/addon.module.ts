import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { subscriptionGrpcOptions } from '../../client-options/subscription.grpc-client';
import { AddonController } from './addon.controller';
import { AddonService } from './addon.service';

@Module({
  imports: [ClientsModule.register([subscriptionGrpcOptions])],
  controllers: [AddonController],
  providers: [AddonService],
  exports: [AddonService],
})
export class AddonModule {}
