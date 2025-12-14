import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SubscriptionHistory } from './subscription-history.entity';

export enum SubscriptionStatus {
  PENDING = 'pending',
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  customerId: string;

  @Column('uuid')
  planId: string;

  @Column({ nullable: true })
  planName?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
  billingCycle: 'monthly' | 'yearly';

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  // Billing period
  @Column()
  currentPeriodStart: Date;

  @Column()
  currentPeriodEnd: Date;

  // Trial information
  @Column({ default: false })
  isTrialUsed: boolean;

  @Column({ nullable: true })
  trialStart?: Date;

  @Column({ nullable: true })
  trialEnd?: Date;

  // Cancellation
  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ nullable: true })
  cancelledAt?: Date;

  @Column({ nullable: true })
  cancellationReason?: string;

  // Stripe Integration
  @Column({ nullable: true })
  stripeSubscriptionId?: string;

  @Column({ nullable: true })
  stripeCustomerId?: string;

  // Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => SubscriptionHistory, (history) => history.subscription)
  history: SubscriptionHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE;
  }

  isOnTrial(): boolean {
    return this.status === SubscriptionStatus.TRIAL;
  }

  isCancelled(): boolean {
    return this.status === SubscriptionStatus.CANCELLED;
  }

  isExpired(): boolean {
    return this.status === SubscriptionStatus.EXPIRED;
  }

  shouldBill(): boolean {
    return (
      (this.status === SubscriptionStatus.ACTIVE ||
        this.status === SubscriptionStatus.PAST_DUE) &&
      !this.cancelAtPeriodEnd
    );
  }

  getDaysUntilRenewal(): number {
    const now = new Date();
    const end = new Date(this.currentPeriodEnd);
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
