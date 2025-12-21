import { Controller, Get } from '@nestjs/common';
import { JobSchedulerService } from './job-scheduler.service';

@Controller()
export class JobSchedulerController {
  constructor(private readonly jobSchedulerService: JobSchedulerService) {}

  @Get()
  getHello(): string {
    return this.jobSchedulerService.getHello();
  }
}
