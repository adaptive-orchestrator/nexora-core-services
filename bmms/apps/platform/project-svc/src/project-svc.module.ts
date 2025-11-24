import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@bmms/db';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectSvcController } from './project-svc.controller';
import { ProjectSvcService } from './project-svc.service';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([Project, Task]), 
    DbModule.forRoot({ prefix: 'PROJECT_SVC' }),
  ],
  controllers: [ProjectSvcController],
  providers: [ProjectSvcService],
  exports: [ProjectSvcService], 
})
export class ProjectSvcModule {}
