import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { InventoryReservation } from './inventory-reservation.entity';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  productId: number;

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
