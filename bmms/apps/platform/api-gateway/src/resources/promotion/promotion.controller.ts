import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  ValidatePromotionDto,
  ApplyPromotionDto,
} from './dto/validate-promotion.dto';
import {
  PromotionResponseDto,
  PromotionListResponseDto,
  ValidationResponseDto,
  ApplyPromotionResponseDto,
} from './dto/promotion-response.dto';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new promotion' })
  @ApiResponse({
    status: 201,
    description: 'Promotion created successfully',
    type: PromotionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Promotion code already exists' })
  async createPromotion(
    @Body(ValidationPipe) dto: CreatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return (await this.promotionService.createPromotion(dto)) as PromotionResponseDto;
  }

  @Get()
  @ApiOperation({ summary: 'Get all promotions' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'expired'] })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'List of promotions',
    type: PromotionListResponseDto,
  })
  async getAllPromotions(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<PromotionListResponseDto> {
    return (await this.promotionService.getAllPromotions(status, limit, offset)) as PromotionListResponseDto;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get promotion by ID' })
  @ApiParam({ name: 'id', type: String, example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Promotion details',
    type: PromotionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async getPromotionById(
    @Param('id') id: string,
  ): Promise<PromotionResponseDto> {
    return (await this.promotionService.getPromotionById(id)) as PromotionResponseDto;
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get promotion by code' })
  @ApiParam({ name: 'code', type: String, example: 'SUMMER2024' })
  @ApiResponse({
    status: 200,
    description: 'Promotion details',
    type: PromotionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async getPromotionByCode(
    @Param('code') code: string,
  ): Promise<PromotionResponseDto> {
    return (await this.promotionService.getPromotionByCode(code)) as PromotionResponseDto;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update promotion' })
  @ApiParam({ name: 'id', type: String, example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Promotion updated successfully',
    type: PromotionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async updatePromotion(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return (await this.promotionService.updatePromotion(id, dto)) as PromotionResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (deactivate) promotion' })
  @ApiParam({ name: 'id', type: String, example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({
    status: 200,
    description: 'Promotion deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async deletePromotion(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    return (await this.promotionService.deletePromotion(id)) as { success: boolean; message: string };
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Validate promotion without applying',
    description: 'Check if a promotion code is valid for a customer and plan, and calculate the discount',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    type: ValidationResponseDto,
  })
  async validatePromotion(
    @Body(ValidationPipe) dto: ValidatePromotionDto,
  ): Promise<ValidationResponseDto> {
    return (await this.promotionService.validatePromotion(dto)) as ValidationResponseDto;
  }

  @Post('apply')
  @ApiOperation({
    summary: 'Apply promotion',
    description: 'Apply a promotion code to a subscription or purchase',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion applied successfully',
    type: ApplyPromotionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Promotion cannot be applied' })
  async applyPromotion(
    @Body(ValidationPipe) dto: ApplyPromotionDto,
  ): Promise<ApplyPromotionResponseDto> {
    return (await this.promotionService.applyPromotion(dto)) as ApplyPromotionResponseDto;
  }

  @Get('usage/history')
  @ApiOperation({ summary: 'Get promotion usage history' })
  @ApiQuery({ name: 'promotionId', required: false, type: Number })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Usage history',
  })
  async getPromotionUsage(
    @Query('promotionId')
    promotionId?: string,
    @Query('customerId')
    customerId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.promotionService.getPromotionUsage(
      promotionId,
      customerId,
      limit,
      offset,
    );
  }
}
