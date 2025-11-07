/**
 * Base Event Interface - Tất cả events phải extend từ đây
 */
export interface BaseEvent {
  eventId: string; // UUID của event
  eventType: string; // Loại event
  timestamp: Date; // Thời gian xảy ra event
  source: string; // Service phát ra event
  version?: string; // Version của event schema
}

/**
 * Customer Events
 */

export interface UserCreatedEvent extends BaseEvent {
  eventType: 'user.created';
  data: {
    id: number;
    email: string;
    name: string;
    createdAt: Date;
    role: string;
  };
}

export interface CustomerCreatedEvent extends BaseEvent {
  eventType: 'customer.created';
  data: {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
    role: string;
  };
}

export interface CustomerUpdatedEvent extends BaseEvent {
  eventType: 'customer.updated';
  data: {
    customerId: number;
    changes: Record<string, any>;
  };
}

export interface SegmentChangedEvent extends BaseEvent {
  eventType: 'segment.changed';
  data: {
    customerId: number;
    segment: string;
  };
}

/**
 * Product Events
 */
export interface ProductCreatedEvent extends BaseEvent {
  eventType: 'product.created';
  data: {
    id: number;
    name: string;
    price: number;
    sku: string;
    category: string;
    createdAt: Date;
  };
}

export interface ProductUpdatedEvent extends BaseEvent {
  eventType: 'product.updated';
  data: {
    productId: number;
    changes: Record<string, any>;
  };
}

export interface ProductDeletedEvent extends BaseEvent {
  eventType: 'product.deleted';
  data: {
    productId: number;
  };
}

/**
 * Plan Events
 */
export interface PlanCreatedEvent extends BaseEvent {
  eventType: 'plan.created';
  data: {
    id: number;
    name: string;
    price: number;
    billingCycle: 'monthly' | 'yearly';
    featureIds: number[];
    createdAt: Date;
  };
}

export interface PlanUpdatedEvent extends BaseEvent {
  eventType: 'plan.updated';
  data: {
    planId: number;
    changes: Record<string, any>;
  };
}

export interface PlanDeletedEvent extends BaseEvent {
  eventType: 'plan.deleted';
  data: {
    planId: number;
  };
}

/**
 * Feature Events
 */
export interface FeatureCreatedEvent extends BaseEvent {
  eventType: 'feature.created';
  data: {
    id: number;
    name: string;
    code: string;
    createdAt: Date;
  };
}

export interface FeatureUpdatedEvent extends BaseEvent {
  eventType: 'feature.updated';
  data: {
    featureId: number;
    changes: Record<string, any>;
  };
}

export interface FeatureDeletedEvent extends BaseEvent {
  eventType: 'feature.deleted';
  data: {
    featureId: number;
  };
}

/**
 * Inventory Events
 */
export interface InventoryCreatedEvent extends BaseEvent {
  eventType: 'inventory.created';
  data: {
    id: number;
    productId: number;
    quantity: number;
    createdAt: Date;
  };
}

export interface InventoryAdjustedEvent extends BaseEvent {
  eventType: 'inventory.adjusted';
  data: {
    productId: number;
    previousQuantity: number;
    currentQuantity: number;
    adjustment: number;
    reason: 'restock' | 'damage' | 'loss' | 'adjustment' | 'correction';
  };
}

export interface InventoryReservedEvent extends BaseEvent {
  eventType: 'inventory.reserved';
  data: {
    reservationId: number;
    productId: number;
    quantity: number;
    orderId: number;
    customerId: number;
  };
}

export interface InventoryReleasedEvent extends BaseEvent {
  eventType: 'inventory.released';
  data: {
    productId: number;
    quantity: number;
    orderId: number;
    reason: 'order_cancelled' | 'order_completed' | 'manual_release';
  };
}

export interface InventoryLowStockEvent extends BaseEvent {
  eventType: 'inventory.low_stock';
  data: {
    productId: number;
    currentQuantity: number;
    reorderLevel: number;
  };
}

/**
 * Order Events
 */
