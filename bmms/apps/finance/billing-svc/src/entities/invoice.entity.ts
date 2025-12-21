import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { InvoiceItem } from './invoice-item.entity';
import { PaymentRecord } from './payment-record.entity';


@Entity('invoices')
@Index(['status', 'createdAt'])  // Composite index for list queries
@Index(['customerId', 'status']) // Index for customer queries
@Index(['subscriptionId'])       // Index for subscription queries
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string; // INV-2025-10-00001

  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @Column({ nullable: true })
  orderNumber?: string;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId?: string;

  @Column({
    type: 'enum',
    enum: ['onetime', 'recurring'],
    default: 'onetime',
  })
  invoiceType: 'onetime' | 'recurring';

  @Column('uuid')
  @Index()
  customerId: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
  })
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';

  @Column('decimal', { precision: 12, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tax: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  shippingCost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column('decimal', { precision: 12, scale: 2 })
  dueAmount: number; // totalAmount - paidAmount

  @Column()
  dueDate: Date;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  issuedAt?: Date;

  @Column({ nullable: true })
  paidAt?: Date;

  @Column({ nullable: true })
  periodStart?: Date; // For recurring invoices

  @Column({ nullable: true })
  periodEnd?: Date; // For recurring invoices

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => PaymentRecord, (payment) => payment.invoice, {
    cascade: true,
  })
  payments: PaymentRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isPaid(): boolean {
    return Number(this.paidAmount) >= Number(this.totalAmount);
  }

  isOverdue(): boolean {
    return new Date() > new Date(this.dueDate) && !this.isPaid();
  }

  getRemainingAmount(): number {
    return Number(this.totalAmount) - Number(this.paidAmount);
  }
}