import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Add-on Entity
 * 
 * Represents additional paid features that can be purchased
 * by freemium or subscription users.
 * 
 * Examples:
 * - Extra storage (100GB for 50,000 VND/month)
 * - AI Assistant (100,000 VND/month)
 * - Priority support (30,000 VND/month)
 * - Custom domain (20,000 VND/month)
 */
@Entity('addons')
@Index('idx_addon_active', ['isActive'])
@Index('idx_addon_key_active', ['addonKey', 'isActive'])
export class Addon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'addon_key', unique: true })
  @Index('idx_addon_key')
  addonKey: string; // e.g., 'extra_storage', 'ai_assistant'

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: ['monthly', 'yearly', 'onetime'],
    default: 'monthly',
  })
  billingPeriod: 'monthly' | 'yearly' | 'onetime';

  @Column({ default: true })
  isActive: boolean;

  @Column('json', { nullable: true })
  features: Record<string, any>; // Extra metadata

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
