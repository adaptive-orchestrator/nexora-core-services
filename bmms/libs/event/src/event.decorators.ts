import { EventPattern } from '@nestjs/microservices';

/**
 * Decorator để lắng nghe events từ Kafka
 * @param topic - Topic name to subscribe
 */
export const OnEvent = (topic: string) => EventPattern(topic);

/**
 * Common event topics - Định nghĩa tất cả topics ở đây
 */
export const EventTopics = {
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  CUSTOMER_SEGMENT_CHANGED: 'segment.changed',

  // Catalogue events - Products
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  PRODUCT_STOCK_CHANGED: 'product.stock.changed',

  // Catalogue events - Plans
  PLAN_CREATED: 'plan.created',
  PLAN_UPDATED: 'plan.updated',
  PLAN_DELETED: 'plan.deleted',

  // Catalogue events - Features
  FEATURE_CREATED: 'feature.created',
  FEATURE_UPDATED: 'feature.updated',
  FEATURE_DELETED: 'feature.deleted',

  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_COMPLETED: 'order.completed',

  // Payment events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',

  // Inventory events
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
} as const;