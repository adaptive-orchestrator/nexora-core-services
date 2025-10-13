import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  orderNumber: string; // ORD-2025-001, ORD-2025-002, etc.

  @Column()
  customerId: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  subtotal: number; // Tổng giá trước phí

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tax: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  shippingCost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  shippingAddress?: string;

  @Column({ nullable: true })
  billingAddress?: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  calculateTotal(): number {
  const subtotal = Number(this.subtotal) || 0;
  const tax = Number(this.tax) || 0;
  const shipping = Number(this.shippingCost) || 0;
  const discount = Number(this.discount) || 0;

  return subtotal + tax + shipping - discount;
}


  getItemCount(): number {
    return this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  }
}