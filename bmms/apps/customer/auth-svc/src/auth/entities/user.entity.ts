import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

export enum BusinessModel {
  RETAIL = 'retail',
  SUBSCRIPTION = 'subscription',
  FREEMIUM = 'freemium',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: '' })
  name: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: BusinessModel,
    nullable: true,
    comment: 'Business model preference (only for ADMIN users)',
  })
  businessModel?: BusinessModel;

  @Column({ nullable: true })
  resetToken: string;

  @Column({ nullable: true, type: 'datetime' })
  resetTokenExpires: Date | null;;
}
