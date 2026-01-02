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
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    role: string;
  };
}

export interface CustomerCreatedEvent extends BaseEvent {
  eventType: 'customer.created';
  data: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    role: string;
  };
}

export interface CustomerUpdatedEvent extends BaseEvent {
  eventType: 'customer.updated';
  data: {
    customerId: string;
    changes: Record<string, any>;
  };
}

export interface SegmentChangedEvent extends BaseEvent {
  eventType: 'segment.changed';
  data: {
    customerId: string;
    segment: string;
  };
}

/**
 * Product Events
 */
export interface ProductCreatedEvent extends BaseEvent {
  eventType: 'product.created';
  data: {
    id: string;
    name: string;
    price: number;
    sku: string;
    category: string;
    ownerId?: string; // Owner of the product (for multi-tenant support)
    createdAt: Date;
  };
}

export interface ProductUpdatedEvent extends BaseEvent {
  eventType: 'product.updated';
  data: {
    productId: string;
    changes: Record<string, any>;
  };
}

export interface ProductDeletedEvent extends BaseEvent {
  eventType: 'product.deleted';
  data: {
    productId: string;
  };
}

/**
 * Plan Events
 */
export interface PlanCreatedEvent extends BaseEvent {
  eventType: 'plan.created';
  data: {
    id: string;
    name: string;
    price: number;
    billingCycle: 'monthly' | 'yearly';
    featureIds: string[];
    createdAt: Date;
  };
}

export interface PlanUpdatedEvent extends BaseEvent {
  eventType: 'plan.updated';
  data: {
    planId: string;
    changes: Record<string, any>;
  };
}

export interface PlanDeletedEvent extends BaseEvent {
  eventType: 'plan.deleted';
  data: {
    planId: string;
  };
}

/**
 * Feature Events
 */
export interface FeatureCreatedEvent extends BaseEvent {
  eventType: 'feature.created';
  data: {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
  };
}

export interface FeatureUpdatedEvent extends BaseEvent {
  eventType: 'feature.updated';
  data: {
    featureId: string;
    changes: Record<string, any>;
  };
}

export interface FeatureDeletedEvent extends BaseEvent {
  eventType: 'feature.deleted';
  data: {
    featureId: string;
  };
}

/**
 * Inventory Events
 */
export interface InventoryCreatedEvent extends BaseEvent {
  eventType: 'inventory.created';
  data: {
    id: string;
    productId: string;
    quantity: number;
    createdAt: Date;
  };
}

export interface InventoryAdjustedEvent extends BaseEvent {
  eventType: 'inventory.adjusted';
  data: {
    productId: string;
    previousQuantity: number;
    currentQuantity: number;
    adjustment: number;
    reason: 'restock' | 'damage' | 'loss' | 'adjustment' | 'correction';
  };
}

export interface InventoryReservedEvent extends BaseEvent {
  eventType: 'inventory.reserved';
  data: {
    reservationId: string;
    productId: string;
    quantity: number;
    orderId: string;
    customerId: string;
  };
}

export interface InventoryReleasedEvent extends BaseEvent {
  eventType: 'inventory.released';
  data: {
    productId: string;
    quantity: number;
    orderId: string;
    reason: 'order_cancelled' | 'order_completed' | 'manual_release';
  };
}

export interface InventoryLowStockEvent extends BaseEvent {
  eventType: 'inventory.low_stock';
  data: {
    productId: string;
    currentQuantity: number;
    reorderLevel: number;
  };
}

export interface InventoryReserveFailedEvent extends BaseEvent {
  eventType: 'inventory.reserve_failed';
  data: {
    orderId: string;
    orderNumber?: string;
    customerId?: string;
    reason: 'OUT_OF_STOCK' | 'PRODUCT_NOT_FOUND' | 'RESERVATION_ERROR';
    unavailableItems: Array<{
      productId: string;
      requestedQuantity: number;
      availableQuantity: number;
    }>;
  };
}

export interface InventoryReleaseRequestEvent extends BaseEvent {
  eventType: 'inventory.release_request';
  data: {
    orderId: string;
    reason: string;
  };
}

export interface OrderConfirmedEvent extends BaseEvent {
  eventType: 'order.confirmed';
  data: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    totalAmount: number;
  };
}

export interface PaymentInitiateEvent extends BaseEvent {
  eventType: 'payment.initiate';
  data: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    amount: number;
  };
}

/**
 * Order Events
 */
export interface OrderCreatedEvent extends BaseEvent {
  eventType: 'order.created';
  data: {
    orderId: string;
    orderNumber: string; 
    customerId: string;
    items: Array<{
      productId: string;
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
    orderId: string;
    orderNumber: string;
    customerId: string;
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
    orderId: string;
    orderNumber: string;
    customerId: string;
    totalAmount: number;
    completedAt: Date;
  };
}

export interface OrderCancelledEvent extends BaseEvent {
  eventType: 'order.cancelled';
  data: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    reason: string;
  };
}

/**
 * Payment Events
 */

export interface PaymentInitiatedEvent extends BaseEvent {
  eventType: 'payment.initiated';
  data: {
    paymentId: string;
    invoiceId: string;
    invoiceNumber: string;
    orderId: string;
    customerId: string;
    amount: number;
    currency: string;
    method: string; // 'vnpay' | 'momo' | 'bank_transfer' | 'cash'
    paymentUrl?: string; // For redirect to payment gateway
  };
}

