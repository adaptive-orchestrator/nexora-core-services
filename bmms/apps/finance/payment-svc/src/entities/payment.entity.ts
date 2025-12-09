import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payments')
@Index(['invoiceId'])
@Index(['customerId'])
@Index(['status'])
@Index(['createdAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  invoiceId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  invoiceNumber: string;

  @Column({ type: 'uuid', nullable: false })
  customerId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  totalAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  paidAmount: number;

  @Column({
    type: 'enum',
    enum: ['initiated', 'processing', 'completed', 'failed'],
    default: 'initiated',
  })
  status: 'initiated' | 'processing' | 'completed' | 'failed';

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  failureReason: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}