export interface OrderCreatedEvent extends BaseEvent {
  eventType: 'order.created';
  data: {
    orderId: number;
    orderNumber: string; 
    customerId: number;
    items: Array<{
      productId: number;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
    status: string;
    createdAt: Date;
  };
}

export interface OrderUpdatedEvent extends BaseEvent {
  eventType: 'order.updated';
  data: {
    orderId: number;
    orderNumber: string;
    customerId: number;
    previousStatus: string;
    newStatus: string;
    changes?: {
      notes?: string;
      shippingAddress?: string;
      billingAddress?: string;
    };
    updatedAt: Date;
  };
}

export interface OrderCompletedEvent extends BaseEvent {
  eventType: 'order.completed';
  data: {
    orderId: number;
    orderNumber: string;
    customerId: number;
    totalAmount: number;
    completedAt: Date;
  };
}

export interface OrderCancelledEvent extends BaseEvent {
  eventType: 'order.cancelled';
  data: {
    orderId: number;
    orderNumber: string;
    customerId: number;
    reason: string;
  };
}

/**
 * Payment Events
 */

export interface PaymentInitiatedEvent extends BaseEvent {
  eventType: 'payment.initiated';
  data: {
    paymentId: number;
    invoiceId: number;
    invoiceNumber: string;
    orderId: number;
    customerId: number;
    amount: number;
    currency: string;
    method: string; // 'vnpay' | 'momo' | 'bank_transfer' | 'cash'
    paymentUrl?: string; // For redirect to payment gateway
  };
}

export interface PaymentSuccessEvent extends BaseEvent {
  eventType: 'payment.success';
  data: {
    paymentId: number;
    invoiceId: number;
    orderId: number;
    customerId: number;
    amount: number;
    method: string;
    transactionId: string; // Transaction ID from payment gateway (VNPay, etc.)
    paidAt: Date;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  eventType: 'payment.failed';
  data: {
    paymentId: number;
    invoiceId: number;
    orderId: number;
    customerId: number;
    amount: number;
    method: string;
    reason: string;
    errorCode?: string;
    canRetry: boolean;
  };
}

export interface PaymentRetryEvent extends BaseEvent {
  eventType: 'payment.retry';
  data: {
    paymentId: number;
    invoiceId: number;
    orderId: number;
    customerId: number;
    amount: number;
    retryCount: number;
    previousFailureReason: string;
  };
}

export interface PaymentRefundedEvent extends BaseEvent {
  eventType: 'payment.refunded';
  data: {
    paymentId: number;
    invoiceId: number;
    orderId: number;
    customerId: number;
    refundAmount: number;
    reason: string;
    refundedAt: Date;
  };
}

/**
 * Billing Events
 */
export interface InvoiceCreatedEvent extends BaseEvent {
  eventType: 'invoice.created';
  data: {
    invoiceId: number;
    invoiceNumber: string;
    orderId: number;
    orderNumber: string;
    customerId: number;
    totalAmount: number;
    dueDate: Date;
    status: string;
    createdAt: Date;
  };
}

export interface InvoiceUpdatedEvent extends BaseEvent {
  eventType: 'invoice.updated';
  data: {
    invoiceId: number;
    invoiceNumber: string;
    customerId: number;
    previousStatus: string;
    newStatus: string;
  };
}

export interface InvoiceOverdueEvent extends BaseEvent {
  eventType: 'invoice.overdue';
  data: {
    invoiceId: number;
    invoiceNumber: string;
    customerId: number;
    dueAmount: number;
    dueDate: Date;
  };
}

/**
 * Subscription Events
 */
export interface SubscriptionCreatedEvent extends BaseEvent {
  eventType: 'subscription.created';
  data: {
    subscriptionId: number;
    customerId: number;
    planId: number;
    planName: string;
    status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEnd?: Date;
    amount: number;
    billingCycle: 'monthly' | 'yearly';
    createdAt: Date;
  };
}

export interface SubscriptionUpdatedEvent extends BaseEvent {
  eventType: 'subscription.updated';
  data: {
    subscriptionId: number;
    customerId: number;
    changes: Record<string, any>;
    previousStatus?: string;
    newStatus?: string;
  };
}

export interface SubscriptionRenewedEvent extends BaseEvent {
  eventType: 'subscription.renewed';
  data: {
    subscriptionId: number;
    customerId: number;
    planId: number;
    previousPeriodEnd: Date;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    amount: number;
    renewedAt: Date;
  };
}

export interface SubscriptionCancelledEvent extends BaseEvent {
  eventType: 'subscription.cancelled';
  data: {
    subscriptionId: number;
    customerId: number;
    planId: number;
    cancelledAt: Date;
    cancelAtPeriodEnd: boolean;
    reason?: string;
  };
}

export interface SubscriptionExpiredEvent extends BaseEvent {
  eventType: 'subscription.expired';
  data: {
    subscriptionId: number;
    customerId: number;
    planId: number;
    expiredAt: Date;
    reason: 'trial_ended' | 'payment_failed' | 'cancelled' | 'admin_action';
  };
}

export interface SubscriptionTrialStartedEvent extends BaseEvent {
  eventType: 'subscription.trial.started';
  data: {
    subscriptionId: number;
    customerId: number;
    planId: number;
    trialStart: Date;
    trialEnd: Date;
    trialDays: number;
  };
}

export interface SubscriptionTrialEndingEvent extends BaseEvent {
  eventType: 'subscription.trial.ending';
  data: {
    subscriptionId: number;
    customerId: number;
    planId: number;
    trialEnd: Date;
    daysRemaining: number;
  };
}

export interface SubscriptionTrialEndedEvent extends BaseEvent {
  eventType: 'subscription.trial.ended';
  data: {
    subscriptionId: number;
    customerId: number;
    planId: number;
    trialEnd: Date;
    convertedToActive: boolean;
  };
}

export interface SubscriptionPlanChangedEvent extends BaseEvent {
  eventType: 'subscription.plan.changed';
  data: {
    subscriptionId: number;
    customerId: number;
    previousPlanId: number;
    newPlanId: number;
    previousAmount: number;
    newAmount: number;
    changeType: 'upgrade' | 'downgrade';
    effectiveDate: Date;
  };
}

/**
 * Promotion Events
 */
export interface PromotionCreatedEvent extends BaseEvent {
  eventType: 'promotion.created';
  data: {
    promotionId: number;
    code: string;
    type: 'percentage' | 'fixed_amount' | 'trial_extension';
    value: number;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
  };
}

export interface PromotionAppliedEvent extends BaseEvent {
  eventType: 'promotion.applied';
  data: {
    promotionId: number;
    code: string;
    customerId: number;
    subscriptionId?: number;
    invoiceId?: number;
    discountAmount: number;
    appliedAt: Date;
  };
}

export interface PromotionExpiredEvent extends BaseEvent {
  eventType: 'promotion.expired';
  data: {
    promotionId: number;
    code: string;
    expiredAt: Date;
  };
}

/**
 * Helper function để tạo base event
 */
export function createBaseEvent(
  eventType: string,
  source: string,
): BaseEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date(),
    source,
    version: '1.0',
  };
}