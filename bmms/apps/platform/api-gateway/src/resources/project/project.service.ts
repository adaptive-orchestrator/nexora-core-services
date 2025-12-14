import { Injectable, NotFoundException, ForbiddenException, Inject, OnModuleInit, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

// Custom exception for payment required scenarios
class PaymentRequiredException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, message, error: 'Payment Required' },
      HttpStatus.PAYMENT_REQUIRED
    );
  }
}

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
  // Quota
  getProjectCount(data: any): any;
  checkProjectQuota(data: any): any;
}

interface ISubscriptionGrpcService {
  checkSubscriptionStatus(data: any): any;
  getPlanLimits(data: any): any;
}

// Response interfaces for gRPC calls
interface PlanLimitsResponse {
  maxProjects: number;
  planName: string;
  isActive: boolean;
}

interface ProjectCountResponse {
  count: number;
}

@Injectable()
export class ProjectService implements OnModuleInit {
  private projectService: IProjectGrpcService;
  private subscriptionService: ISubscriptionGrpcService;

  constructor(
    @Inject('PROJECT_PACKAGE') private client: ClientGrpc,
    @Inject('SUBSCRIPTION_PACKAGE') private subscriptionClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.projectService = this.client.getService<IProjectGrpcService>('ProjectService');
    this.subscriptionService = this.subscriptionClient.getService<ISubscriptionGrpcService>('SubscriptionService');
  }

  /**
   * Create project with quota checking
   * Verifies user has active subscription and hasn't exceeded project limit
   */
  async createProject(userId: string, dto: CreateProjectDto) {
    // Check subscription status and quota before creating project
    await this.checkProjectCreationAllowed(userId.toString());

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

  /**
   * Check if user is allowed to create a new project
   * Throws PaymentRequiredException if no active subscription
   * Throws BadRequestException if quota exceeded
   */
  private async checkProjectCreationAllowed(userId: string): Promise<void> {
    try {
      // Check subscription status
      const subscriptionStatus: any = await firstValueFrom(
        this.subscriptionService.checkSubscriptionStatus({ customerId: userId })
      );

      if (!subscriptionStatus.isActive) {
        throw new PaymentRequiredException(
          'Active subscription required to create projects. Please subscribe to a plan.'
        );
      }

      // Get plan limits
      const planLimits: any = await firstValueFrom(
        this.subscriptionService.getPlanLimits({ customerId: userId })
      );

      // Get current project count
      const projectCount: any = await firstValueFrom(
        this.projectService.getProjectCount({ user_id: userId })
      );

      const currentCount = projectCount.count || 0;
      const maxProjects = planLimits.maxProjects || 1;

      if (currentCount >= maxProjects) {
        throw new BadRequestException(
          `Quota exceeded: You have ${currentCount} projects out of ${maxProjects} allowed by your ${planLimits.planName} plan. ` +
          `Please upgrade your plan or delete existing projects.`
        );
      }
    } catch (error) {
      // If subscription service is unavailable, allow creation (graceful degradation)
      // In production, you might want to be stricter
      if (error instanceof PaymentRequiredException || error instanceof BadRequestException) {
        throw error;
      }
      console.warn('[ProjectService] Could not check subscription status, allowing project creation:', error);
    }
  }

  /**
   * Get quota status for a user - useful for frontend to show remaining quota
   */
  async getQuotaStatus(userId: string) {
    try {
      const [planLimits, projectCount] = await Promise.all([
        firstValueFrom(this.subscriptionService.getPlanLimits({ customerId: userId })) as Promise<PlanLimitsResponse>,
        firstValueFrom(this.projectService.getProjectCount({ user_id: userId })) as Promise<ProjectCountResponse>,
      ]);

      return {
        currentProjects: projectCount.count || 0,
        maxProjects: planLimits.maxProjects || 0,
        remainingProjects: Math.max(0, (planLimits.maxProjects || 0) - (projectCount.count || 0)),
        planName: planLimits.planName,
        isActive: planLimits.isActive,
      };
    } catch (error) {
      return {
        currentProjects: 0,
        maxProjects: 0,
        remainingProjects: 0,
        planName: 'Unknown',
        isActive: false,
        error: 'Could not retrieve quota information',
      };
    }
  }

  async getProjectsByUser(userId: string) {
    const response: any = await firstValueFrom(
      this.projectService.getProjectsByUser({ user_id: userId })
    );
    return response.projects || [];
  }

  async getProjectById(id: number, userId: string) {
    return firstValueFrom(
      this.projectService.getProjectById({ id, user_id: userId })
    );
  }

  async updateProject(id: number, userId: string, dto: UpdateProjectDto) {
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

  async deleteProject(id: number, userId: string) {
    return firstValueFrom(
      this.projectService.deleteProject({ id, user_id: userId })
    );
  }

  // ==================== TASKS ====================

  async createTask(projectId: number, userId: string, dto: CreateTaskDto) {
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

  async getProjectTasks(projectId: number, userId: string) {
    const response: any = await firstValueFrom(
      this.projectService.getProjectTasks({ project_id: projectId, user_id: userId })
    );
    return response.tasks || [];
  }

  async updateTask(taskId: number, userId: string, dto: UpdateTaskDto) {
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

  async deleteTask(taskId: number, userId: string) {
    return firstValueFrom(
      this.projectService.deleteTask({ id: taskId, user_id: userId })
    );
  }

  async getProjectAnalytics(projectId: number, userId: string) {
    return firstValueFrom(
      this.projectService.getProjectAnalytics({ id: projectId, user_id: userId })
    );
  }
}
