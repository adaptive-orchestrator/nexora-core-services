import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Payment Retry Entity
 * 
 * Tracks retry attempts for failed payments
 */
@Entity('payment_retries')
@Index(['paymentId', 'invoiceId'])
@Index(['nextRetryAt'])
@Index(['status'])
export class PaymentRetry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  paymentId: string;

  @Column('uuid')
  invoiceId: string;

  @Column('uuid')
  subscriptionId: string;

  @Column({ default: 0 })
  attemptNumber: number;

  @Column({ default: 7 })
  maxAttempts: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'retrying', 'succeeded', 'exhausted', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'retrying' | 'succeeded' | 'exhausted' | 'cancelled';

  @Column({ type: 'datetime' })
  firstFailureAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastRetryAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  succeededAt: Date | null;

  @Column({ type: 'text' })
  failureReason: string;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'json', nullable: true })
  retryHistory: Array<{
    attemptNumber: number;
    attemptedAt: Date;
    success: boolean;
    error?: string;
    delayMs: number;
  }>;

  @Column({ type: 'json', nullable: true })
  metadata: {
    customerNotified?: boolean;
    notificationsSent?: number;
    failureType?: 'temporary' | 'permanent' | 'unknown';
    retryable?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
