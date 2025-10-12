"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
var common_1 = require("@nestjs/common");
var typeorm_1 = require("typeorm");
var event_1 = require("@bmms/event");
var InventoryService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var InventoryService = _classThis = /** @class */ (function () {
        function InventoryService_1(inventoryRepo, reservationRepo, historyRepo, kafka) {
            this.inventoryRepo = inventoryRepo;
            this.reservationRepo = reservationRepo;
            this.historyRepo = historyRepo;
            this.kafka = kafka;
        }
        // ============= CRUD =============
        InventoryService_1.prototype.create = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, inventory;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.inventoryRepo.findOne({
                                where: { productId: dto.productId },
                            })];
                        case 1:
                            existing = _a.sent();
                            if (existing) {
                                throw new common_1.ConflictException("Inventory for product ".concat(dto.productId, " already exists"));
                            }
                            return [4 /*yield*/, this.inventoryRepo.save(this.inventoryRepo.create(dto))];
                        case 2:
                            inventory = _a.sent();
                            this.kafka.emit(event_1.EventTopics.INVENTORY_CREATED, {
                                eventId: crypto.randomUUID(),
                                eventType: event_1.EventTopics.INVENTORY_CREATED,
                                timestamp: new Date(),
                                source: 'inventory-svc',
                                data: {
                                    id: inventory.id,
                                    productId: inventory.productId,
                                    quantity: inventory.quantity,
                                    createdAt: inventory.createdAt,
                                },
                            });
                            return [2 /*return*/, inventory];
                    }
                });
            });
        };
        InventoryService_1.prototype.getByProduct = function (productId) {
            return __awaiter(this, void 0, void 0, function () {
                var inventory;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.inventoryRepo.findOne({
                                where: { productId: productId },
                                relations: ['reservations'],
                            })];
                        case 1:
                            inventory = _a.sent();
                            if (!inventory) {
                                throw new common_1.NotFoundException("Inventory for product ".concat(productId, " not found"));
                            }
                            return [2 /*return*/, inventory];
                    }
                });
            });
        };
        InventoryService_1.prototype.listAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.inventoryRepo.find({ relations: ['reservations'] })];
                });
            });
        };
        InventoryService_1.prototype.getLowStockItems = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.inventoryRepo
                            .createQueryBuilder('inventory')
                            .where('inventory.quantity <= inventory.reorderLevel')
                            .getMany()];
                });
            });
        };
        // ============= ADJUST STOCK =============
        InventoryService_1.prototype.adjust = function (productId, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var inventory, previousQuantity, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getByProduct(productId)];
                        case 1:
                            inventory = _a.sent();
                            previousQuantity = inventory.quantity;
                            inventory.quantity += dto.adjustment;
                            if (inventory.quantity < 0) {
                                throw new common_1.BadRequestException("Adjustment would result in negative stock. Current: ".concat(previousQuantity, ", Adjustment: ").concat(dto.adjustment));
                            }
                            return [4 /*yield*/, this.inventoryRepo.save(inventory)];
                        case 2:
                            updated = _a.sent();
                            // Save history
                            return [4 /*yield*/, this.historyRepo.save(this.historyRepo.create({
                                    productId: productId,
                                    previousQuantity: previousQuantity,
                                    currentQuantity: updated.quantity,
                                    change: dto.adjustment,
                                    reason: dto.reason,
                                    notes: dto.notes,
                                }))];
                        case 3:
                            // Save history
                            _a.sent();
                            this.kafka.emit(event_1.EventTopics.INVENTORY_ADJUSTED, {
                                eventId: crypto.randomUUID(),
                                eventType: event_1.EventTopics.INVENTORY_ADJUSTED,
                                timestamp: new Date(),
                                source: 'inventory-svc',
                                data: {
                                    productId: productId,
                                    previousQuantity: previousQuantity,
                                    currentQuantity: updated.quantity,
                                    adjustment: dto.adjustment,
                                    reason: dto.reason,
                                },
                            });
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        // ============= RESERVE STOCK =============
        InventoryService_1.prototype.reserve = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var inventory, reservation;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getByProduct(dto.productId)];
                        case 1:
                            inventory = _a.sent();
                            if (inventory.getAvailableQuantity() < dto.quantity) {
                                throw new common_1.BadRequestException("Insufficient stock. Available: ".concat(inventory.getAvailableQuantity(), ", Requested: ").concat(dto.quantity));
                            }
                            return [4 /*yield*/, this.reservationRepo.save(this.reservationRepo.create(__assign(__assign({}, dto), { status: 'active', expiresAt: dto.reservationExpiry || new Date(Date.now() + 24 * 60 * 60 * 1000) })))];
                        case 2:
                            reservation = _a.sent();
                            inventory.reserved += dto.quantity;
                            return [4 /*yield*/, this.inventoryRepo.save(inventory)];
                        case 3:
                            _a.sent();
                            // Save history
                            return [4 /*yield*/, this.historyRepo.save(this.historyRepo.create({
                                    productId: dto.productId,
                                    previousQuantity: inventory.quantity - dto.quantity,
                                    currentQuantity: inventory.quantity,
                                    change: -dto.quantity,
                                    reason: 'reservation',
                                    orderId: dto.orderId,
                                    notes: "Reserved for order ".concat(dto.orderId),
                                }))];
                        case 4:
                            // Save history
                            _a.sent();
                            this.kafka.emit(event_1.EventTopics.INVENTORY_RESERVED, {
                                eventId: crypto.randomUUID(),
                                eventType: event_1.EventTopics.INVENTORY_RESERVED,
                                timestamp: new Date(),
                                source: 'inventory-svc',
                                data: {
                                    reservationId: reservation.id,
                                    productId: dto.productId,
                                    quantity: dto.quantity,
                                    orderId: dto.orderId,
                                    customerId: dto.customerId,
                                },
                            });
                            return [2 /*return*/, reservation];
                    }
                });
            });
        };
        InventoryService_1.prototype.bulkReserve = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var reservations, _i, _a, item, reservation;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            reservations = [];
                            _i = 0, _a = dto.items;
                            _b.label = 1;
                        case 1:
                            if (!(_i < _a.length)) return [3 /*break*/, 4];
                            item = _a[_i];
                            return [4 /*yield*/, this.reserve({
                                    productId: item.productId,
                                    quantity: item.quantity,
                                    orderId: dto.orderId,
                                    customerId: dto.customerId,
                                })];
                        case 2:
                            reservation = _b.sent();
                            reservations.push(reservation);
                            _b.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/, reservations];
                    }
                });
            });
        };
        // ============= RELEASE STOCK =============
        InventoryService_1.prototype.release = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var inventory, reservation, previousQuantity, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getByProduct(dto.productId)];
                        case 1:
                            inventory = _a.sent();
                            return [4 /*yield*/, this.reservationRepo.findOne({
                                    where: {
                                        productId: dto.productId,
                                        orderId: dto.orderId,
                                        status: 'active',
                                    },
                                })];
                        case 2:
                            reservation = _a.sent();
                            if (!reservation) {
                                throw new common_1.NotFoundException("No active reservation found for product ".concat(dto.productId, " and order ").concat(dto.orderId));
                            }
                            previousQuantity = inventory.quantity;
                            if (dto.reason === 'order_completed') {
                                // Stock deducted, release reservation
                                inventory.reserved -= reservation.quantity;
                            }
                            else if (dto.reason === 'order_cancelled' ||
                                dto.reason === 'manual_release') {
                                // Return stock
                                inventory.quantity += reservation.quantity;
                                inventory.reserved -= reservation.quantity;
                            }
                            reservation.status = 'cancelled';
                            return [4 /*yield*/, this.reservationRepo.save(reservation)];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.inventoryRepo.save(inventory)];
                        case 4:
                            updated = _a.sent();
                            // Save history
                            return [4 /*yield*/, this.historyRepo.save(this.historyRepo.create({
                                    productId: dto.productId,
                                    previousQuantity: previousQuantity,
                                    currentQuantity: updated.quantity,
                                    change: inventory.quantity - previousQuantity,
                                    reason: 'release',
                                    orderId: dto.orderId,
                                    notes: "Released - ".concat(dto.reason),
                                }))];
                        case 5:
                            // Save history
                            _a.sent();
                            this.kafka.emit(event_1.EventTopics.INVENTORY_RELEASED, {
                                eventId: crypto.randomUUID(),
                                eventType: event_1.EventTopics.INVENTORY_RELEASED,
                                timestamp: new Date(),
                                source: 'inventory-svc',
                                data: {
                                    productId: dto.productId,
                                    quantity: reservation.quantity,
                                    orderId: dto.orderId,
                                    reason: dto.reason,
                                },
                            });
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        // ============= UTILITIES =============
        InventoryService_1.prototype.checkStock = function (productId, requiredQuantity) {
            return __awaiter(this, void 0, void 0, function () {
                var inventory;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getByProduct(productId)];
                        case 1:
                            inventory = _a.sent();
                            return [2 /*return*/, inventory.getAvailableQuantity() >= requiredQuantity];
                    }
                });
            });
        };
        InventoryService_1.prototype.getInventoryHistory = function (productId_1) {
            return __awaiter(this, arguments, void 0, function (productId, limit) {
                if (limit === void 0) { limit = 50; }
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.historyRepo.find({
                            where: { productId: productId },
                            order: { createdAt: 'DESC' },
                            take: limit,
                        })];
                });
            });
        };
        InventoryService_1.prototype.cleanExpiredReservations = function () {
            return __awaiter(this, void 0, void 0, function () {
                var expired, _i, expired_1, reservation;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.reservationRepo.find({
                                where: {
                                    status: 'active',
                                    expiresAt: (0, typeorm_1.LessThanOrEqual)(new Date()),
                                },
                            })];
                        case 1:
                            expired = _a.sent();
                            _i = 0, expired_1 = expired;
                            _a.label = 2;
                        case 2:
                            if (!(_i < expired_1.length)) return [3 /*break*/, 5];
                            reservation = expired_1[_i];
                            return [4 /*yield*/, this.release({
                                    productId: reservation.productId,
                                    quantity: reservation.quantity,
                                    orderId: reservation.orderId,
                                    reason: 'order_cancelled',
                                })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5:
                            console.log("\uD83E\uDDF9 Cleaned up ".concat(expired.length, " expired reservations"));
                            return [2 /*return*/];
                    }
                });
            });
        };
        return InventoryService_1;
    }());
    __setFunctionName(_classThis, "InventoryService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InventoryService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InventoryService = _classThis;
}();
exports.InventoryService = InventoryService;
