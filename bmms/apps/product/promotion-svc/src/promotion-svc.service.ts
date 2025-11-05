import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion, PromotionStatus } from './entities/promotion.entity';
import { PromotionUsage } from './entities/promotion-usage.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  ValidatePromotionDto,
  ApplyPromotionDto,
  PromotionValidationResult,
} from './dto/validate-promotion.dto';
// Strategy Pattern import
import { PromotionStrategyService } from './strategies/promotion-strategy.service';

@Injectable()
export class PromotionSvcService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
    @InjectRepository(PromotionUsage)
    private readonly usageRepo: Repository<PromotionUsage>,
    // Inject strategy service
    private readonly strategyService: PromotionStrategyService,
  ) {}

  // ============ CRUD Operations ============

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    // Check if code already exists
    const existing = await this.promotionRepo.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Promotion code '${dto.code}' already exists`,
      );
    }

    // Validate based on promotion type
    this.validatePromotionData(dto);

    const promotion = this.promotionRepo.create(dto);
    
    if (dto.validFrom) {
      promotion.validFrom = new Date(dto.validFrom);
    }
    if (dto.validUntil) {
      promotion.validUntil = new Date(dto.validUntil);
    }

    return await this.promotionRepo.save(promotion);
  }

  async findById(id: number): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({ where: { id } });

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    return promotion;
  }

  async findByCode(code: string): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion code '${code}' not found`);
    }

    return promotion;
  }

  async findAll(
    status?: PromotionStatus,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ promotions: Promotion[]; total: number }> {
    const query = this.promotionRepo.createQueryBuilder('promotion');

    if (status) {
      query.where('promotion.status = :status', { status });
    }

    const [promotions, total] = await query
      .orderBy('promotion.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { promotions, total };
  }

  async update(id: number, dto: UpdatePromotionDto): Promise<Promotion> {
    const promotion = await this.findById(id);

    // If code is being changed, check uniqueness
    if (dto.code && dto.code !== promotion.code) {
      const existing = await this.promotionRepo.findOne({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException(
          `Promotion code '${dto.code}' already exists`,
        );
      }
    }

    // Validate updated data
    this.validatePromotionData({ ...promotion, ...dto });

    Object.assign(promotion, dto);

    if (dto.validFrom) promotion.validFrom = new Date(dto.validFrom);
    if (dto.validUntil) promotion.validUntil = new Date(dto.validUntil);

    return await this.promotionRepo.save(promotion);
  }

  async delete(id: number): Promise<{ success: boolean; message: string }> {
    const promotion = await this.findById(id);

    // Soft delete by setting status to inactive
    promotion.status = PromotionStatus.INACTIVE;
    await this.promotionRepo.save(promotion);

    return {
      success: true,
      message: `Promotion '${promotion.code}' has been deactivated`,
    };
  }

  // ============ Validation & Application ============

  async validate(dto: ValidatePromotionDto): Promise<PromotionValidationResult> {
    try {
      const promotion = await this.findByCode(dto.code);

      // Check if promotion is valid
      if (!promotion.isValid()) {
        return {
          valid: false,
          error: 'Promotion is not currently valid (inactive, expired, or used up)',
        };
      }

      // Check if applicable to plan
      if (!promotion.canApplyToPlan(dto.planId)) {
        return {
          valid: false,
          error: 'Promotion is not applicable to this plan',
        };
      }

      // Check customer usage limit
      if (promotion.maxUsesPerCustomer) {
        const customerUsageCount = await this.usageRepo.count({
          where: {
            promotionId: promotion.id,
            customerId: dto.customerId,
          },
        });

        if (customerUsageCount >= promotion.maxUsesPerCustomer) {
          return {
            valid: false,
            error: 'You have reached the maximum usage limit for this promotion',
          };
        }
      }

      // Check minimum purchase amount
      if (
        promotion.minPurchaseAmount &&
        dto.purchaseAmount &&
        dto.purchaseAmount < promotion.minPurchaseAmount
      ) {
        return {
          valid: false,
          error: `Minimum purchase amount is ${promotion.minPurchaseAmount}`,
        };
      }

      // Calculate discount
      const calculatedDiscount = this.calculateDiscount(
        promotion,
        dto.purchaseAmount || 0,
      );

      return {
        valid: true,
        promotion,
        calculatedDiscount,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  async apply(dto: ApplyPromotionDto): Promise<{
    success: boolean;
    error?: string;
    promotion?: Promotion;
    discount?: any;
    usageId?: number;
  }> {
    // First validate
    const validation = await this.validate(dto);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const promotion = validation.promotion;

    if (!validation.calculatedDiscount) {
      return {
        success: false,
        error: 'Failed to calculate discount',
      };
    }

    try {
      // Record usage
      const usage = this.usageRepo.create({
        promotionId: promotion.id,
        customerId: dto.customerId,
        subscriptionId: dto.subscriptionId,
        originalAmount: validation.calculatedDiscount.originalAmount,
        discountAmount: validation.calculatedDiscount.discountAmount,
        finalAmount: validation.calculatedDiscount.finalAmount,
        metadata: JSON.stringify({
          planId: dto.planId,
          appliedAt: new Date(),
        }),
      });

      const savedUsage = await this.usageRepo.save(usage);

      // Increment promotion usage count
      promotion.incrementUses();
      await this.promotionRepo.save(promotion);

      return {
        success: true,
        promotion,
        discount: validation.calculatedDiscount,
        usageId: savedUsage.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply promotion: ${error.message}`,
      };
    }
  }

  // ============ Usage History ============

  async getUsageHistory(
    promotionId?: number,
    customerId?: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ usages: PromotionUsage[]; total: number }> {
    const query = this.usageRepo.createQueryBuilder('usage');

    if (promotionId) {
      query.where('usage.promotionId = :promotionId', { promotionId });
    }

    if (customerId) {
      if (promotionId) {
        query.andWhere('usage.customerId = :customerId', { customerId });
      } else {
        query.where('usage.customerId = :customerId', { customerId });
      }
    }

    const [usages, total] = await query
      .leftJoinAndSelect('usage.promotion', 'promotion')
      .orderBy('usage.usedAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { usages, total };
  }

  // ============ Helper Methods ============

  private validatePromotionData(dto: any): void {
    // Validate based on promotion type
    switch (dto.type) {
      case 'percentage':
        if (!dto.discountValue || dto.discountValue <= 0 || dto.discountValue > 100) {
          throw new BadRequestException(
            'Percentage discount must be between 0 and 100',
          );
        }
        break;

      case 'fixed_amount':
        if (!dto.discountValue || dto.discountValue <= 0) {
          throw new BadRequestException(
            'Fixed amount discount must be greater than 0',
          );
        }
        break;

      case 'trial_extension':
        if (!dto.trialExtensionDays || dto.trialExtensionDays <= 0) {
          throw new BadRequestException(
            'Trial extension days must be greater than 0',
          );
        }
        break;

      case 'free_months':
        if (!dto.freeMonths || dto.freeMonths <= 0) {
          throw new BadRequestException('Free months must be greater than 0');
        }
        break;
    }

    // Validate date range
    if (dto.validFrom && dto.validUntil) {
      const from = new Date(dto.validFrom);
      const until = new Date(dto.validUntil);
      if (from >= until) {
        throw new BadRequestException(
          'validFrom must be earlier than validUntil',
        );
      }
    }

    // Validate specific plans
    if (dto.applicableTo === 'specific_plans' && !dto.specificPlanIds?.length) {
      throw new BadRequestException(
        'specificPlanIds must be provided when applicableTo is specific_plans',
      );
    }
  }

  private calculateDiscount(
    promotion: Promotion,
    purchaseAmount: number,
  ): {
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    trialExtensionDays?: number;
    freeMonths?: number;
  } {
    let discountAmount = 0;
    let trialExtensionDays: number | undefined;
    let freeMonths: number | undefined;

    switch (promotion.type) {
      case 'percentage':
        discountAmount = (purchaseAmount * promotion.discountValue) / 100;
        break;

      case 'fixed_amount':
        discountAmount = Math.min(promotion.discountValue, purchaseAmount);
        break;

      case 'trial_extension':
        trialExtensionDays = promotion.trialExtensionDays;
        break;

      case 'free_months':
        freeMonths = promotion.freeMonths;
        // Calculate equivalent discount (optional)
        discountAmount = purchaseAmount; // Free = 100% off
        break;
    }

    const finalAmount = Math.max(0, purchaseAmount - discountAmount);

    return {
      originalAmount: purchaseAmount,
      discountAmount,
      finalAmount,
      trialExtensionDays,
      freeMonths,
    };
  }

  // ============================================
  // NEW: Strategy-Based Methods
  // ============================================

  /**
   * Validate promotion using PROMOTION_MODE ENV (Dev mode)
   * 
   * Usage in dev:
   * ```bash
   * export PROMOTION_MODE=retail
   * # or
   * export PROMOTION_MODE=subscription
   * # or
   * export PROMOTION_MODE=freemium
   * ```
   */
  async validatePromotionByEnv(params: {
    promotionCode: string;
    userId?: number;
    subscriptionPlanId?: number;
    addonIds?: number[];
  }) {
    return this.strategyService.validatePromotionByEnv(params);
  }

  /**
   * Validate promotion using explicit business model (Production)
   * 
   * Usage:
   * ```typescript
   * await service.validatePromotionByModel('subscription', { 
   *   promotionCode: 'SAVE50',
   *   subscriptionPlanId: 3 
   * });
   * ```
   */
  async validatePromotionByModel(
    businessModel: string,
    params: {
      promotionCode: string;
      userId?: number;
      subscriptionPlanId?: number;
      addonIds?: number[];
    },
  ) {
    return this.strategyService.validatePromotionByModel(businessModel, params);
  }

  /**
   * Calculate discount using PROMOTION_MODE ENV (Dev mode)
   */
  async calculateDiscountByEnv(params: {
    promotionType: 'percentage' | 'fixed_amount' | 'trial_extension' | 'free_months';
    promotionValue: number;
    orderAmount?: number;
    addonPrices?: number[];
  }): Promise<number> {
    return this.strategyService.calculateDiscountByEnv(params);
  }

  /**
   * Calculate discount using explicit business model (Production)
   */
  async calculateDiscountByModel(
    businessModel: string,
    params: {
      promotionType: 'percentage' | 'fixed_amount' | 'trial_extension' | 'free_months';
      promotionValue: number;
      orderAmount?: number;
      addonPrices?: number[];
    },
  ): Promise<number> {
    return this.strategyService.calculateDiscountByModel(businessModel, params);
  }

  /**
   * Get available promotion strategies
   */
  getAvailableStrategies(): string[] {
    return this.strategyService.getAvailableStrategies();
  }

  /**
   * Get current ENV mode
   */
  getCurrentPromotionMode(): string {
    return this.strategyService.getCurrentMode();
  }
}

