import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column()
  sku: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('features')
export class Feature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ unique: true })
  code: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column()
  billingCycle: 'monthly' | 'yearly';

  @Column({ default: false })
  trialEnabled: boolean;

  @Column({ default: 0 })
  trialDays: number;

  @ManyToMany(() => Feature)
  @JoinTable({
    name: 'plan_features',
    joinColumn: { name: 'planId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'featureId', referencedColumnName: 'id' },
  })
  features: Feature[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