export interface PaymentSuccessEvent extends BaseEvent {
  eventType: 'payment.success';
  data: {
    paymentId: string;
    invoiceId: string;
    orderId: string;
    customerId: string;
    amount: number;
    method: string;
    transactionId: string; // Transaction ID from payment gateway (VNPay, etc.)
    paidAt: Date;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  eventType: 'payment.failed';
  data: {
    paymentId: string;
    invoiceId: string;
    orderId: string;
    customerId: string;
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
    paymentId: string;
    invoiceId: string;
    orderId: string;
    customerId: string;
    amount: number;
    retryCount: number;
    previousFailureReason: string;
  };
}

export interface PaymentRefundedEvent extends BaseEvent {
  eventType: 'payment.refunded';
  data: {
    paymentId: string;
    invoiceId: string;
    orderId: string;
    customerId: string;
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
    invoiceId: string;
    invoiceNumber: string;
    orderId: string;
    orderNumber: string;
    customerId: string;
    totalAmount: number;
    dueDate: Date;
    status: string;
    createdAt: Date;
  };
}

export interface InvoiceUpdatedEvent extends BaseEvent {
  eventType: 'invoice.updated';
  data: {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    previousStatus: string;
    newStatus: string;
  };
}

export interface InvoiceOverdueEvent extends BaseEvent {
  eventType: 'invoice.overdue';
  data: {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
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
    subscriptionId: string;
    customerId: string;
    planId: string;
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
    subscriptionId: string;
    customerId: string;
    changes: Record<string, any>;
    previousStatus?: string;
    newStatus?: string;
  };
}

export interface SubscriptionRenewedEvent extends BaseEvent {
  eventType: 'subscription.renewed';
  data: {
    subscriptionId: string;
    customerId: string;
    planId: string;
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
    subscriptionId: string;
    customerId: string;
    planId: string;
    cancelledAt: Date;
    cancelAtPeriodEnd: boolean;
    reason?: string;
  };
}

export interface SubscriptionExpiredEvent extends BaseEvent {
  eventType: 'subscription.expired';
  data: {
    subscriptionId: string;
    customerId: string;
    planId: string;
    expiredAt: Date;
    reason: 'trial_ended' | 'payment_failed' | 'cancelled' | 'admin_action';
  };
}

export interface SubscriptionTrialStartedEvent extends BaseEvent {
  eventType: 'subscription.trial.started';
  data: {
    subscriptionId: string;
    customerId: string;
    planId: string;
    trialStart: Date;
    trialEnd: Date;
    trialDays: number;
  };
}

export interface SubscriptionTrialEndingEvent extends BaseEvent {
  eventType: 'subscription.trial.ending';
  data: {
    subscriptionId: string;
    customerId: string;
    planId: string;
    trialEnd: Date;
    daysRemaining: number;
  };
}

export interface SubscriptionTrialEndedEvent extends BaseEvent {
  eventType: 'subscription.trial.ended';
  data: {
    subscriptionId: string;
    customerId: string;
    planId: string;
    trialEnd: Date;
    convertedToActive: boolean;
  };
}

export interface SubscriptionPlanChangedEvent extends BaseEvent {
  eventType: 'subscription.plan.changed';
  data: {
    subscriptionId: string;
    customerId: string;
    previousPlanId: string;
    newPlanId: string;
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
    promotionId: string;
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
    promotionId: string;
    code: string;
    customerId: string;
    subscriptionId?: string;
    invoiceId?: string;
    discountAmount: number;
    appliedAt: Date;
  };
}

export interface PromotionExpiredEvent extends BaseEvent {
  eventType: 'promotion.expired';
  data: {
    promotionId: string;
    code: string;
    expiredAt: Date;
  };
}

/**
 * Dynamic Changeset Events (LLM/AI)
 */
export interface DynamicChangesetGeneratedEvent extends BaseEvent {
  eventType: 'dynamic.changeset.generated';
  data: {
    changesetId: string;
    intent: string;
    fromModel?: string;
    toModel?: string;
    discoveredServices: string[];
    enabledServices: string[];
    riskLevel: 'low' | 'medium' | 'high';
    jsonPath: string;
    yamlPath: string;
    tenantId: string;
    generatedAt: Date;
  };
}

export interface DynamicChangesetValidatedEvent extends BaseEvent {
  eventType: 'dynamic.changeset.validated';
  data: {
    changesetId: string;
    validationPassed: boolean;
    validationErrors: string[];
    warnings: string[];
    databasesOutput?: string;
    servicesOutput?: string;
    tenantId: string;
    validatedAt: Date;
  };
}

export interface DynamicChangesetDeployedEvent extends BaseEvent {
  eventType: 'dynamic.changeset.deployed';
  data: {
    changesetId: string;
    toModel: string;
    deployedServices: string[];
    deployedDatabases: string[];
    tenantId: string;
    deployedAt: Date;
  };
}

export interface DynamicChangesetFailedEvent extends BaseEvent {
  eventType: 'dynamic.changeset.failed';
  data: {
    changesetId?: string;
    intent: string;
    error: string;
    phase: 'generation' | 'validation' | 'deployment';
    fallbackAvailable: boolean;
    fallbackModels: string[];
    tenantId: string;
    failedAt: Date;
  };
}

export interface DynamicChangesetFallbackEvent extends BaseEvent {
  eventType: 'dynamic.changeset.fallback';
  data: {
    originalIntent: string;
    fallbackModel: string;
    reason: string;
    originalError?: string;
    tenantId: string;
    fallbackAt: Date;
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