import { Project } from './project.entity';
export declare class Task {
    id: number;
    projectId: number;
    project: Project;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignedTo: number;
    assignedToName: string;
    createdBy: number;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
}
