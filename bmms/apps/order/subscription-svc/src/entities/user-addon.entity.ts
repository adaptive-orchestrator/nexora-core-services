import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * User Add-on Purchase Record
 * 
 * Tracks which add-ons are purchased by which user.
 * Used for billing and access control.
 */
@Entity('user_addons')
@Index('idx_user_addon_sub_status', ['subscriptionId', 'status'])
@Index('idx_user_addon_customer', ['customerId'])
@Index('idx_user_addon_addon_status', ['addonId', 'status'])
@Index('idx_user_addon_billing', ['nextBillingDate', 'status'])
export class UserAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id', type: 'uuid' })
  @Index('idx_subscription_id')
  subscriptionId: string;

  @Column({ name: 'addon_id', type: 'uuid' })
  @Index('idx_addon_id')
  addonId: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number; // Price at time of purchase

  @Column({
    type: 'enum',
    enum: ['active', 'cancelled', 'expired'],
    default: 'active',
  })
  @Index('idx_status')
  status: 'active' | 'cancelled' | 'expired';

  @Column({ name: 'purchased_at', type: 'timestamp' })
  purchasedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null; // For recurring add-ons

  @Column({ name: 'next_billing_date', type: 'timestamp', nullable: true })
  nextBillingDate: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
