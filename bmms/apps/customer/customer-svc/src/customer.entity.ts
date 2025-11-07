import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum CustomerSegment {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
}

export enum LifecycleStage {
  LEAD = 'lead',           // Chưa mua hàng
  PROSPECT = 'prospect',   // Đang quan tâm
  CUSTOMER = 'customer',   // Đã mua hàng
  LOYAL = 'loyal',         // Mua nhiều lần
  CHURNED = 'churned',     // Không hoạt động lâu
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({
    type: 'enum',
    enum: CustomerSegment,
    default: CustomerSegment.BRONZE,
  })
  segment!: CustomerSegment;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status!: CustomerStatus;

  @Column({
    type: 'enum',
    enum: LifecycleStage,
    default: LifecycleStage.LEAD,
  })
  lifecycleStage!: LifecycleStage;

  @Column({ nullable: true })
  tenantId?: string;

  @Column({ nullable: true })
  userId?: number; // Reference to User from Auth service

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalSpent!: number; // Tổng chi tiêu

  @Column({ type: 'int', default: 0 })
  orderCount!: number; // Số lượng đơn hàng

  @Column({ type: 'datetime', nullable: true })
  lastOrderDate?: Date; // Ngày mua hàng gần nhất

  @Column({ type: 'text', nullable: true })
  notes?: string; // Ghi chú về khách hàng

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  role: string;
}
