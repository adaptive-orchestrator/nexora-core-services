import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WebhookProcessingStatus } from '../constants/stripe-webhook-events';

/**
 * Entity to track Stripe webhook events for idempotency
 */
@Entity('stripe_webhook_events')
// @Index(['stripeEventId'], { unique: true })
@Index(['eventType'])
@Index(['status'])
@Index(['orderId'])
@Index(['createdAt'])
export class StripeWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  stripeEventId: string; // Stripe event ID (e.g., evt_xxx)

  @Column({ type: 'varchar', length: 100 })
  eventType: string; // e.g., checkout.session.completed

  @Column({
    type: 'enum',
    enum: WebhookProcessingStatus,
    default: WebhookProcessingStatus.PENDING,
  })
  status: WebhookProcessingStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeObjectId?: string; // ID of the object (session, charge, etc.)

  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @Column({ type: 'uuid', nullable: true })
  customerId?: string;

  @Column({ type: 'uuid', nullable: true })
  paymentId?: string; // Reference to our Payment entity

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'json', nullable: true })
  eventData?: Record<string, any>; // Store raw event data for debugging

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
