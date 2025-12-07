import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @Column('uuid')
  productId: string;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number; // Unit price at time of order

  @Column('decimal', { precision: 12, scale: 2 })
  subtotal: number; // quantity * price

  @Column({ nullable: true })
  notes?: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @CreateDateColumn()
  createdAt: Date;

  // Helper methods
  calculateSubtotal(): number {
    return this.quantity * Number(this.price);
  }
}