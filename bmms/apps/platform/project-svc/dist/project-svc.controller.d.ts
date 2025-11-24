import { ProjectSvcService } from './project-svc.service';
export declare class ProjectSvcController {
    private readonly projectService;
    constructor(projectService: ProjectSvcService);
    createProject(data: any): Promise<{
        id: number;
        name: string;
        description: string;
        status: string;
        owner_id: number;
        owner_name: string;
        total_tasks: number;
        completed_tasks: number;
        team_member_count: number;
        start_date: string;
        end_date: string;
        tags: string[];
        created_at: string;
        updated_at: string;
    }>;
    getProjectsByUser(data: {
        user_id: number;
    }): Promise<{
        projects: {
            id: number;
            name: string;
            description: string;
            status: string;
            owner_id: number;
            owner_name: string;
            total_tasks: number;
            completed_tasks: number;
            team_member_count: number;
            start_date: string;
            end_date: string;
            tags: string[];
            created_at: string;
            updated_at: string;
        }[];
    }>;
    getProjectById(data: {
        id: number;
        user_id: number;
    }): Promise<{
        id: number;
        name: string;
        description: string;
        status: string;
        owner_id: number;
        owner_name: string;
        total_tasks: number;
        completed_tasks: number;
        team_member_count: number;
        start_date: string;
        end_date: string;
        tags: string[];
        created_at: string;
        updated_at: string;
    }>;
    updateProject(data: any): Promise<{
        id: number;
        name: string;
        description: string;
        status: string;
        owner_id: number;
        owner_name: string;
        total_tasks: number;
        completed_tasks: number;
        team_member_count: number;
        start_date: string;
        end_date: string;
        tags: string[];
        created_at: string;
        updated_at: string;
    }>;
    deleteProject(data: {
        id: number;
        user_id: number;
    }): Promise<{
        message: string;
    }>;
    createTask(data: any): Promise<{
        id: number;
        project_id: number;
        title: string;
        description: string;
        status: string;
        priority: string;
        assigned_to: number;
        assigned_to_name: string;
        created_by: number;
        due_date: string;
        created_at: string;
        updated_at: string;
    }>;
    getProjectTasks(data: {
        project_id: number;
        user_id: number;
    }): Promise<{
        tasks: {
            id: number;
            project_id: number;
            title: string;
            description: string;
            status: string;
            priority: string;
            assigned_to: number;
            assigned_to_name: string;
            created_by: number;
            due_date: string;
            created_at: string;
            updated_at: string;
        }[];
    }>;
    updateTask(data: any): Promise<{
        id: number;
        project_id: number;
        title: string;
        description: string;
        status: string;
        priority: string;
        assigned_to: number;
        assigned_to_name: string;
        created_by: number;
        due_date: string;
        created_at: string;
        updated_at: string;
    }>;
    deleteTask(data: {
        id: number;
        user_id: number;
    }): Promise<{
        message: string;
    }>;
    getProjectAnalytics(data: {
        id: number;
        user_id: number;
    }): Promise<{
        tasks_by_status: {
            todo: number;
            in_progress: number;
            in_review: number;
            completed: number;
        };
        completion_rate: number;
        overdue_tasks: number;
        upcoming_tasks: number;
    }>;
}
