import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('order_history')
export class OrderHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @Column()
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: ['created', 'updated', 'status_changed', 'item_added', 'item_removed', 'cancelled'],
  })
  action: 'created' | 'updated' | 'status_changed' | 'item_added' | 'item_removed' | 'cancelled';

  @Column({ nullable: true })
  previousStatus?: string;

  @Column({ nullable: true })
  newStatus?: string;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}