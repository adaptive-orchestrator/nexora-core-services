import { Controller, Get } from '@nestjs/common';
import { rlSchedulerService } from './rl-scheduler.service';

@Controller()
export class rlSchedulerController {
  constructor(private readonly rlSchedulerService: rlSchedulerService) {}

  @Get()
  getHello(): string {
    return this.rlSchedulerService.getHello();
  }
}
