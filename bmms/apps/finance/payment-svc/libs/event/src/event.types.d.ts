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
        customerId: string;
        email: string;
        name: string;
        phone?: string;
    };
}
export interface CustomerUpdatedEvent extends BaseEvent {
    eventType: 'customer.updated';
    data: {
        customerId: string;
        changes: Record<string, any>;
    };
}
export interface OrderCreatedEvent extends BaseEvent {
    eventType: 'order.created';
    data: {
        orderId: string;
        customerId: string;
        items: Array<{
            productId: string;
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
        customerId: string;
        completedAt: Date;
    };
}
export interface ProductStockChangedEvent extends BaseEvent {
    eventType: 'product.stock.changed';
    data: {
        productId: string;
        previousStock: number;
        currentStock: number;
        changeReason: 'sale' | 'restock' | 'adjustment';
    };
}
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
export declare function createBaseEvent(eventType: string, source: string): BaseEvent;
