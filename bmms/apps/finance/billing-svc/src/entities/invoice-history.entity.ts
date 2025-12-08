import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('invoice_history')
export class InvoiceHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  invoiceId: string;

  @Column()
  invoiceNumber: string;

  @Column({
    type: 'enum',
    enum: ['created', 'sent', 'viewed', 'paid', 'overdue', 'status_changed', 'payment_recorded'],
  })
  action: string;

  @Column({ nullable: true })
  details?: string;

  @CreateDateColumn()
  createdAt: Date;
}