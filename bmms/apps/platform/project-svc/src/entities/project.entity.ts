import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { Task } from './task.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'planning' })
  status: string;

  @Column({ name: 'owner_id' })
  ownerId: number;

  @Column({ name: 'owner_name', nullable: true })
  ownerName: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'total_tasks', default: 0 })
  totalTasks: number;

  @Column({ name: 'completed_tasks', default: 0 })
  completedTasks: number;

  @Column({ name: 'team_member_count', default: 1 })
  teamMemberCount: number;

  @OneToMany(() => Task, task => task.project)
  tasks: Task[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
