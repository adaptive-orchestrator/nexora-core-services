import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Unique,
} from 'typeorm';
import { InventoryReservation } from './inventory-reservation.entity';

@Entity('inventory')
@Unique('uq_inventory_product_owner', ['productId', 'ownerId'])
@Index('idx_inventory_product', ['productId'])
@Index('idx_inventory_owner', ['ownerId'])
@Index('idx_inventory_quantity_reorder', ['quantity', 'reorderLevel'])
@Index('idx_inventory_active', ['isActive'])
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @Column({ nullable: true })
  ownerId: string;

  @Column()
  quantity: number; // Số lượng available

  @Column({ default: 0 })
  reserved: number; // Số lượng đã đặt trước

  @Column({ nullable: true })
  warehouseLocation?: string;

  @Column({ nullable: true, default: 10 })
  reorderLevel?: number;

  @Column({ nullable: true, default: 1000 })
  maxStock?: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(
    () => InventoryReservation,
    (reservation) => reservation.inventory,
    { cascade: true },
  )
  reservations: InventoryReservation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getAvailableQuantity(): number {
    return this.quantity - this.reserved;
  }

  getTotalQuantity(): number {
    return this.quantity + this.reserved;
  }
}
