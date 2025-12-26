import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload, ClientKafka } from '@nestjs/microservices';
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
    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  /** ------------------- Customer Events ------------------- */

  @EventPattern(event.EventTopics.CUSTOMER_CREATED)
  async handleCustomerCreated(@Payload() evt: any) {
    try {
      this.logEvent(evt);
      console.log('[OrderEvent] RAW EVENT RECEIVED:', JSON.stringify(evt, null, 2));

      // TODO: Implement business logic
      // e.g., create welcome voucher, send welcome email
      // If needed, use gRPC client to call Customer Service

    } catch (error) {
      console.error('Error handling CUSTOMER_CREATED event:', error);
    }
  }

  @EventPattern(event.EventTopics.CUSTOMER_UPDATED)
  async handleCustomerUpdated(@Payload() evt: event.CustomerUpdatedEvent) {
    try {
      this.logEvent(evt);

      // TODO: Implement business logic
      // e.g., update local cache, notify other services
      // await this.customerService.handleCustomerUpdate(evt.data.customerId, evt.data.changes);

    } catch (error) {
      console.error('Error handling CUSTOMER_UPDATED event:', error);
    }
  }

  /** -------- Inventory Events -------- */

  @EventPattern(event.EventTopics.INVENTORY_RESERVED)
  async handleInventoryReserved(@Payload() evt: any) {
    const startTime = Date.now();
    let orderId: string | undefined;
    let order: Order | null = null;

    try {
      this.logEvent(evt);
      this.logger.log('[INVENTORY_RESERVED] Handler triggered');
      this.logger.debug('[INVENTORY_RESERVED] Raw event payload:', JSON.stringify(evt, null, 2));

      // Extract data from event (handle both wrapped and direct formats)
      const eventData = evt?.data || evt?.value?.data || evt;
      orderId = eventData?.orderId;
      let customerId = eventData?.customerId;
      let totalAmount = eventData?.totalAmount;

      // Validate orderId is present
      if (!orderId) {
        this.logger.error('[INVENTORY_RESERVED] Missing orderId in event, cannot process');
        return;
      }

      // Fetch order from DB
      order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items'],
      });

      if (!order) {
        this.logger.warn(`[INVENTORY_RESERVED] Order ${orderId} not found in database`);
        return;
      }

      // Fill missing values from order record
      if (!customerId) {
        customerId = order.customerId;
        this.logger.debug(`[INVENTORY_RESERVED] CustomerId fetched from DB: ${customerId}`);
      }
      if (!totalAmount || totalAmount === 0) {
        totalAmount = Number(order.totalAmount);
        this.logger.debug(`[INVENTORY_RESERVED] TotalAmount fetched from DB: ${totalAmount}`);
      }

      // Idempotency guard: skip if order already processed
      const skipStatuses = ['confirmed', 'paid', 'cancelled', 'failed', 'processing', 'shipped', 'delivered'];
      if (skipStatuses.includes(order.status)) {
        this.logger.log(`[INVENTORY_RESERVED] Order ${orderId} already in status '${order.status}', skipping (idempotency)`);
        return;
      }

      // Update order status to confirmed with pending payment
      const previousStatus = order.status;
      order.status = 'confirmed';
      order.paymentStatus = 'pending';
      
      await this.orderRepository.save(order);
      this.logger.log(`[INVENTORY_RESERVED] Order ${orderId} status updated: ${previousStatus} → confirmed`);

      // Emit event to start billing/payment flow
      const orderConfirmedEvent = {
        ...event.createBaseEvent('order.confirmed', 'order-svc'),
        eventType: 'order.confirmed',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: customerId,
          totalAmount: totalAmount,
        },
      };

      this.logger.log(`[INVENTORY_RESERVED] Emitting order.confirmed for billing/payment flow`);
      this.logger.debug('[INVENTORY_RESERVED] order.confirmed payload:', JSON.stringify(orderConfirmedEvent, null, 2));
      
      this.kafka.emit('order.confirmed', orderConfirmedEvent);

      // Also emit payment.initiate for direct payment processing
      const paymentInitiateEvent = {
        ...event.createBaseEvent('payment.initiate', 'order-svc'),
        eventType: 'payment.initiate',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: customerId,
          amount: totalAmount,
        },
      };

      this.logger.log(`[INVENTORY_RESERVED] Emitting payment.initiate for direct payment processing`);
      this.kafka.emit('payment.initiate', paymentInitiateEvent);

      const duration = Date.now() - startTime;
      this.logger.log(`[INVENTORY_RESERVED] Successfully processed order ${orderId} in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[INVENTORY_RESERVED] Error processing order ${orderId} after ${duration}ms:`, error);
      this.logger.error('[INVENTORY_RESERVED] Error stack:', error?.stack);

      // Compensation: Emit inventory release request on failure
      if (orderId) {
        try {
          const releaseEvent = {
            ...event.createBaseEvent('inventory.release_request', 'order-svc'),
            eventType: 'inventory.release_request',
            data: {
              orderId: orderId,
              reason: 'handler_failed',
              errorMessage: error?.message || 'Unknown error in INVENTORY_RESERVED handler',
            },
          };

          this.logger.warn(`[INVENTORY_RESERVED] Emitting compensation event: inventory.release_request for order ${orderId}`);
          this.kafka.emit(event.EventTopics.INVENTORY_RELEASE_REQUEST, releaseEvent);
        } catch (compensationError) {
          this.logger.error(`[INVENTORY_RESERVED] Failed to emit compensation event:`, compensationError);
        }
      }
    }
  }

  @EventPattern(event.EventTopics.INVENTORY_RESERVE_FAILED)
  async handleInventoryReserveFailed(@Payload() evt: any) {
    try {
      this.logEvent(evt);
      this.logger.warn('[INVENTORY_RESERVE_FAILED] Handler triggered');
      this.logger.debug('[INVENTORY_RESERVE_FAILED] Raw event payload:', JSON.stringify(evt, null, 2));

      // Extract data from event
      const eventData = evt?.data || evt?.value?.data || evt;
      const { orderId, reason, unavailableItems } = eventData;

      if (!orderId) {
        this.logger.error('[INVENTORY_RESERVE_FAILED] Missing orderId in event');
        return;
      }

      // Fetch order from DB
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`[INVENTORY_RESERVE_FAILED] Order ${orderId} not found`);
        return;
      }

      // Idempotency guard
      if (order.status === 'cancelled' || order.status === 'failed') {
        this.logger.log(`[INVENTORY_RESERVE_FAILED] Order ${orderId} already ${order.status}, skipping`);
        return;
      }

      // Update order status
      const previousStatus = order.status;
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await this.orderRepository.save(order);

      this.logger.warn(`[INVENTORY_RESERVE_FAILED] Order ${orderId} cancelled due to: ${reason}`);
      this.logger.warn(`[INVENTORY_RESERVE_FAILED] Unavailable items:`, JSON.stringify(unavailableItems));

      // TODO: Integrate NotificationService to send out-of-stock email
      // await this.notificationService.sendOutOfStockEmail(order.customerId, orderId, unavailableItems);

      this.logger.log(`[INVENTORY_RESERVE_FAILED] Order ${orderId} status: ${previousStatus} → cancelled`);

    } catch (error) {
      this.logger.error('[INVENTORY_RESERVE_FAILED] Error handling event:', error);
    }
  }

  @EventPattern(event.EventTopics.INVENTORY_RELEASED)
  async handleInventoryReleased(@Payload() evt: event.InventoryReleasedEvent) {
    try {
      this.logEvent(evt);
      const { orderId, reason } = evt.data;
      
      if (reason === 'order_cancelled') {
        // await this.orderService.updateStatus(orderId, 'cancelled');
        console.log(`[OrderEvent] Inventory released for cancelled order ${orderId}`);
      }
    } catch (error) {
      console.error('[ERROR] Error handling INVENTORY_RELEASED:', error);
    }
  }

  /** ------------------- Payment Events ------------------- */

  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() evt: event.PaymentSuccessEvent) {
    try {
      this.logEvent(evt);
      this.logger.debug('[OrderEvent] handlePaymentSuccess TRIGGERED');

      const { orderId, transactionId, amount } = evt.data;

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

      this.logger.log(`[OrderEvent] Order ${orderId} marked as PAID with transaction ${transactionId}`);

    } catch (error) {
      this.logger.error('Error handling PAYMENT_SUCCESS event:', error);
    }
  }
  @EventPattern(event.EventTopics.PAYMENT_FAILED)
  async handlePaymentFailed(@Payload() evt: event.PaymentFailedEvent) {
    const startTime = Date.now();
    let orderId: string | undefined;
    let retryCount = 0;
    const maxRetries = 3;

    try {
      this.logEvent(evt);
      this.logger.warn('[PAYMENT_FAILED] Handler triggered');
      this.logger.debug('[PAYMENT_FAILED] Raw event payload:', JSON.stringify(evt, null, 2));
      
      // Extract data from event (handle both wrapped and direct formats)
      const eventData = (evt as any)?.data || (evt as any)?.value?.data || evt;
      orderId = eventData?.orderId;
      const reason = eventData?.reason || 'Unknown payment failure';
      const canRetry = eventData?.canRetry ?? false;
      const errorCode = eventData?.errorCode;

      if (!orderId) {
        this.logger.error('[PAYMENT_FAILED] Missing orderId in event, cannot process');
        return;
      }

      // Fetch order from DB with retry logic
      let order: Order | null = null;
      while (retryCount < maxRetries) {
        try {
          order = await this.orderRepository.findOne({
            where: { id: orderId },
          });
          break;
        } catch (dbError) {
          retryCount++;
          this.logger.warn(`[PAYMENT_FAILED] DB fetch retry ${retryCount}/${maxRetries} for order ${orderId}`);
          if (retryCount >= maxRetries) throw dbError;
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
      }

      if (!order) {
        this.logger.error(`[PAYMENT_FAILED] Order ${orderId} not found in database`);
        return;
      }

      // Idempotency guard: skip if order already cancelled
      if (order.status === 'cancelled') {
        this.logger.log(`[PAYMENT_FAILED] Order ${orderId} already cancelled, skipping (idempotency)`);
        return;
      }

      // Update order status
      const previousStatus = order.status;
      const previousPaymentStatus = order.paymentStatus;
      order.status = 'cancelled';
      order.paymentStatus = 'failed';

      // Save with retry logic
      retryCount = 0;
      while (retryCount < maxRetries) {
        try {
          await this.orderRepository.save(order);
          break;
        } catch (saveError) {
          retryCount++;
          this.logger.warn(`[PAYMENT_FAILED] DB save retry ${retryCount}/${maxRetries} for order ${orderId}`);
          if (retryCount >= maxRetries) throw saveError;
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
      }

      this.logger.warn(`[PAYMENT_FAILED] Order ${orderId} marked as CANCELLED`);
      this.logger.warn(`[PAYMENT_FAILED] Status change: ${previousStatus} → cancelled`);
      this.logger.warn(`[PAYMENT_FAILED] PaymentStatus change: ${previousPaymentStatus} → failed`);
      this.logger.warn(`[PAYMENT_FAILED] Failure reason: ${reason} (errorCode: ${errorCode || 'N/A'})`);

      // Emit rollback event to Inventory to release reserved stock
      const orderCancelledEvent = {
        ...event.createBaseEvent('order.cancelled', 'order-svc'),
        eventType: 'order.cancelled',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          reason: `Payment failed: ${reason}`,
          previousStatus: previousStatus,
          cancelledAt: new Date().toISOString(),
        },
      };

      this.logger.log(`[PAYMENT_FAILED] Emitting order.cancelled to trigger inventory release`);
      this.logger.debug('[PAYMENT_FAILED] order.cancelled payload:', JSON.stringify(orderCancelledEvent, null, 2));
      
      this.kafka.emit(event.EventTopics.ORDER_CANCELLED, orderCancelledEvent);

      // TODO: Integrate NotificationService
      // await this.notificationService.sendPaymentFailedEmail(order.customerId, orderId, reason);

      // Log retry possibility for monitoring/alerting
      if (canRetry) {
        this.logger.log(`[PAYMENT_FAILED] Payment for order ${orderId} can be retried`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`[PAYMENT_FAILED] Processed order ${orderId} cancellation in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[PAYMENT_FAILED] Error processing order ${orderId} after ${duration}ms:`, error);
      this.logger.error('[PAYMENT_FAILED] Error stack:', (error as any)?.stack);
    }
  }


  /** ------------------- Helper ------------------- */
  private logEvent<T extends { eventType: string }>(event: T) {
    //console.log(`[OrderEvent] Received event [${event.eventType}] at ${new Date().toISOString()}:`, event);
  }
}