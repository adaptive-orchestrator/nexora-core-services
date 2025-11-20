import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as event from '@bmms/event';
import { OrderSvcService } from './order-svc.service';
import { Order } from './entities/order.entity';

@Controller()
export class OrderEventListener {
  private readonly logger = new Logger(OrderEventListener.name);

  constructor(
    private readonly orderSvcService: OrderSvcService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /** ------------------- Customer Events ------------------- */

  @EventPattern(event.EventTopics.CUSTOMER_CREATED)
  async handleCustomerCreated(@Payload() event: any) {
    try {
      this.logEvent(event);
      console.log('📨 RAW EVENT RECEIVED:', JSON.stringify(event, null, 2));

      // TODO: Implement business logic
      // e.g., create welcome voucher, send welcome email
      // If needed, use gRPC client to call Customer Service

    } catch (error) {
      console.error('Error handling CUSTOMER_CREATED event:', error);
    }
  }

  @EventPattern(event.EventTopics.CUSTOMER_UPDATED)
  async handleCustomerUpdated(@Payload() event: event.CustomerUpdatedEvent) {
    try {
      this.logEvent(event);

      // TODO: Implement business logic
      // e.g., update local cache, notify other services
      // await this.customerService.handleCustomerUpdate(event.data.customerId, event.data.changes);

    } catch (error) {
      console.error('Error handling CUSTOMER_UPDATED event:', error);
    }
  }

  /** -------- Inventory Events -------- */

  @EventPattern(event.EventTopics.INVENTORY_RESERVED)
  async handleInventoryReserved(@Payload() event: any) {
    try {
      this.logEvent(event);
      const { orderId } = event.data;
      // TODO: Mark order as "stock confirmed" if all items reserved
      console.log(`✅ Inventory reserved for order ${orderId}`);
    } catch (error) {
      console.error('❌ Error handling INVENTORY_RESERVED:', error);
    }
  }

  @EventPattern(event.EventTopics.INVENTORY_RELEASED)
  async handleInventoryReleased(@Payload() event: event.InventoryReleasedEvent) {
    try {
      this.logEvent(event);
      const { orderId, reason } = event.data;
      
      if (reason === 'order_cancelled') {
        // await this.orderService.updateStatus(orderId, 'cancelled');
        console.log(`📦 Inventory released for cancelled order ${orderId}`);
      }
    } catch (error) {
      console.error('❌ Error handling INVENTORY_RELEASED:', error);
    }
  }

  /** ------------------- Payment Events ------------------- */

  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() event: event.PaymentSuccessEvent) {
    try {
      this.logEvent(event);
      this.logger.debug('💰 handlePaymentSuccess TRIGGERED');

      const { orderId, transactionId, amount } = event.data;

      if (!orderId) {
        this.logger.warn('No orderId in payment success event');
        return;
      }

      // Update order status to paid
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found`);
        return;
      }

      order.status = 'paid';
      order.paymentStatus = 'paid';
      await this.orderRepository.save(order);

      this.logger.log(`✅ Order ${orderId} marked as PAID with transaction ${transactionId}`);

    } catch (error) {
      this.logger.error('Error handling PAYMENT_SUCCESS event:', error);
    }
  }
  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() event: event.PaymentFailedEvent) {
    try {
      this.logEvent(event);
      this.logger.debug('❌ handlePaymentFailed TRIGGERED');
      
      const { orderId, reason } = event.data;

      if (!orderId) {
        this.logger.warn('No orderId in payment failed event');
        return;
      }

      // Update order status to failed
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found`);
        return;
      }

      order.status = 'failed';
      order.paymentStatus = 'failed';
      await this.orderRepository.save(order);

      this.logger.warn(`❌ Order ${orderId} marked as FAILED: ${reason}`);

      // TODO: Send notification to customer about payment failure
      // await this.notificationService.sendPaymentFailureAlert(orderId, reason);

    } catch (error) {
      console.error('❌ Error handling PAYMENT_FAILED:', error);
    }
  }


  /** ------------------- Helper ------------------- */
  private logEvent<T extends { eventType: string }>(event: T) {
    console.log(`📥 Received event [${event.eventType}] at ${new Date().toISOString()}:`, event);
  }
}