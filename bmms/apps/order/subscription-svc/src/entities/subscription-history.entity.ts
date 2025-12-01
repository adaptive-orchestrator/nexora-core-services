import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Subscription } from './subscription.entity';

@Entity('subscription_history')
export class SubscriptionHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subscriptionId: number;

  @Column()
  action: string; // 'created', 'renewed', 'cancelled', 'status_changed', 'plan_changed', etc.

  @Column({ nullable: true })
  previousStatus?: string;

  @Column({ nullable: true })
  newStatus?: string;

  @Column({ nullable: true })
  previousPlanId?: number;

  @Column({ nullable: true })
  newPlanId?: number;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne(() => Subscription, (subscription) => subscription.history, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @CreateDateColumn()
  createdAt: Date;
}
