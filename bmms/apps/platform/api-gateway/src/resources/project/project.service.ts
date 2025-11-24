import { Injectable, NotFoundException, ForbiddenException, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

interface IProjectGrpcService {
  createProject(data: any): any;
  getProjectsByUser(data: any): any;
  getProjectById(data: any): any;
  updateProject(data: any): any;
  deleteProject(data: any): any;
  createTask(data: any): any;
  getProjectTasks(data: any): any;
  updateTask(data: any): any;
  deleteTask(data: any): any;
  getProjectAnalytics(data: any): any;
}

@Injectable()
export class ProjectService implements OnModuleInit {
  private projectService: IProjectGrpcService;

  constructor(
    @Inject('PROJECT_PACKAGE') private client: ClientGrpc
  ) {}

  onModuleInit() {
    this.projectService = this.client.getService<IProjectGrpcService>('ProjectService');
  }

  async createProject(userId: number, dto: CreateProjectDto) {
    return firstValueFrom(
      this.projectService.createProject({
        user_id: userId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        start_date: null,
        end_date: dto.deadline || null,
        tags: dto.tags || [],
      })
    );
  }

  async getProjectsByUser(userId: number) {
    const response: any = await firstValueFrom(
      this.projectService.getProjectsByUser({ user_id: userId })
    );
    return response.projects || [];
  }

  async getProjectById(id: number, userId: number) {
    return firstValueFrom(
      this.projectService.getProjectById({ id, user_id: userId })
    );
  }

  async updateProject(id: number, userId: number, dto: UpdateProjectDto) {
    return firstValueFrom(
      this.projectService.updateProject({
        id,
        user_id: userId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        start_date: null,
        end_date: dto.deadline || null,
        tags: dto.tags || [],
      })
    );
  }

  async deleteProject(id: number, userId: number) {
    return firstValueFrom(
      this.projectService.deleteProject({ id, user_id: userId })
    );
  }

  // ==================== TASKS ====================

  async createTask(projectId: number, userId: number, dto: CreateTaskDto) {
    return firstValueFrom(
      this.projectService.createTask({
        project_id: projectId,
        user_id: userId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigned_to: dto.assignedTo,
        due_date: dto.dueDate,
      })
    );
  }

  async getProjectTasks(projectId: number, userId: number) {
    const response: any = await firstValueFrom(
      this.projectService.getProjectTasks({ project_id: projectId, user_id: userId })
    );
    return response.tasks || [];
  }

  async updateTask(taskId: number, userId: number, dto: UpdateTaskDto) {
    return firstValueFrom(
      this.projectService.updateTask({
        id: taskId,
        user_id: userId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigned_to: dto.assignedTo,
        due_date: dto.dueDate,
      })
    );
  }

  async deleteTask(taskId: number, userId: number) {
    return firstValueFrom(
      this.projectService.deleteTask({ id: taskId, user_id: userId })
    );
  }

  async getProjectAnalytics(projectId: number, userId: number) {
    return firstValueFrom(
      this.projectService.getProjectAnalytics({ id: projectId, user_id: userId })
    );
  }
}
