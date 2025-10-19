export declare const OnEvent: (topic: string) => MethodDecorator;
export declare const EventTopics: {
    readonly CUSTOMER_CREATED: "customer.created";
    readonly CUSTOMER_UPDATED: "customer.updated";
    readonly CUSTOMER_DELETED: "customer.deleted";
    readonly ORDER_CREATED: "order.created";
    readonly ORDER_UPDATED: "order.updated";
    readonly ORDER_CANCELLED: "order.cancelled";
    readonly ORDER_COMPLETED: "order.completed";
    readonly PRODUCT_CREATED: "product.created";
    readonly PRODUCT_UPDATED: "product.updated";
    readonly PRODUCT_STOCK_CHANGED: "product.stock.changed";
    readonly PAYMENT_INITIATED: "payment.initiated";
    readonly PAYMENT_SUCCESS: "payment.success";
    readonly PAYMENT_FAILED: "payment.failed";
    readonly INVENTORY_RESERVED: "inventory.reserved";
    readonly INVENTORY_RELEASED: "inventory.released";
};
