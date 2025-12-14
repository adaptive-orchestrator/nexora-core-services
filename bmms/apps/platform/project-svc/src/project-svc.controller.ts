import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ProjectSvcService } from './project-svc.service';

@Controller()
export class ProjectSvcController {
  constructor(private readonly projectService: ProjectSvcService) {}

  @GrpcMethod('ProjectService', 'CreateProject')
  async createProject(data: any) {
    return this.projectService.createProject(data);
  }

  @GrpcMethod('ProjectService', 'GetProjectsByUser')
  async getProjectsByUser(data: { user_id: string }) {
    const projects = await this.projectService.getProjectsByUser(data.user_id);
    return { projects };
  }

  @GrpcMethod('ProjectService', 'GetProjectById')
  async getProjectById(data: { id: string; user_id: string }) {
    return this.projectService.getProjectById(data.id, data.user_id);
  }

  @GrpcMethod('ProjectService', 'UpdateProject')
  async updateProject(data: any) {
    return this.projectService.updateProject(data);
  }

  @GrpcMethod('ProjectService', 'DeleteProject')
  async deleteProject(data: { id: string; user_id: string }) {
    await this.projectService.deleteProject(data.id, data.user_id);
    return { message: 'Project deleted successfully' };
  }

  // ==================== TASKS ====================

  @GrpcMethod('ProjectService', 'CreateTask')
  async createTask(data: any) {
    return this.projectService.createTask(data);
  }

  @GrpcMethod('ProjectService', 'GetProjectTasks')
  async getProjectTasks(data: { project_id: string; user_id: string }) {
    const tasks = await this.projectService.getProjectTasks(data.project_id, data.user_id);
    return { tasks };
  }

  @GrpcMethod('ProjectService', 'UpdateTask')
  async updateTask(data: any) {
    return this.projectService.updateTask(data);
  }

  @GrpcMethod('ProjectService', 'DeleteTask')
  async deleteTask(data: { id: string; user_id: string }) {
    await this.projectService.deleteTask(data.id, data.user_id);
    return { message: 'Task deleted successfully' };
  }

  @GrpcMethod('ProjectService', 'GetProjectAnalytics')
  async getProjectAnalytics(data: { id: string; user_id: string }) {
    return this.projectService.getProjectAnalytics(data.id, data.user_id);
  }

  // ==================== QUOTA ====================

  @GrpcMethod('ProjectService', 'GetProjectCount')
  async getProjectCount(data: { user_id: string }) {
    return this.projectService.getProjectCount(data.user_id);
  }

  @GrpcMethod('ProjectService', 'CheckProjectQuota')
  async checkProjectQuota(data: { user_id: string }) {
    // Default max allowed, should be passed from subscription check
    return this.projectService.checkProjectQuota(data.user_id, 5);
  }
}
