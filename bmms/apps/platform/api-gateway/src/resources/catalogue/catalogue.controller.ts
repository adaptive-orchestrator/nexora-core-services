import { Controller, Post, Body, Get, Param, Put, HttpCode, HttpStatus, ValidationPipe, Query } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiQuery } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateFeatureDto } from './dto/create-feature.dto';

@ApiTags('Catalogue')
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) { }

  // ============= PRODUCTS =============
  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create product', description: 'Create a new product in catalogue' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async createProduct(@Body(ValidationPipe) body: CreateProductDto) {
    return this.catalogueService.createProduct(body);
  }

  @Get('products')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all products', description: 'Retrieve all products from catalogue with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiOkResponse({ description: 'Products retrieved successfully' })
  async getAllProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 20;
    return this.catalogueService.getAllProducts(pageNum, limitNum);
  }

  @Get('products/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get product by ID', description: 'Retrieve a specific product' })
  @ApiOkResponse({ description: 'Product retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async getProductById(@Param('id') id: string) {
    return this.catalogueService.getProductById(Number(id));
  }

  @Put('products/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update product', description: 'Update an existing product' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async updateProduct(@Param('id') id: string, @Body(ValidationPipe) body: CreateProductDto) {
    return this.catalogueService.updateProduct(Number(id), body);
  }

  // ============= PLANS =============
  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create plan', description: 'Create a new subscription plan' })
  @ApiCreatedResponse({ description: 'Plan created successfully' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async createPlan(@Body(ValidationPipe) body: CreatePlanDto) {
    return this.catalogueService.createPlan(body);
  }

  @Get('plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all plans', description: 'Retrieve all subscription plans' })
  @ApiOkResponse({ description: 'Plans retrieved successfully' })
  async getAllPlans() {
    return this.catalogueService.getAllPlans();
  }

  @Get('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get plan by ID', description: 'Retrieve a specific plan' })
  @ApiOkResponse({ description: 'Plan retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Plan not found' })
  async getPlanById(@Param('id') id: string) {
    return this.catalogueService.getPlanById(Number(id));
  }

  // ============= FEATURES =============
  @Post('features')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create feature', description: 'Create a new feature' })
  @ApiCreatedResponse({ description: 'Feature created successfully' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async createFeature(@Body(ValidationPipe) body: CreateFeatureDto) {
    return this.catalogueService.createFeature(body);
  }

  @Get('features')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all features', description: 'Retrieve all features' })
  @ApiOkResponse({ description: 'Features retrieved successfully' })
  async getAllFeatures() {
    return this.catalogueService.getAllFeatures();
  }

  @Get('features/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get feature by ID', description: 'Retrieve a specific feature' })
  @ApiOkResponse({ description: 'Feature retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Feature not found' })
  async getFeatureById(@Param('id') id: string) {
    return this.catalogueService.getFeatureById(Number(id));
  }
}
