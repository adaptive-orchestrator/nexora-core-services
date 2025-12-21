import { Controller, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { CustomerSegmentationService } from '../services/customer-segmentation.service';
import { CustomerLifecycleService } from '../services/customer-lifecycle.service';
import { firstValueFrom } from 'rxjs';

interface ICustomerGrpcService {
  getCustomerById(data: { id: number }): any;
  updateCustomer(data: any): any;
}

@Controller()
export class CrmEventListener implements OnModuleInit {
  private readonly logger = new Logger(CrmEventListener.name);
  private customerService: ICustomerGrpcService;

  constructor(
    @Inject('CUSTOMER_SERVICE') private client: ClientGrpc,
    private segmentationService: CustomerSegmentationService,
    private lifecycleService: CustomerLifecycleService,
  ) {}

  onModuleInit() {
    this.customerService = this.client.getService<ICustomerGrpcService>('CustomerService');
  }

  /**
   * Listen to order.completed events and update customer data
   */
  @EventPattern('order.completed')
  async handleOrderCompleted(@Payload() event: any) {
    this.logger.log(`Received order.completed event: Order ${event.data.orderId}`);

    try {
      const { customerId, totalAmount } = event.data;

      // Get current customer data
      const customerResponse: any = await firstValueFrom(
        this.customerService.getCustomerById({ id: customerId })
      );
      const customer = customerResponse.customer;

      // Calculate new values
      const newTotalSpent = Number(customer.totalSpent || 0) + Number(totalAmount);
      const newOrderCount = (customer.orderCount || 0) + 1;
      const lastOrderDate = new Date();

      // Calculate new segment and lifecycle stage
      const newSegment = this.segmentationService.calculateSegment(newTotalSpent);
      const newLifecycleStage = this.lifecycleService.calculateLifecycleStage(
        newOrderCount,
        lastOrderDate,
        newTotalSpent
      );

      // Update customer
      await firstValueFrom(
        this.customerService.updateCustomer({
          id: customerId,
          totalSpent: newTotalSpent,
          orderCount: newOrderCount,
          lastOrderDate: lastOrderDate.toISOString(),
          segment: newSegment,
          lifecycleStage: newLifecycleStage,
        })
      );

      this.logger.log(
        `Customer ${customerId} updated: Segment=${newSegment}, Lifecycle=${newLifecycleStage}, TotalSpent=$${newTotalSpent}, Orders=${newOrderCount}`
      );

      // Log segment upgrade
      if (customer.segment !== newSegment) {
        this.logger.log(`Customer ${customerId} upgraded from ${customer.segment} to ${newSegment}!`);
        const benefits = this.segmentationService.getSegmentBenefits(newSegment);
        this.logger.log(`New benefits: ${benefits.join(', ')}`);
      }

      // Check if at risk of churning
      if (this.lifecycleService.isAtRiskOfChurning(lastOrderDate, newOrderCount)) {
        this.logger.warn(`[WARNING] Customer ${customerId} is at risk of churning!`);
      }

    } catch (error) {
      this.logger.error(`Failed to process order.completed event: ${error.message}`, error.stack);
    }
  }

  /**
   * Listen to payment.success events (alternative trigger)
   */
  @EventPattern('payment.success')
  async handlePaymentSuccess(@Payload() event: any) {
    this.logger.log(`Received payment.success event: Payment ${event.data.paymentId}`);
    // Can also trigger customer update here
  }

  /**
   * Periodic job to detect churned customers
   */
  @EventPattern('crm.check-churn')
  async handleChurnCheck(@Payload() event: any) {
    this.logger.log('Running churn detection...');
    // This would be triggered by a scheduler
    // Get all active customers and check last order date
    // Update to churned if > 90 days
  }
}
