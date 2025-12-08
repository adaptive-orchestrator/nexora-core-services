import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PromotionSvcService } from './promotion-svc.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  ValidatePromotionDto,
  ApplyPromotionDto,
} from './dto/validate-promotion.dto';

@Controller()
export class PromotionSvcController {
  constructor(private readonly promotionService: PromotionSvcService) {}

  @GrpcMethod('PromotionService', 'CreatePromotion')
  async createPromotion(data: CreatePromotionDto) {
    return await this.promotionService.create(data);
  }

  @GrpcMethod('PromotionService', 'GetPromotionById')
  async getPromotionById(data: { id: string }) {
    return await this.promotionService.findById(data.id);
  }

  @GrpcMethod('PromotionService', 'GetPromotionByCode')
  async getPromotionByCode(data: { code: string }) {
    return await this.promotionService.findByCode(data.code);
  }

  @GrpcMethod('PromotionService', 'GetAllPromotions')
  async getAllPromotions(data: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const result = await this.promotionService.findAll(
      data.status as any,
      data.limit,
      data.offset,
    );
    return result;
  }

  @GrpcMethod('PromotionService', 'UpdatePromotion')
  async updatePromotion(data: UpdatePromotionDto & { id: string }) {
    const { id, ...dto } = data;
    return await this.promotionService.update(id, dto);
  }

  @GrpcMethod('PromotionService', 'DeletePromotion')
  async deletePromotion(data: { id: string }) {
    return await this.promotionService.delete(data.id);
  }

  @GrpcMethod('PromotionService', 'ValidatePromotion')
  async validatePromotion(data: ValidatePromotionDto) {
    return await this.promotionService.validate(data);
  }

  @GrpcMethod('PromotionService', 'ApplyPromotion')
  async applyPromotion(data: ApplyPromotionDto) {
    return await this.promotionService.apply(data);
  }

  @GrpcMethod('PromotionService', 'GetPromotionUsage')
  async getPromotionUsage(data: {
    promotionId?: string;
    customerId?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.promotionService.getUsageHistory(
      data.promotionId,
      data.customerId,
      data.limit,
      data.offset,
    );
  }
}
