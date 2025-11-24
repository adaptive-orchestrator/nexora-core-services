import { Task } from './task.entity';
export declare class Project {
    id: number;
    name: string;
    description: string;
    status: string;
    ownerId: number;
    ownerName: string;
    startDate: Date;
    endDate: Date;
    tags: string[];
    totalTasks: number;
    completedTasks: number;
    teamMemberCount: number;
    tasks: Task[];
    createdAt: Date;
    updatedAt: Date;
}
