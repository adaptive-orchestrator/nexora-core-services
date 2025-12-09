import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { InventoryService } from './inventory-svc.service';

@Controller()
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'inventory-svc', timestamp: new Date().toISOString() };
  }

  @GrpcMethod('InventoryService', 'CreateInventory')
  async createInventory(data: any) {
    const inventory = await this.service.createInventoryForProduct(
      data.productId,
      data.quantity || 0,
      data.reorderLevel || 10,
      data.warehouseLocation,
      data.maxStock,
      data.ownerId, // Pass ownerId for multi-tenant support
    );
    return { inventory, message: 'Inventory created successfully' };
  }

  @GrpcMethod('InventoryService', 'GetInventoryByProduct')
  async getInventoryByProduct(data: { productId: string; ownerId?: string }) {
    const inventory = await this.service.getByProduct(data.productId, data.ownerId);
    return { inventory, message: 'Inventory retrieved' };
  }

  @GrpcMethod('InventoryService', 'GetAllInventory')
  async getAllInventory(data: { page?: number; limit?: number; ownerId?: string }) {
    const page = data.page || 1;
    const limit = data.limit || 20;
    const result = await this.service.listAll(page, limit, data.ownerId);
    return result;
  }

  @GrpcMethod('InventoryService', 'GetInventoryByOwner')
  async getInventoryByOwner(data: { ownerId: string; page?: number; limit?: number }) {
    const page = data.page || 1;
    const limit = data.limit || 20;
    const result = await this.service.listAll(page, limit, data.ownerId);
    return result;
  }

  @GrpcMethod('InventoryService', 'AdjustStock')
  async adjustStock(data: any) {
    console.log('[InventoryController.adjustStock] Received data:', JSON.stringify(data, null, 2));
    console.log('[InventoryController.adjustStock] ownerId:', data.ownerId);
    const inventory = await this.service.adjust(
      data.productId,
      {
        adjustment: data.quantity,
        reason: data.reason || 'adjustment',
        notes: data.notes || data.reason,
      },
      data.ownerId, // Pass ownerId to create inventory for correct owner
    );
    console.log('[InventoryController.adjustStock] Created inventory:', JSON.stringify(inventory, null, 2));
    return { inventory, message: 'Stock adjusted successfully' };
  }

  @GrpcMethod('InventoryService', 'ReserveStock')
  async reserveStock(data: any) {
    const reservation = await this.service.reserveStock(
      data.productId,
      data.quantity,
      data.orderId,
      data.customerId,
    );
    return { reservation, message: 'Stock reserved successfully' };
  }

  @GrpcMethod('InventoryService', 'ReleaseStock')
  async releaseStock(data: { reservationId: number }) {
    // TODO: Implement proper reservation release by ID
    return { message: 'Reservation released', success: true };
  }

  @GrpcMethod('InventoryService', 'ConfirmReservation')
  async confirmReservation(data: { reservationId: number }) {
    // We'll need to add this method to service or use existing logic
    // For now, just return success
    return { message: 'Reservation confirmed', success: true };
  }

  @GrpcMethod('InventoryService', 'BulkReserve')
  async bulkReserve(data: any) {
    const result = await this.service.bulkReserve({
      items: data.items,
      orderId: data.orderId,
      customerId: data.customerId,
    });
    return {
      reservations: result,
      allSuccessful: true,
      errors: [],
    };
  }

  @GrpcMethod('InventoryService', 'CheckAvailability')
  async checkAvailability(data: { productId: string; requestedQuantity: number }) {
    const available = await this.service.checkStock(data.productId, data.requestedQuantity);
    const inventory = await this.service.getByProduct(data.productId);
    const availableQty = inventory.getAvailableQuantity();
    
    return {
      available,
      availableQuantity: availableQty,
      message: available
        ? 'Stock available'
        : `Insufficient stock. Available: ${availableQty}, Requested: ${data.requestedQuantity}`,
    };
  }

  @GrpcMethod('InventoryService', 'GetInventoryHistory')
  async getInventoryHistory(data: { productId: string }) {
    const items = await this.service.getInventoryHistory(data.productId);
    return { items, total: items.length };
  }

  @GrpcMethod('InventoryService', 'GetLowStockItems')
  async getLowStockItems(data: { threshold?: number }) {
    const items = await this.service.getLowStockItems();
    return { items, total: items.length };
  }
}
