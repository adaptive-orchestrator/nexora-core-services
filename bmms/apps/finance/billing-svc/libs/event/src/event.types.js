"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseEvent = createBaseEvent;
/**
 * Helper function để tạo base event
 */
function createBaseEvent(eventType, source) {
    return {
        eventId: crypto.randomUUID(),
        eventType: eventType,
        timestamp: new Date(),
        source: source,
        version: '1.0',
    };
}
