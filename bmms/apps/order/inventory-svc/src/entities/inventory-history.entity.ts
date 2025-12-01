import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('inventory_history')
@Index('idx_history_product', ['productId'])
@Index('idx_history_product_created', ['productId', 'createdAt'])
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
  orderId?: number;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}