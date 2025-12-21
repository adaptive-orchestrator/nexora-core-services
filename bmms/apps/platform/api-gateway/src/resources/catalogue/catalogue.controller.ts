import { Controller, Post, Body, Get, Param, Put, HttpCode, HttpStatus, ValidationPipe, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { JwtGuard } from '../../guards/jwt.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { CurrentUser, getUserIdAsCustomerId } from '../../decorators/current-user.decorator';
import type { JwtUserPayload } from '../../decorators/current-user.decorator';

@ApiTags('Catalogue')
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) { }

  // ============= PRODUCTS =============
  
  // User-specific endpoints - get only products owned by current user
  @Get('products/my')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get my products', description: 'Retrieve products owned by current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiOkResponse({ description: 'Products retrieved successfully' })
  async getMyProducts(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const ownerId = String(getUserIdAsCustomerId(user));
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 20;
    return this.catalogueService.getProductsByOwner(ownerId, pageNum, limitNum);
  }

  @Get('products/my/:id')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get my product by ID', description: 'Retrieve a specific product owned by current user' })
  @ApiOkResponse({ description: 'Product retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async getMyProductById(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ) {
    const result = await this.catalogueService.getProductById(id) as { product?: { id: string; ownerId?: string } };
    const ownerId = String(getUserIdAsCustomerId(user));
    
    // Check ownership
    if (result?.product?.ownerId && result.product.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this product');
    }
    
    return result;
  }

  @Post('products')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Create product', description: 'Create a new product in catalogue' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async createProduct(
    @CurrentUser() user: JwtUserPayload,
    @Body(ValidationPipe) body: CreateProductDto,
  ) {
    const ownerId = getUserIdAsCustomerId(user);
    return this.catalogueService.createProduct({ ...body, ownerId });
  }

  @Get('products')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Get all products (Admin)', description: 'Retrieve all products from catalogue with pagination - Admin only' })
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
  @ApiOperation({ summary: 'Get product by ID', description: 'Retrieve a specific product (public access)' })
  @ApiOkResponse({ description: 'Product retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async getProductById(
    @Param('id') id: string,
  ) {
    // Public access - no ownership check needed for viewing
    // Products are publicly viewable for browsing
    const result = await this.catalogueService.getProductById(id);
    return result;
  }

  @Put('products/:id')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: 'Update product', description: 'Update an existing product' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async updateProduct(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body(ValidationPipe) body: CreateProductDto,
  ) {
    // Check ownership first
    const existing = await this.catalogueService.getProductById(id) as { product?: { id: string; ownerId?: string } };
    const ownerId = String(getUserIdAsCustomerId(user));
    
    if (existing?.product?.ownerId && existing.product.ownerId !== ownerId && user.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to update this product');
    }
    
    return this.catalogueService.updateProduct(id, body);
  }

  // ============= PLANS =============
  @Post('plans')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('accessToken')
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
    return this.catalogueService.getPlanById(id);
  }

  // ============= FEATURES =============
  @Post('features')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('accessToken')
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
    return this.catalogueService.getFeatureById(id);
  }
}
