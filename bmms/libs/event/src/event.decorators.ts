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
  PAYMENT_RETRY: 'payment.retry',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Billing events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_UPDATED: 'invoice.updated',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_PAID: 'invoice.paid',
  BILLING_CREDIT_APPLIED: 'billing.credit.applied',
  
  // Inventory events
  INVENTORY_CREATED: 'inventory.created',
  INVENTORY_ADJUSTED: 'inventory.adjusted',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
  INVENTORY_LOW_STOCK: 'inventory.low_stock',

  // Subscription events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
  SUBSCRIPTION_TRIAL_STARTED: 'subscription.trial.started',
  SUBSCRIPTION_TRIAL_ENDING: 'subscription.trial.ending',
  SUBSCRIPTION_TRIAL_ENDED: 'subscription.trial.ended',
  SUBSCRIPTION_PLAN_CHANGED: 'subscription.plan.changed',

  // Add-on events (NEW)
  ADDON_PURCHASED: 'addon.purchased',
  ADDON_RENEWED: 'addon.renewed',
  ADDON_CANCELLED: 'addon.cancelled',

  // Promotion events
  PROMOTION_CREATED: 'promotion.created',
  PROMOTION_APPLIED: 'promotion.applied',
  PROMOTION_EXPIRED: 'promotion.expired',
} as const;