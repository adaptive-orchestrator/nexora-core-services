import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CustomerSvcService } from './customer-svc.service';
import type { UserCreatedEvent } from '@bmms/event';

@Controller()
export class CustomerEventListener {
  private readonly logger = new Logger(CustomerEventListener.name);

  constructor(private readonly customerService: CustomerSvcService) {}

  @EventPattern('user.created')
  async handleUserCreated(@Payload() event: UserCreatedEvent) {
    this.logger.log(`Received user.created event for user: ${event.data.email}`);

    try {
      // Auto-create customer profile when user signs up
      const customer = await this.customerService.create({
        name: event.data.name,
        email: event.data.email,
        userId: event.data.id, // Link to Auth User
        role: event.data.role,
      });

      this.logger.log(`Customer profile created successfully for user: ${event.data.email}, customer ID: ${customer.id}`);
    } catch (error) {
      this.logger.error(`Failed to create customer profile for user: ${event.data.email}`, error.stack);
      // In production, you might want to implement retry logic or dead letter queue
    }
  }
}
