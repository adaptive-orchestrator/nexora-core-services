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
exports.Inventory = void 0;
var typeorm_1 = require("typeorm");
var inventory_reservation_entity_1 = require("./inventory-reservation.entity");
var Inventory = function () {
    var _classDecorators = [(0, typeorm_1.Entity)('inventory')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _productId_decorators;
    var _productId_initializers = [];
    var _productId_extraInitializers = [];
    var _quantity_decorators;
    var _quantity_initializers = [];
    var _quantity_extraInitializers = [];
    var _reserved_decorators;
    var _reserved_initializers = [];
    var _reserved_extraInitializers = [];
    var _warehouseLocation_decorators;
    var _warehouseLocation_initializers = [];
    var _warehouseLocation_extraInitializers = [];
    var _reorderLevel_decorators;
    var _reorderLevel_initializers = [];
    var _reorderLevel_extraInitializers = [];
    var _maxStock_decorators;
    var _maxStock_initializers = [];
    var _maxStock_extraInitializers = [];
    var _isActive_decorators;
    var _isActive_initializers = [];
    var _isActive_extraInitializers = [];
    var _reservations_decorators;
    var _reservations_initializers = [];
    var _reservations_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    var Inventory = _classThis = /** @class */ (function () {
        function Inventory_1() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.productId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _productId_initializers, void 0));
            this.quantity = (__runInitializers(this, _productId_extraInitializers), __runInitializers(this, _quantity_initializers, void 0)); // Số lượng available
            this.reserved = (__runInitializers(this, _quantity_extraInitializers), __runInitializers(this, _reserved_initializers, void 0)); // Số lượng đã đặt trước
            this.warehouseLocation = (__runInitializers(this, _reserved_extraInitializers), __runInitializers(this, _warehouseLocation_initializers, void 0));
            this.reorderLevel = (__runInitializers(this, _warehouseLocation_extraInitializers), __runInitializers(this, _reorderLevel_initializers, void 0));
            this.maxStock = (__runInitializers(this, _reorderLevel_extraInitializers), __runInitializers(this, _maxStock_initializers, void 0));
            this.isActive = (__runInitializers(this, _maxStock_extraInitializers), __runInitializers(this, _isActive_initializers, void 0));
            this.reservations = (__runInitializers(this, _isActive_extraInitializers), __runInitializers(this, _reservations_initializers, void 0));
            this.createdAt = (__runInitializers(this, _reservations_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
            this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
            __runInitializers(this, _updatedAt_extraInitializers);
        }
        // Helper methods
        Inventory_1.prototype.getAvailableQuantity = function () {
            return this.quantity - this.reserved;
        };
        Inventory_1.prototype.getTotalQuantity = function () {
            return this.quantity + this.reserved;
        };
        return Inventory_1;
    }());
    __setFunctionName(_classThis, "Inventory");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _productId_decorators = [(0, typeorm_1.Column)({ unique: true })];
        _quantity_decorators = [(0, typeorm_1.Column)()];
        _reserved_decorators = [(0, typeorm_1.Column)({ default: 0 })];
        _warehouseLocation_decorators = [(0, typeorm_1.Column)({ nullable: true })];
        _reorderLevel_decorators = [(0, typeorm_1.Column)({ nullable: true, default: 10 })];
        _maxStock_decorators = [(0, typeorm_1.Column)({ nullable: true, default: 1000 })];
        _isActive_decorators = [(0, typeorm_1.Column)({ default: true })];
        _reservations_decorators = [(0, typeorm_1.OneToMany)(function () { return inventory_reservation_entity_1.InventoryReservation; }, function (reservation) { return reservation.inventory; }, { cascade: true })];
        _createdAt_decorators = [(0, typeorm_1.CreateDateColumn)()];
        _updatedAt_decorators = [(0, typeorm_1.UpdateDateColumn)()];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _productId_decorators, { kind: "field", name: "productId", static: false, private: false, access: { has: function (obj) { return "productId" in obj; }, get: function (obj) { return obj.productId; }, set: function (obj, value) { obj.productId = value; } }, metadata: _metadata }, _productId_initializers, _productId_extraInitializers);
        __esDecorate(null, null, _quantity_decorators, { kind: "field", name: "quantity", static: false, private: false, access: { has: function (obj) { return "quantity" in obj; }, get: function (obj) { return obj.quantity; }, set: function (obj, value) { obj.quantity = value; } }, metadata: _metadata }, _quantity_initializers, _quantity_extraInitializers);
        __esDecorate(null, null, _reserved_decorators, { kind: "field", name: "reserved", static: false, private: false, access: { has: function (obj) { return "reserved" in obj; }, get: function (obj) { return obj.reserved; }, set: function (obj, value) { obj.reserved = value; } }, metadata: _metadata }, _reserved_initializers, _reserved_extraInitializers);
        __esDecorate(null, null, _warehouseLocation_decorators, { kind: "field", name: "warehouseLocation", static: false, private: false, access: { has: function (obj) { return "warehouseLocation" in obj; }, get: function (obj) { return obj.warehouseLocation; }, set: function (obj, value) { obj.warehouseLocation = value; } }, metadata: _metadata }, _warehouseLocation_initializers, _warehouseLocation_extraInitializers);
        __esDecorate(null, null, _reorderLevel_decorators, { kind: "field", name: "reorderLevel", static: false, private: false, access: { has: function (obj) { return "reorderLevel" in obj; }, get: function (obj) { return obj.reorderLevel; }, set: function (obj, value) { obj.reorderLevel = value; } }, metadata: _metadata }, _reorderLevel_initializers, _reorderLevel_extraInitializers);
        __esDecorate(null, null, _maxStock_decorators, { kind: "field", name: "maxStock", static: false, private: false, access: { has: function (obj) { return "maxStock" in obj; }, get: function (obj) { return obj.maxStock; }, set: function (obj, value) { obj.maxStock = value; } }, metadata: _metadata }, _maxStock_initializers, _maxStock_extraInitializers);
        __esDecorate(null, null, _isActive_decorators, { kind: "field", name: "isActive", static: false, private: false, access: { has: function (obj) { return "isActive" in obj; }, get: function (obj) { return obj.isActive; }, set: function (obj, value) { obj.isActive = value; } }, metadata: _metadata }, _isActive_initializers, _isActive_extraInitializers);
        __esDecorate(null, null, _reservations_decorators, { kind: "field", name: "reservations", static: false, private: false, access: { has: function (obj) { return "reservations" in obj; }, get: function (obj) { return obj.reservations; }, set: function (obj, value) { obj.reservations = value; } }, metadata: _metadata }, _reservations_initializers, _reservations_extraInitializers);
        __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
        __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Inventory = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Inventory = _classThis;
}();
exports.Inventory = Inventory;
