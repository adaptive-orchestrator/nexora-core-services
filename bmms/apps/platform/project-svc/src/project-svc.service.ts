import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';

@Injectable()
export class ProjectSvcService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  async createProject(data: any) {
    console.log('📝 [ProjectSvc] createProject data:', JSON.stringify(data));
    
    // Ensure ownerId is set - default to 1 if not provided
    const ownerId = data.user_id || data.userId || 1;
    
    const project = this.projectRepository.create({
      name: data.name,
      description: data.description,
      status: data.status || 'planning',
      ownerId: ownerId,
      ownerName: 'Current User', // TODO: Get from user service
      startDate: data.start_date,
      endDate: data.end_date,
      tags: data.tags || [],
      totalTasks: 0,
      completedTasks: 0,
      teamMemberCount: 1,
    });

    const saved = await this.projectRepository.save(project);
    return this.mapProjectToResponse(saved);
  }

  async getProjectsByUser(userId: number) {
    const projects = await this.projectRepository.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
    });

    return projects.map(p => this.mapProjectToResponse(p));
  }

  async getProjectById(id: number, userId: number) {
    console.log(`📝 [ProjectSvc] getProjectById id=${id}, userId=${userId}`);
    
    const project = await this.projectRepository.findOne({
      where: { id: Number(id) },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    // Compare as numbers to avoid type mismatch
    if (Number(project.ownerId) !== Number(userId)) {
      console.log(`⚠️ [ProjectSvc] Access denied: ownerId=${project.ownerId} !== userId=${userId}`);
      throw new ForbiddenException('You do not have access to this project');
    }

    return this.mapProjectToResponse(project);
  }

  async updateProject(data: any) {
    const project = await this.projectRepository.findOne({
      where: { id: Number(data.id) },
    });

    if (!project) {
      throw new NotFoundException(`Project ${data.id} not found`);
    }

    if (Number(project.ownerId) !== Number(data.user_id)) {
      throw new ForbiddenException('You do not have access to this project');
    }

    Object.assign(project, {
      name: data.name ?? project.name,
      description: data.description ?? project.description,
      status: data.status ?? project.status,
      startDate: data.start_date ?? project.startDate,
      endDate: data.end_date ?? project.endDate,
      tags: data.tags ?? project.tags,
    });

    const updated = await this.projectRepository.save(project);
    return this.mapProjectToResponse(updated);
  }

  async deleteProject(id: number, userId: number) {
    const project = await this.projectRepository.findOne({
      where: { id: Number(id) },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    if (Number(project.ownerId) !== Number(userId)) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Delete all tasks first
    await this.taskRepository.delete({ projectId: id });
    
    // Delete project
    await this.projectRepository.delete(id);
  }

  // ==================== TASKS ====================

  async createTask(data: any) {
    // Verify project ownership
    await this.getProjectById(data.project_id, data.user_id);

    const task = this.taskRepository.create({
      projectId: data.project_id,
      title: data.title,
      description: data.description,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      assignedTo: data.assigned_to,
      assignedToName: data.assigned_to ? 'Team Member' : 'Unassigned',
      createdBy: data.user_id,
      dueDate: data.due_date,
    });

    const saved = await this.taskRepository.save(task);

    // Update project task count
    await this.updateProjectTaskCount(data.project_id);

    return this.mapTaskToResponse(saved);
  }

  async getProjectTasks(projectId: number, userId: number) {
    // Verify project ownership
    await this.getProjectById(projectId, userId);

    const tasks = await this.taskRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });

    return tasks.map(t => this.mapTaskToResponse(t));
  }

  async updateTask(data: any) {
    const task = await this.taskRepository.findOne({
      where: { id: data.id },
    });

    if (!task) {
      throw new NotFoundException(`Task ${data.id} not found`);
    }

    // Verify project ownership
    await this.getProjectById(task.projectId, data.user_id);

    const oldStatus = task.status;
    
    Object.assign(task, {
      title: data.title ?? task.title,
      description: data.description ?? task.description,
      status: data.status ?? task.status,
      priority: data.priority ?? task.priority,
      assignedTo: data.assigned_to ?? task.assignedTo,
      dueDate: data.due_date ?? task.dueDate,
    });

    const updated = await this.taskRepository.save(task);

    // Update project task count if status changed
    if (oldStatus !== updated.status) {
      await this.updateProjectTaskCount(task.projectId);
    }

    return this.mapTaskToResponse(updated);
  }

  async deleteTask(id: number, userId: number) {
    const task = await this.taskRepository.findOne({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    // Verify project ownership
    await this.getProjectById(task.projectId, userId);

    await this.taskRepository.delete(id);

    // Update project task count
    await this.updateProjectTaskCount(task.projectId);
  }

  async getProjectAnalytics(id: number, userId: number) {
    const project = await this.getProjectById(id, userId);
    
    const tasks = await this.taskRepository.find({
      where: { projectId: id },
    });

    const tasksByStatus = {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in-progress').length,
      in_review: tasks.filter(t => t.status === 'in-review').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };

    const completionRate = tasks.length > 0 
      ? Math.round((tasksByStatus.completed / tasks.length) * 100) 
      : 0;

    const now = new Date();
    const overdueTasksCount = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
    ).length;

    const upcomingTasksCount = tasks.filter(t => {
      if (!t.dueDate || t.status === 'completed') return false;
      const dueDate = new Date(t.dueDate);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).length;

    return {
      tasks_by_status: tasksByStatus,
      completion_rate: completionRate,
      overdue_tasks: overdueTasksCount,
      upcoming_tasks: upcomingTasksCount,
    };
  }

  // ==================== HELPERS ====================

  private async updateProjectTaskCount(projectId: number) {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) return;

    const tasks = await this.taskRepository.find({
      where: { projectId },
    });

    project.totalTasks = tasks.length;
    project.completedTasks = tasks.filter(t => t.status === 'completed').length;

    await this.projectRepository.save(project);
  }

  private mapProjectToResponse(project: Project) {
    let startDate: string | null = null;
    let endDate: string | null = null;
    
    try {
      if (project.startDate && project.startDate instanceof Date) {
        startDate = project.startDate.toISOString().split('T')[0];
      } else if (project.startDate && typeof project.startDate === 'string') {
        startDate = project.startDate;
      }
    } catch (e) {
      console.log('Error parsing startDate:', e);
    }
    
    try {
      if (project.endDate && project.endDate instanceof Date) {
        endDate = project.endDate.toISOString().split('T')[0];
      } else if (project.endDate && typeof project.endDate === 'string') {
        endDate = project.endDate;
      }
    } catch (e) {
      console.log('Error parsing endDate:', e);
    }
    
    return {
      id: project.id,
      name: project.name,
      description: project.description || '',
      status: project.status || 'planning',
      owner_id: project.ownerId,
      owner_name: project.ownerName || '',
      total_tasks: project.totalTasks || 0,
      completed_tasks: project.completedTasks || 0,
      team_member_count: project.teamMemberCount || 1,
      start_date: startDate || '',
      end_date: endDate || '',
      tags: project.tags || [],
      created_at: project.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: project.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private mapTaskToResponse(task: Task) {
    let dueDate: string | null = null;
    
    try {
      if (task.dueDate && task.dueDate instanceof Date) {
        dueDate = task.dueDate.toISOString().split('T')[0];
      } else if (task.dueDate && typeof task.dueDate === 'string') {
        dueDate = task.dueDate;
      }
    } catch (e) {
      console.log('Error parsing dueDate:', e);
    }
    
    return {
      id: task.id,
      project_id: task.projectId,
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      assigned_to: task.assignedTo || 0,
      assigned_to_name: task.assignedToName || '',
      created_by: task.createdBy || 0,
      due_date: dueDate || '',
      created_at: task.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: task.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
