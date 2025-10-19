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
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_CANCELLED: 'order.cancelled',
    ORDER_COMPLETED: 'order.completed',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    PRODUCT_STOCK_CHANGED: 'product.stock.changed',
    PAYMENT_INITIATED: 'payment.initiated',
    PAYMENT_SUCCESS: 'payment.success',
    PAYMENT_FAILED: 'payment.failed',
    INVENTORY_RESERVED: 'inventory.reserved',
    INVENTORY_RELEASED: 'inventory.released',
};
//# sourceMappingURL=event.decorators.js.map