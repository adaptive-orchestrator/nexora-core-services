import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Promotion } from './promotion.entity';

@Entity('promotion_usage')
export class PromotionUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  promotionId: string;

  @ManyToOne(() => Promotion)
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  subscriptionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountAmount: number; // Số tiền đã giảm

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalAmount: number; // Giá gốc

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  finalAmount: number; // Giá sau giảm

  @Column({ type: 'text', nullable: true })
  metadata: string; // JSON string chứa thông tin thêm

  @CreateDateColumn()
  usedAt: Date;
}
