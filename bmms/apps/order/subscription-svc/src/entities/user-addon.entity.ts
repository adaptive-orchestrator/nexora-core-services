import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

/**
 * User Add-on Purchase Record
 * 
 * Tracks which add-ons are purchased by which user.
 * Used for billing and access control.
 */
@Entity('user_addons')
export class UserAddon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'subscription_id' })
  subscriptionId: number;

  @Column({ name: 'addon_id' })
  addonId: number;

  @Column({ name: 'customer_id' })
  customerId: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number; // Price at time of purchase

  @Column({
    type: 'enum',
    enum: ['active', 'cancelled', 'expired'],
    default: 'active',
  })
  status: 'active' | 'cancelled' | 'expired';

  @Column({ name: 'purchased_at', type: 'timestamp' })
  purchasedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null; // For recurring add-ons

  @Column({ name: 'next_billing_date', type: 'timestamp', nullable: true })
  nextBillingDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
