import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { debug } from '@bmms/common';
import { CatalogueSvcService } from './catalogue-svc.service';

@Controller()
export class CatalogueSvcController {
  constructor(private readonly service: CatalogueSvcService) {}

  // Products
  @GrpcMethod('CatalogueService', 'CreateProduct')
  async createProduct(data: any) {
    const product = await this.service.createProduct(data);
    return { product };
  }

  @GrpcMethod('CatalogueService', 'GetAllProducts')
  async getAllProducts(data: { page?: number; limit?: number }) {
    const page = data.page || 1;
    const limit = data.limit || 20;
    return await this.service.listProducts(page, limit);
  }

  @GrpcMethod('CatalogueService', 'GetProductsByOwner')
  async getProductsByOwner(data: { ownerId: string; page?: number; limit?: number }) {
    const page = data.page || 1;
    const limit = data.limit || 20;
    return await this.service.listProductsByOwner(data.ownerId, page, limit);
  }

  @GrpcMethod('CatalogueService', 'GetProductById')
  async getProductById(data: { id: string }) {
    try {
      const product = await this.service.findProductById(data.id);
      return { product, message: 'Product found' };
    } catch (error) {
      debug.error(`[CatalogueController] Error getting product ${data.id}:`, error);
      throw error;
    }
  }

  @GrpcMethod('CatalogueService', 'UpdateProduct')
  async updateProduct(data: any) {
    const { id, ...updateData } = data;
    const product = await this.service.updateProduct(id, updateData);
    return { product, message: 'Product updated successfully' };
  }

  // Plans
  @GrpcMethod('CatalogueService', 'CreatePlan')
  async createPlan(data: any) {
    const plan = await this.service.createPlan(data);
    return { plan };
  }

  @GrpcMethod('CatalogueService', 'GetAllPlans')
  async getAllPlans() {
    const plans = await this.service.listPlans();
    return { plans };
  }

  @GrpcMethod('CatalogueService', 'GetPlanById')
  async getPlanById(data: { id: string }) {
    const plan = await this.service.findPlanById(data.id);
    return { plan, message: 'Plan found' };
  }

  // Features
  @GrpcMethod('CatalogueService', 'CreateFeature')
  async createFeature(data: any) {
    const feature = await this.service.createFeature(data);
    return { feature };
  }

  @GrpcMethod('CatalogueService', 'GetAllFeatures')
  async getAllFeatures() {
    const features = await this.service.listFeatures();
    return { features };
  }

  @GrpcMethod('CatalogueService', 'GetFeatureById')
  async getFeatureById(data: { id: string }) {
    const feature = await this.service.findFeatureById(data.id);
    return { feature, message: 'Feature found' };
  }
}
