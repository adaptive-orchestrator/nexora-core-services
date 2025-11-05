
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';


import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { CreateFeatureDto } from '../dto/create-feature.dto';
import { UpdateFeatureDto } from '../dto/update-feature.dto';
import { Feature, Plan, Product } from './catalogue.entity';

// Import catalogue strategies
import { CatalogueStrategyService } from './strategies/catalogue-strategy.service';
import { CatalogueQueryParams, CatalogueDisplayResult } from './strategies/catalogue-strategy.interface';


@Injectable()
export class CatalogueSvcService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,

    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,

    // Inject catalogue strategy service
    private readonly catalogueStrategy: CatalogueStrategyService,
  ) {}

  // ============= PRODUCTS =============

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const product = await this.productRepo.save(this.productRepo.create(dto));

    this.kafka.emit('product.created', {
      id: product.id,
      name: product.name,
      price: product.price,
      sku: product.sku,
      createdAt: product.createdAt,
    });

    return product;
  }

  async listProducts(): Promise<Product[]> {
    return this.productRepo.find();
  }

  async findProductById(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async updateProduct(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findProductById(id);
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async removeProduct(id: number): Promise<void> {
    await this.productRepo.delete(id);
  }

  // ============= PLANS =============

  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    // Handle features (optional, can be empty array)
    // Note: gRPC sends 'featureIds', but DTO might have 'features'
    const featureIds = (dto as any).featureIds || dto.features || [];
    
    let features: Feature[] = [];
    if (featureIds.length > 0) {
      features = await this.featureRepo.findBy({
        id: In(featureIds)
      });
      if (features.length !== featureIds.length) {
        throw new BadRequestException('Some features not found');
      }
    }

    // Create plan without features first
    const plan = this.planRepo.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      billingCycle: dto.billingCycle,
      trialEnabled: dto.trialEnabled ?? false,
      trialDays: dto.trialDays ?? 0,
    });

    const savedPlan = await this.planRepo.save(plan);

    // Manually add features to the plan using query builder
    if (features.length > 0) {
      await this.planRepo
        .createQueryBuilder()
        .relation(Plan, 'features')
        .of(savedPlan.id)
        .add(features.map(f => f.id));
    }

    // Reload plan with features to ensure they're properly loaded
    const planWithFeatures = await this.planRepo.findOne({
      where: { id: savedPlan.id },
      relations: ['features'],
    });

    if (!planWithFeatures) {
      throw new NotFoundException('Plan not found after creation');
    }

    this.kafka.emit('plan.created', {
      id: planWithFeatures.id,
      name: planWithFeatures.name,
      price: planWithFeatures.price,
      billingCycle: planWithFeatures.billingCycle,
      featureIds: planWithFeatures.features.map(f => f.id),
      createdAt: planWithFeatures.createdAt,
    });

    return planWithFeatures;
  }

  async listPlans(): Promise<Plan[]> {
    return this.planRepo.find({ relations: ['features'] });
  }

  async findPlanById(id: number): Promise<Plan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['features'],
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async updatePlan(id: number, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findPlanById(id);

    if (dto.features) {
      const features = await this.featureRepo.findByIds(dto.features);
      if (features.length !== dto.features.length) {
        throw new BadRequestException('Some features not found');
      }
      plan.features = features;
    }

    Object.assign(plan, { ...dto, features: undefined });
    return this.planRepo.save(plan);
  }

  async removePlan(id: number): Promise<void> {
    await this.planRepo.delete(id);
  }

  // ============= FEATURES =============

  async createFeature(dto: CreateFeatureDto): Promise<Feature> {
    const feature = await this.featureRepo.save(this.featureRepo.create(dto));

    this.kafka.emit('feature.created', {
      id: feature.id,
      name: feature.name,
      code: feature.code,
      createdAt: feature.createdAt,
    });

    return feature;
  }

  async listFeatures(): Promise<Feature[]> {
    return this.featureRepo.find();
  }

  async findFeatureById(id: number): Promise<Feature> {
    const feature = await this.featureRepo.findOne({ where: { id } });
    if (!feature) throw new NotFoundException(`Feature ${id} not found`);
    return feature;
  }

  async updateFeature(id: number, dto: UpdateFeatureDto): Promise<Feature> {
    const feature = await this.findFeatureById(id);
    Object.assign(feature, dto);
    return this.featureRepo.save(feature);
  }

  async removeFeature(id: number): Promise<void> {
    await this.featureRepo.delete(id);
  }

  // ============= NEW: SMART CATALOGUE WITH STRATEGY PATTERN =============

  /**
   * Get catalogue items using automatic strategy selection
   */
  async getItemsByModel(params: CatalogueQueryParams): Promise<CatalogueDisplayResult> {
    console.log('🎯 Getting catalogue items with STRATEGY pattern');
    return await this.catalogueStrategy.getItemsByModel(params);
  }

  async getRetailProducts(params?: { limit?: number }): Promise<CatalogueDisplayResult> {
    return this.getItemsByModel({ businessModel: 'retail', ...params });
  }

  async getSubscriptionPlans(params?: { limit?: number }): Promise<CatalogueDisplayResult> {
    return this.getItemsByModel({ businessModel: 'subscription', ...params });
  }

  async getFreemiumItems(params?: { limit?: number }): Promise<CatalogueDisplayResult> {
    return this.getItemsByModel({ businessModel: 'freemium', ...params });
  }
}
