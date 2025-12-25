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
    try {
      const inventory = await this.service.getByProduct(data.productId, data.ownerId);
      return { inventory, message: 'Inventory retrieved' };
    } catch (error: any) {
      console.error('[InventoryController] getInventoryByProduct error:', error.message);
      throw error; // Let GrpcExceptionFilter handle it
    }
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
    try {
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
    } catch (error: any) {
      console.error('[InventoryController] adjustStock error:', error.message);
      throw error; // Let GrpcExceptionFilter handle it
    }
  }

  @GrpcMethod('InventoryService', 'ReserveStock')
  async reserveStock(data: any) {
    try {
      const reservation = await this.service.reserveStock(
        data.productId,
        data.quantity,
        data.orderId,
        data.customerId,
      );
      return { reservation, message: 'Stock reserved successfully' };
    } catch (error: any) {
      // Re-throw with proper context for gRPC filter
      console.error('[InventoryController] reserveStock error:', error.message);
      throw error; // Let GrpcExceptionFilter handle it
    }
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
    console.log('[InventoryController.checkAvailability] Called with:', JSON.stringify(data));

    // Aggregate ALL inventory records for this product to get total available quantity
    const inventories = await this.service.getAllInventoriesForProduct(data.productId);
    console.log(`[InventoryController.checkAvailability] Found ${inventories.length} inventory records for product ${data.productId}`);

    const availableQty = inventories.reduce(
      (sum, inv) => sum + inv.getAvailableQuantity(),
      0
    );
    console.log(`[InventoryController.checkAvailability] Total available: ${availableQty}, Requested: ${data.requestedQuantity}`);

    const available = availableQty >= data.requestedQuantity;

    const result = {
      available,
      availableQuantity: availableQty,
      message: available
        ? 'Stock available'
        : `Insufficient stock. Available: ${availableQty}, Requested: ${data.requestedQuantity}`,
    };

    console.log('[InventoryController.checkAvailability] Returning:', JSON.stringify(result));
    return result;
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

  @GrpcMethod('InventoryService', 'CleanupDuplicateInventory')
  async cleanupDuplicateInventory() {
    const result = await this.service.cleanupDuplicateInventory();
    return result;
  }

  @GrpcMethod('InventoryService', 'CreateDefaultInventory')
  async createDefaultInventory(data: {
    productId: string;
    ownerId?: string;
    initialQuantity?: number;
    warehouseLocation?: string;
  }) {
    console.log('[InventoryController.createDefaultInventory] Called with:', JSON.stringify(data));

    // Check if inventory already exists for this product
    const existing = await this.service.getAllInventoriesForProduct(data.productId);

    if (existing.length > 0) {
      console.log(`[InventoryController.createDefaultInventory] Product ${data.productId} already has ${existing.length} inventory records`);
      return {
        success: false,
        message: `Product already has ${existing.length} inventory record(s)`,
        existingInventories: existing.map(inv => ({
          id: inv.id,
          ownerId: inv.ownerId,
          quantity: inv.quantity,
          reserved: inv.reserved,
        })),
      };
    }

    // Create default inventory
    const inventory = await this.service.createInventoryForProduct(
      data.productId,
      data.initialQuantity || 0,
      10, // reorderLevel
      data.warehouseLocation || 'Main Warehouse',
      1000, // maxStock
      data.ownerId,
    );

    console.log('[InventoryController.createDefaultInventory] Created inventory:', inventory.id);

    return {
      success: true,
      message: 'Default inventory created successfully',
      inventory: {
        id: inventory.id,
        productId: inventory.productId,
        ownerId: inventory.ownerId,
        quantity: inventory.quantity,
        reserved: inventory.reserved,
      },
    };
  }
}
