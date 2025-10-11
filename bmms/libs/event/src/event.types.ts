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
/**
 * Customer Events
 */
export interface CustomerCreatedEvent extends BaseEvent {
  eventType: 'customer.created';
  data: {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
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
 * Order Events
 */
export interface OrderCreatedEvent extends BaseEvent {
  eventType: 'order.created';
  data: {
    orderId: string;
    customerId: number;
    items: Array<{
      productId: number;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
  };
}

export interface OrderCompletedEvent extends BaseEvent {
  eventType: 'order.completed';
  data: {
    orderId: string;
    customerId: number;
    completedAt: Date;
  };
}

/**
 * Payment Events
 */
export interface PaymentSuccessEvent extends BaseEvent {
  eventType: 'payment.success';
  data: {
    paymentId: string;
    orderId: string;
    amount: number;
    method: string;
    transactionId: string;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  eventType: 'payment.failed';
  data: {
    paymentId: string;
    orderId: string;
    amount: number;
    reason: string;
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