import { Injectable, OnModuleInit, Inject, HttpException, HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';

interface CatalogueGrpcService {
  createProduct(data: any): any;
  getAllProducts(data: any): any;
  getProductById(data: { id: number }): any;
  updateProduct(data: any): any;
  createPlan(data: any): any;
  getAllPlans(data: any): any;
  getPlanById(data: { id: number }): any;
  createFeature(data: any): any;
  getAllFeatures(data: any): any;
  getFeatureById(data: { id: number }): any;
}

@Injectable()
export class CatalogueService implements OnModuleInit {
  private catalogueGrpcService: CatalogueGrpcService;

  constructor(@Inject('CATALOGUE_PACKAGE') private readonly client: ClientGrpc) { }

  onModuleInit() {
    this.catalogueGrpcService = this.client.getService<CatalogueGrpcService>('CatalogueService');
  }

  // Products
  async createProduct(data: any) {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.createProduct(data).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to create product', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getAllProducts(page: number = 1, limit: number = 20) {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.getAllProducts({ page, limit }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to get products', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getProductById(id: number) {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.getProductById({ id }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Product not found', HttpStatus.NOT_FOUND);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async updateProduct(id: number, data: any) {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.updateProduct({ id, ...data }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to update product', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // Plans
  async createPlan(data: any) {
    try {
      // Map 'features' to 'featureIds' for gRPC
      const grpcData = {
        ...data,
        featureIds: data.features || [],
      };
      delete grpcData.features;

      return await firstValueFrom(
        this.catalogueGrpcService.createPlan(grpcData).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to create plan', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getAllPlans() {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.getAllPlans({}).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to get plans', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getPlanById(id: number) {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.getPlanById({ id }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Plan not found', HttpStatus.NOT_FOUND);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // Features
  async createFeature(data: any) {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.createFeature(data).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to create feature', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getAllFeatures() {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.getAllFeatures({}).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Failed to get features', HttpStatus.INTERNAL_SERVER_ERROR);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getFeatureById(id: number) {
    try {
      return await firstValueFrom(
        this.catalogueGrpcService.getFeatureById({ id }).pipe(
          catchError(error => {
            throw new HttpException(error.details || 'Feature not found', HttpStatus.NOT_FOUND);
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Catalogue service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
