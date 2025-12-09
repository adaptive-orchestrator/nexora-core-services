import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_history')
@Index(['paymentId'])
@Index(['invoiceId'])
@Index(['createdAt'])
export class PaymentHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  action: 'initiated' | 'processing' | 'success' | 'failed' | 'refunded';

  @Column({ type: 'text', nullable: true })
  details?: string;

  @CreateDateColumn()
  createdAt: Date;
}