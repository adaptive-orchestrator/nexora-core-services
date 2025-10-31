import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { crmOrchestratorController } from './crm-orchestrator.controller';
import { crmOrchestratorService } from './crm-orchestrator.service';
import { CustomerSegmentationService } from './services/customer-segmentation.service';
import { CrmEventListener } from './listeners/crm-event.listener';
import { EventModule } from '@bmms/event';
import { CustomerLifecycleService } from './services/customer-lifecycle.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventModule.forRoot({
      clientId: 'crm-orchestrator',
      consumerGroupId: 'crm-group',
    }),
    // gRPC client to Customer Service
    ClientsModule.register([
      {
        name: 'CUSTOMER_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'customer',
          protoPath: join(__dirname, 'proto/customer.proto'),
          url: process.env.GRPC_SERVER_CUSTOMER_URL || '127.0.0.1:50052',
        },
      },
    ]),
  ],
  controllers: [crmOrchestratorController, CrmEventListener],
  providers: [
    crmOrchestratorService,
    CustomerSegmentationService,
    CustomerLifecycleService,
  ],
})
export class crmOrchestratorModule {}

