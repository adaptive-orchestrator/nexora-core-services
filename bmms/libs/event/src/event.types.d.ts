export interface BaseEvent {
    eventId: string;
    eventType: string;
    timestamp: Date;
    source: string;
    version?: string;
}
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
        orderId: string;
        customerId: number;
    };
}
export interface InventoryReleasedEvent extends BaseEvent {
    eventType: 'inventory.released';
    data: {
        productId: number;
        quantity: number;
        orderId: string;
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
export interface PaymentSuccessEvent extends BaseEvent {
    eventType: 'payment.success';
    data: {
        paymentId: string;
        invoiceId: string;
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
        invoiceId: string;
        orderId: string;
        amount: number;
        reason: string;
    };
}
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
export declare function createBaseEvent(eventType: string, source: string): BaseEvent;
