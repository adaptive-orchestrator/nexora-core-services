"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryHistory = void 0;
var typeorm_1 = require("typeorm");
var InventoryHistory = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('inventory_history')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _productId_decorators;
    var _productId_initializers = [];
    var _productId_extraInitializers = [];
    var _previousQuantity_decorators;
    var _previousQuantity_initializers = [];
    var _previousQuantity_extraInitializers = [];
    var _currentQuantity_decorators;
    var _currentQuantity_initializers = [];
    var _currentQuantity_extraInitializers = [];
    var _change_decorators;
    var _change_initializers = [];
    var _change_extraInitializers = [];
    var _reason_decorators;
    var _reason_initializers = [];
    var _reason_extraInitializers = [];
    var _orderId_decorators;
    var _orderId_initializers = [];
    var _orderId_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var InventoryHistory = _classThis = /** @class */ (function () {
        function InventoryHistory_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.productId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _productId_initializers, void 0));
            this.previousQuantity = (__runInitializers(this, _productId_extraInitializers), __runInitializers(this, _previousQuantity_initializers, void 0));
            this.currentQuantity = (__runInitializers(this, _previousQuantity_extraInitializers), __runInitializers(this, _currentQuantity_initializers, void 0));
            this.change = (__runInitializers(this, _currentQuantity_extraInitializers), __runInitializers(this, _change_initializers, void 0));
            this.reason = (__runInitializers(this, _change_extraInitializers), __runInitializers(this, _reason_initializers, void 0));
            this.orderId = (__runInitializers(this, _reason_extraInitializers), __runInitializers(this, _orderId_initializers, void 0));
            this.notes = (__runInitializers(this, _orderId_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
            this.createdAt = (__runInitializers(this, _notes_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            __runInitializers(this, _createdAt_extraInitializers);
        }
        return InventoryHistory_1;
    }());
    __setFunctionName(_classThis, "InventoryHistory");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _productId_decorators = [(0, typeorm_1.Column)()];
        _previousQuantity_decorators = [(0, typeorm_1.Column)('int')];
        _currentQuantity_decorators = [(0, typeorm_1.Column)('int')];
        _change_decorators = [(0, typeorm_1.Column)('int')];
        _reason_decorators = [(0, typeorm_1.Column)({
                type: 'enum',
                enum: [
                    'restock',
                    'sale',
                    'damage',
                    'loss',
                    'adjustment',
                    'correction',
                    'reservation',
                    'release',
                ],
            })];
        _orderId_decorators = [(0, typeorm_1.Column)({ nullable: true })];
        _notes_decorators = [(0, typeorm_1.Column)({ nullable: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _productId_decorators, { kind: "field", name: "productId", static: false, private: false, access: { has: function (obj) { return "productId" in obj; }, get: function (obj) { return obj.productId; }, set: function (obj, value) { obj.productId = value; } }, metadata: _metadata }, _productId_initializers, _productId_extraInitializers);
        __esDecorate(null, null, _previousQuantity_decorators, { kind: "field", name: "previousQuantity", static: false, private: false, access: { has: function (obj) { return "previousQuantity" in obj; }, get: function (obj) { return obj.previousQuantity; }, set: function (obj, value) { obj.previousQuantity = value; } }, metadata: _metadata }, _previousQuantity_initializers, _previousQuantity_extraInitializers);
        __esDecorate(null, null, _currentQuantity_decorators, { kind: "field", name: "currentQuantity", static: false, private: false, access: { has: function (obj) { return "currentQuantity" in obj; }, get: function (obj) { return obj.currentQuantity; }, set: function (obj, value) { obj.currentQuantity = value; } }, metadata: _metadata }, _currentQuantity_initializers, _currentQuantity_extraInitializers);
        __esDecorate(null, null, _change_decorators, { kind: "field", name: "change", static: false, private: false, access: { has: function (obj) { return "change" in obj; }, get: function (obj) { return obj.change; }, set: function (obj, value) { obj.change = value; } }, metadata: _metadata }, _change_initializers, _change_extraInitializers);
        __esDecorate(null, null, _reason_decorators, { kind: "field", name: "reason", static: false, private: false, access: { has: function (obj) { return "reason" in obj; }, get: function (obj) { return obj.reason; }, set: function (obj, value) { obj.reason = value; } }, metadata: _metadata }, _reason_initializers, _reason_extraInitializers);
        __esDecorate(null, null, _orderId_decorators, { kind: "field", name: "orderId", static: false, private: false, access: { has: function (obj) { return "orderId" in obj; }, get: function (obj) { return obj.orderId; }, set: function (obj, value) { obj.orderId = value; } }, metadata: _metadata }, _orderId_initializers, _orderId_extraInitializers);
        __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InventoryHistory = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InventoryHistory = _classThis;
}();
exports.InventoryHistory = InventoryHistory;
