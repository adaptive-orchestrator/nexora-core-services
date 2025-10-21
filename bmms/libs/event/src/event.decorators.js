"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTopics = exports.OnEvent = void 0;
const microservices_1 = require("@nestjs/microservices");
const OnEvent = (topic) => (0, microservices_1.EventPattern)(topic);
exports.OnEvent = OnEvent;
exports.EventTopics = {
    CUSTOMER_CREATED: 'customer.created',
    CUSTOMER_UPDATED: 'customer.updated',
    CUSTOMER_DELETED: 'customer.deleted',
    CUSTOMER_SEGMENT_CHANGED: 'segment.changed',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_DELETED: 'product.deleted',
    PRODUCT_STOCK_CHANGED: 'product.stock.changed',
    PLAN_CREATED: 'plan.created',
    PLAN_UPDATED: 'plan.updated',
    PLAN_DELETED: 'plan.deleted',
    FEATURE_CREATED: 'feature.created',
    FEATURE_UPDATED: 'feature.updated',
    FEATURE_DELETED: 'feature.deleted',
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_CANCELLED: 'order.cancelled',
    ORDER_COMPLETED: 'order.completed',
    PAYMENT_INITIATED: 'payment.initiated',
    PAYMENT_SUCCESS: 'payment.success',
    PAYMENT_FAILED: 'payment.failed',
    INVOICE_CREATED: 'invoice.created',
    INVOICE_UPDATED: 'invoice.updated',
    INVOICE_OVERDUE: 'invoice.overdue',
    INVENTORY_CREATED: 'inventory.created',
    INVENTORY_ADJUSTED: 'inventory.adjusted',
    INVENTORY_RESERVED: 'inventory.reserved',
    INVENTORY_RELEASED: 'inventory.released',
    INVENTORY_LOW_STOCK: 'inventory.low_stock',
};
//# sourceMappingURL=event.decorators.js.map