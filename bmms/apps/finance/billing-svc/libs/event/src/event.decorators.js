"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTopics = exports.OnEvent = void 0;
var microservices_1 = require("@nestjs/microservices");
/**
 * Decorator để lắng nghe events từ Kafka
 * @param topic - Topic name to subscribe
 */
var OnEvent = function (topic) { return (0, microservices_1.EventPattern)(topic); };
exports.OnEvent = OnEvent;
/**
 * Common event topics - Định nghĩa tất cả topics ở đây
 */
exports.EventTopics = {
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
    // Billing events
    INVOICE_CREATED: 'invoice.created',
    INVOICE_UPDATED: 'invoice.updated',
    INVOICE_OVERDUE: 'invoice.overdue',
    // Inventory events
    INVENTORY_CREATED: 'inventory.created',
    INVENTORY_ADJUSTED: 'inventory.adjusted',
    INVENTORY_RESERVED: 'inventory.reserved',
    INVENTORY_RELEASED: 'inventory.released',
    INVENTORY_LOW_STOCK: 'inventory.low_stock',
};
