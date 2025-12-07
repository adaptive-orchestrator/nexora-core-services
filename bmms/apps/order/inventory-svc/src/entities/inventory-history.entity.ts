import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('inventory_history')
@Index('idx_history_product', ['productId'])
@Index('idx_history_product_created', ['productId', 'createdAt'])
export class InventoryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

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

  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}