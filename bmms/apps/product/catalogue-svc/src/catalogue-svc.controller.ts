import { Body, Controller, Get, Post } from '@nestjs/common';
import { CatalogueSvcService } from './catalogue-svc.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { CreateFeatureDto } from '../dto/create-feature.dto';

@Controller('catalogue')
export class CatalogueSvcController {
  constructor(private readonly service: CatalogueSvcService) {}

  // Products
  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.service.createProduct(dto);
  }

  @Get('products')
  listProducts() {
    return this.service.listProducts();
  }

  // Plans
  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Get('plans')
  listPlans() {
    return this.service.listPlans();
  }

  // Features
  @Post('features')
  createFeature(@Body() dto: CreateFeatureDto) {
    return this.service.createFeature(dto);
  }

  @Get('features')
  listFeatures() {
    return this.service.listFeatures();
  }
}
