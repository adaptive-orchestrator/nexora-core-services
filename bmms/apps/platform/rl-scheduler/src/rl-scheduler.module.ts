import { Module } from '@nestjs/common';
import { rlSchedulerController } from './rl-scheduler.controller';
import { rlSchedulerService } from './rl-scheduler.service';

@Module({
  imports: [],
  controllers: [rlSchedulerController],
  providers: [rlSchedulerService],
})
export class rlSchedulerModule {}
