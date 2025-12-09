import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Inventory } from './inventory.entity';

@Entity('inventory_reservations')
@Index('idx_reservation_product', ['productId'])
@Index('idx_reservation_order', ['orderId'])
@Index('idx_reservation_status', ['status'])
@Index('idx_reservation_product_order_status', ['productId', 'orderId', 'status'])
export class InventoryReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @Column()
  quantity: number;

  @Column('uuid')
  orderId: string;

  @Column('uuid')
  customerId: string;

  @Column({ type: 'enum', enum: ['active', 'completed', 'cancelled'] })
  status: 'active' | 'completed' | 'cancelled';

  @Column({ nullable: true })
  expiresAt?: Date;

  @ManyToOne(() => Inventory, (inventory) => inventory.reservations)
  inventory: Inventory;

  @CreateDateColumn()
  createdAt: Date;
}