"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseEvent = createBaseEvent;
function createBaseEvent(eventType, source) {
    return {
        eventId: crypto.randomUUID(),
        eventType,
        timestamp: new Date(),
        source,
        version: '1.0',
    };
}
//# sourceMappingURL=event.types.js.map