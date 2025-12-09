import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('payment_records')
export class PaymentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  invoiceId: string;

  @Column({
    type: 'enum',
    enum: ['credit_card', 'bank_transfer', 'cash', 'paypal', 'other'],
  })
  method: 'credit_card' | 'bank_transfer' | 'cash' | 'paypal' | 'other';

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ unique: true })
  transactionId: string;

  @Column({ nullable: true })
  notes?: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments, { onDelete: 'CASCADE' })
  invoice: Invoice;

  @CreateDateColumn()
  createdAt: Date;
}