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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  subscriptionId: string;

  @Column()
  action: string; // 'created', 'renewed', 'cancelled', 'status_changed', 'plan_changed', etc.

  @Column({ nullable: true })
  previousStatus?: string;

  @Column({ nullable: true })
  newStatus?: string;

  @Column({ type: 'uuid', nullable: true })
  previousPlanId?: string;

  @Column({ type: 'uuid', nullable: true })
  newPlanId?: string;

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
