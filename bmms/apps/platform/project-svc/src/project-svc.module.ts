import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@bmms/db';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectSvcController } from './project-svc.controller';
import { ProjectSvcService } from './project-svc.service';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([Project, Task]),
    DbModule.forRoot({ prefix: 'PROJECT_SVC' }),
    ClientsModule.register([
      {
        name: 'SUBSCRIPTION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'subscription',
          protoPath: join(__dirname, '../../order/subscription-svc/src/proto/subscription.proto'),
          url: '0.0.0.0:50059',
        },
      },
    ]),
  ],
  controllers: [ProjectSvcController],
  providers: [ProjectSvcService],
  exports: [ProjectSvcService],
})
export class ProjectSvcModule {}
