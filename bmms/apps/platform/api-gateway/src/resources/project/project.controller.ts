import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  ParseIntPipe, 
  UseGuards, 
  Request,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam 
} from '@nestjs/swagger';
import { JwtGuard } from '../../guards/jwt.guard';
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from './dto/project.dto';
import { CreateTaskDto, UpdateTaskDto, TaskResponseDto } from './dto/task.dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // Helper to get userId from request or header (for testing without auth)
  private getUserId(req: any, userIdHeader?: string): number {
    return req?.user?.sub || req?.user?.id || (userIdHeader ? parseInt(userIdHeader) : 1);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Project created successfully', type: ProjectResponseDto })
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.createProject(userId, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects for current user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Projects retrieved successfully', type: [ProjectResponseDto] })
  async getProjects(
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.getProjectsByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project found', type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Project not found' })
  async getProjectById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.getProjectById(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project updated successfully', type: ProjectResponseDto })
  async updateProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.updateProject(id, userId, updateProjectDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Project deleted successfully' })
  async deleteProject(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.deleteProject(id, userId);
  }

  // ==================== TASKS ====================

  @Post(':projectId/tasks')
  @ApiOperation({ summary: 'Create a new task in project' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Task created successfully', type: TaskResponseDto })
  async createTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() createTaskDto: CreateTaskDto,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.createTask(projectId, userId, createTaskDto);
  }

  @Get(':projectId/tasks')
  @ApiOperation({ summary: 'Get all tasks for a project' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tasks retrieved successfully', type: [TaskResponseDto] })
  async getProjectTasks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.getProjectTasks(projectId, userId);
  }

  @Put('tasks/:taskId')
  @ApiOperation({ summary: 'Update task' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task updated successfully', type: TaskResponseDto })
  async updateTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.updateTask(taskId, userId, updateTaskDto);
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: 'Delete task' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Task deleted successfully' })
  async deleteTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.deleteTask(taskId, userId);
  }

  @Get(':projectId/analytics')
  @ApiOperation({ summary: 'Get project analytics' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Analytics retrieved successfully' })
  async getProjectAnalytics(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() req: any,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.getUserId(req, userIdHeader);
    return this.projectService.getProjectAnalytics(projectId, userId);
  }
}
