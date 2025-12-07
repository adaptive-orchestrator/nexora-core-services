import { Controller, Post, Body, Get, Param, Patch, HttpCode, HttpStatus, Query, ValidationPipe, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import {
  CreateInventoryResponseDto,
  InventoryListResponseDto,
  InventoryResponseDto,
  ReservationResponseDto,
  AvailabilityResponseDto,
  InventoryErrorResponseDto,
} from './dto/response.dto';
import { JwtGuard } from '../../guards/jwt.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { CurrentUser, getUserIdAsCustomerId } from '../../decorators/current-user.decorator';
import type { JwtUserPayload } from '../../decorators/current-user.decorator';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  // ========== USER ENDPOINTS (authenticated) ==========

  @Get('my')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my inventory', description: 'Retrieve current user inventory items with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiOkResponse({ type: InventoryListResponseDto, description: 'Inventory items retrieved' })
  async getMyInventory(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 20;
    const ownerId = String(getUserIdAsCustomerId(user));
    return this.inventoryService.getInventoryByOwner(ownerId, pageNum, limitNum);
  }

  @Get('my/product/:productId')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my inventory by product', description: 'Retrieve inventory for specific product owned by current user' })
  @ApiOkResponse({ type: CreateInventoryResponseDto, description: 'Inventory retrieved' })
  @ApiNotFoundResponse({ type: InventoryErrorResponseDto, description: 'Inventory not found' })
  async getMyInventoryByProduct(
    @CurrentUser() user: JwtUserPayload,
    @Param('productId') productId: string,
  ) {
    const ownerId = String(getUserIdAsCustomerId(user));
    return this.inventoryService.getInventoryByProduct(productId, ownerId);
  }

  @Post('my')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create my inventory', description: 'Create inventory for a product with current user as owner' })
  @ApiBody({ type: CreateInventoryDto })
  @ApiCreatedResponse({ type: CreateInventoryResponseDto, description: 'Inventory created successfully' })
  @ApiBadRequestResponse({ type: InventoryErrorResponseDto, description: 'Validation error' })
  async createMyInventory(
    @CurrentUser() user: JwtUserPayload,
    @Body(ValidationPipe) body: CreateInventoryDto,
  ) {
    const ownerId = String(getUserIdAsCustomerId(user));
    return this.inventoryService.createInventory({ ...body, ownerId });
  }

  // ========== ADMIN ENDPOINTS ==========

  @Post()
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create inventory (Admin)', description: 'Create inventory for a product' })
  @ApiBody({ type: CreateInventoryDto })
  @ApiCreatedResponse({ type: CreateInventoryResponseDto, description: 'Inventory created successfully' })
  @ApiBadRequestResponse({ type: InventoryErrorResponseDto, description: 'Validation error' })
  async createInventory(@Body(ValidationPipe) body: CreateInventoryDto) {
    return this.inventoryService.createInventory(body);
  }

  @Get()
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all inventory (Admin)', description: 'Retrieve all inventory items with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiOkResponse({ type: InventoryListResponseDto, description: 'Inventory items retrieved' })
  async getAllInventory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 20;
    return this.inventoryService.getAllInventory(pageNum, limitNum);
  }

  @Get('product/:productId')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get inventory by product (Admin)', description: 'Retrieve inventory for specific product' })
  @ApiOkResponse({ type: CreateInventoryResponseDto, description: 'Inventory retrieved' })
  @ApiNotFoundResponse({ type: InventoryErrorResponseDto, description: 'Inventory not found' })
  async getInventoryByProduct(@Param('productId') productId: string) {
    return this.inventoryService.getInventoryByProduct(productId);
  }

  @Post('product/:productId/adjust')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adjust stock', description: 'Adjust inventory stock level' })
  @ApiBody({ type: AdjustStockDto })
  @ApiOkResponse({ type: CreateInventoryResponseDto, description: 'Stock adjusted successfully' })
  @ApiBadRequestResponse({ type: InventoryErrorResponseDto, description: 'Invalid adjustment' })
  async adjustStock(@Param('productId') productId: string, @Body(ValidationPipe) body: AdjustStockDto) {
    return this.inventoryService.adjustStock({
      productId: productId,
      ...body,
    });
  }

  @Post('reserve')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reserve stock', description: 'Reserve inventory for an order' })
  @ApiBody({ type: ReserveStockDto })
  @ApiCreatedResponse({ description: 'Stock reserved successfully' })
  @ApiBadRequestResponse({ type: InventoryErrorResponseDto, description: 'Insufficient stock' })
  async reserveStock(@Body(ValidationPipe) body: ReserveStockDto) {
    return this.inventoryService.reserveStock(body);
  }

  @Post('release/:reservationId')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Release reservation', description: 'Release a stock reservation' })
  @ApiOkResponse({ description: 'Reservation released' })
  async releaseReservation(@Param('reservationId') reservationId: string) {
    return this.inventoryService.releaseStock(reservationId);
  }

  @Get('check-availability/:productId')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check stock availability', description: 'Check if requested quantity is available' })
  @ApiOkResponse({ description: 'Availability checked' })
  @ApiQuery({ name: 'quantity', required: true, type: Number })
  async checkAvailability(
    @Param('productId') productId: string,
    @Query('quantity') quantity: string,
  ) {
    return this.inventoryService.checkAvailability(productId, Number(quantity));
  }

  @Get('product/:productId/history')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get inventory history', description: 'Retrieve inventory adjustment history' })
  @ApiOkResponse({ description: 'History retrieved' })
  async getInventoryHistory(@Param('productId') productId: string) {
    return this.inventoryService.getInventoryHistory(productId);
  }

  @Get('low-stock')
  @UseGuards(JwtGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get low stock items (Admin)', description: 'Retrieve items below reorder level' })
  @ApiOkResponse({ description: 'Low stock items retrieved' })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  async getLowStockItems(@Query('threshold') threshold?: string) {
    return this.inventoryService.getLowStockItems(threshold ? Number(threshold) : undefined);
  }
}
