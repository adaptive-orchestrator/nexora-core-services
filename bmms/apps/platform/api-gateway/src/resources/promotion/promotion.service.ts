import {
  Injectable,
  OnModuleInit,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  ValidatePromotionDto,
  ApplyPromotionDto,
} from './dto/validate-promotion.dto';

interface PromotionGrpcService {
  createPromotion(data: any): any;
  getPromotionById(data: { id: string }): any;
  getPromotionByCode(data: { code: string }): any;
  getAllPromotions(data: {
    status?: string;
    limit?: number;
    offset?: number;
  }): any;
  updatePromotion(data: any): any;
  deletePromotion(data: { id: string }): any;
  validatePromotion(data: ValidatePromotionDto): any;
  applyPromotion(data: ApplyPromotionDto): any;
  getPromotionUsage(data: {
    promotionId?: string;
    customerId?: string;
    limit?: number;
    offset?: number;
  }): any;
}

@Injectable()
export class PromotionService implements OnModuleInit {
  private promotionService: PromotionGrpcService;

  constructor(
    @Inject('PROMOTION_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.promotionService =
      this.client.getService<PromotionGrpcService>('PromotionService');
  }

  async createPromotion(dto: CreatePromotionDto) {
    try {
      return await firstValueFrom(this.promotionService.createPromotion(dto));
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create promotion',
        error.code || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPromotionById(id: string) {
    try {
      return await firstValueFrom(
        this.promotionService.getPromotionById({ id }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Promotion not found',
        error.code || HttpStatus.NOT_FOUND,
      );
    }
  }

  async getPromotionByCode(code: string) {
    try {
      return await firstValueFrom(
        this.promotionService.getPromotionByCode({ code }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Promotion not found',
        error.code || HttpStatus.NOT_FOUND,
      );
    }
  }

  async getAllPromotions(status?: string, limit = 50, offset = 0) {
    try {
      return await firstValueFrom(
        this.promotionService.getAllPromotions({ status, limit, offset }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch promotions',
        error.code || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    try {
      return await firstValueFrom(
        this.promotionService.updatePromotion({ id, ...dto }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update promotion',
        error.code || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deletePromotion(id: string) {
    try {
      return await firstValueFrom(this.promotionService.deletePromotion({ id }));
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete promotion',
        error.code || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validatePromotion(dto: ValidatePromotionDto) {
    try {
      return await firstValueFrom(this.promotionService.validatePromotion(dto));
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to validate promotion',
        error.code || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async applyPromotion(dto: ApplyPromotionDto) {
    try {
      return await firstValueFrom(this.promotionService.applyPromotion(dto));
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to apply promotion',
        error.code || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPromotionUsage(
    promotionId?: string,
    customerId?: string,
    limit = 50,
    offset = 0,
  ) {
    try {
      return await firstValueFrom(
        this.promotionService.getPromotionUsage({
          promotionId,
          customerId,
          limit,
          offset,
        }),
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch promotion usage',
        error.code || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
