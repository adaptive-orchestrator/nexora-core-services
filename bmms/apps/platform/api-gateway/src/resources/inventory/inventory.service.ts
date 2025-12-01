import { Injectable, OnModuleInit, Inject, HttpException, HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';

interface InventoryGrpcService {
  createInventory(data: any): any;
  getInventoryByProduct(data: { productId: number }): any;
  getAllInventory(data: any): any;
  adjustStock(data: any): any;
  reserveStock(data: any): any;
  releaseStock(data: { reservationId: number }): any;
  confirmReservation(data: { reservationId: number }): any;
  bulkReserve(data: any): any;
  checkAvailability(data: { productId: number; requestedQuantity: number }): any;
  getInventoryHistory(data: { productId: number }): any;
  getLowStockItems(data: { threshold?: number }): any;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private inventoryGrpcService: InventoryGrpcService;

  constructor(@Inject('INVENTORY_PACKAGE') private readonly client: ClientGrpc) { }

  onModuleInit() {
    this.inventoryGrpcService = this.client.getService<InventoryGrpcService>('InventoryService');
  }

  async createInventory(data: any) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.createInventory(data).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to create inventory', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getInventoryByProduct(productId: number) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.getInventoryByProduct({ productId }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Inventory not found', HttpStatus.NOT_FOUND);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getAllInventory(page: number = 1, limit: number = 20) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.getAllInventory({ page, limit }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to get inventory', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async adjustStock(data: any) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.adjustStock(data).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to adjust stock', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async reserveStock(data: any) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.reserveStock(data).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to reserve stock', HttpStatus.BAD_REQUEST);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async releaseStock(reservationId: number) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.releaseStock({ reservationId }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to release stock', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async checkAvailability(productId: number, requestedQuantity: number) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.checkAvailability({ productId, requestedQuantity }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to check availability', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getInventoryHistory(productId: number) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.getInventoryHistory({ productId }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to get history', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getLowStockItems(threshold?: number) {
    try {
      return await firstValueFrom(
        this.inventoryGrpcService.getLowStockItems({ threshold }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to get low stock items', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Inventory service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
