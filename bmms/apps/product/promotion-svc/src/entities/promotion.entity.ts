import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PromotionType {
  PERCENTAGE = 'percentage', // Giảm theo %
  FIXED_AMOUNT = 'fixed_amount', // Giảm số tiền cố định
  TRIAL_EXTENSION = 'trial_extension', // Tăng thời gian trial
  FREE_MONTHS = 'free_months', // Tặng tháng miễn phí
}

export enum PromotionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}

export enum ApplicableTo {
  ALL_PLANS = 'all_plans',
  SPECIFIC_PLANS = 'specific_plans',
  FIRST_TIME_ONLY = 'first_time_only',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string; // Mã giảm giá (VD: SUMMER2024)

  @Column({ length: 255 })
  name: string; // Tên promotion

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PromotionType,
  })
  type: PromotionType;

  @Column({
    type: 'enum',
    enum: PromotionStatus,
    default: PromotionStatus.ACTIVE,
  })
  status: PromotionStatus;

  // Giá trị giảm giá
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountValue: number; // Số tiền hoặc % giảm

  @Column({ type: 'int', nullable: true })
  trialExtensionDays: number; // Số ngày tăng trial

  @Column({ type: 'int', nullable: true })
  freeMonths: number; // Số tháng miễn phí

  // Áp dụng cho plans nào
  @Column({
    type: 'enum',
    enum: ApplicableTo,
    default: ApplicableTo.ALL_PLANS,
  })
  applicableTo: ApplicableTo;

  @Column({ type: 'simple-array', nullable: true })
  specificPlanIds: string[]; // Danh sách plan IDs nếu SPECIFIC_PLANS

  // Giới hạn sử dụng
  @Column({ type: 'int', nullable: true })
  maxUses: number; // Tổng số lần dùng tối đa (null = unlimited)

  @Column({ type: 'int', default: 0 })
  currentUses: number; // Số lần đã dùng

  @Column({ type: 'int', nullable: true })
  maxUsesPerCustomer: number; // Giới hạn mỗi customer

  // Thời gian hiệu lực
  @Column({ type: 'timestamp', nullable: true })
  validFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil: Date;

  // Điều kiện áp dụng
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPurchaseAmount: number; // Giá trị đơn hàng tối thiểu

  @Column({ default: true })
  isFirstTimeOnly: boolean; // Chỉ cho khách hàng mới

  @Column({ default: false })
  isRecurring: boolean; // Áp dụng cho cả renewal hay chỉ lần đầu

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isValid(): boolean {
    if (this.status !== PromotionStatus.ACTIVE) return false;

    const now = new Date();
    if (this.validFrom && now < this.validFrom) return false;
    if (this.validUntil && now > this.validUntil) return false;

    if (this.maxUses && this.currentUses >= this.maxUses) return false;

    return true;
  }

  canApplyToCustomer(isFirstTime: boolean): boolean {
    if (this.isFirstTimeOnly && !isFirstTime) return false;
    return true;
  }

  canApplyToPlan(planId: string): boolean {
    if (this.applicableTo === ApplicableTo.ALL_PLANS) return true;
    if (
      this.applicableTo === ApplicableTo.SPECIFIC_PLANS &&
      this.specificPlanIds?.includes(planId)
    )
      return true;
    return false;
  }

  incrementUses(): void {
    this.currentUses += 1;
    if (this.maxUses && this.currentUses >= this.maxUses) {
      this.status = PromotionStatus.EXPIRED;
    }
  }
}
