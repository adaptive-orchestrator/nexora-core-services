import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('inventory_history')
export class InventoryHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @Column('int')
  previousQuantity: number;

  @Column('int')
  currentQuantity: number;

  @Column('int')
  change: number;

  @Column({
    type: 'enum',
    enum: [
      'restock',
      'sale',
      'damage',
      'loss',
      'adjustment',
      'correction',
      'reservation',
      'release',
    ],
  })
  reason: string;

  @Column({ nullable: true })
  orderId?: string;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}