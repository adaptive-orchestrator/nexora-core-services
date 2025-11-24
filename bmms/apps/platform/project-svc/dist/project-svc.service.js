"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSvcService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const project_entity_1 = require("./entities/project.entity");
const task_entity_1 = require("./entities/task.entity");
let ProjectSvcService = class ProjectSvcService {
    constructor(projectRepository, taskRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
    }
    async createProject(data) {
        const project = this.projectRepository.create({
            name: data.name,
            description: data.description,
            status: data.status || 'planning',
            ownerId: data.user_id,
            ownerName: 'Current User',
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
    async getProjectsByUser(userId) {
        const projects = await this.projectRepository.find({
            where: { ownerId: userId },
            order: { createdAt: 'DESC' },
        });
        return projects.map(p => this.mapProjectToResponse(p));
    }
    async getProjectById(id, userId) {
        const project = await this.projectRepository.findOne({
            where: { id },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${id} not found`);
        }
        if (project.ownerId !== userId) {
            throw new common_1.ForbiddenException('You do not have access to this project');
        }
        return this.mapProjectToResponse(project);
    }
    async updateProject(data) {
        const project = await this.projectRepository.findOne({
            where: { id: data.id },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${data.id} not found`);
        }
        if (project.ownerId !== data.user_id) {
            throw new common_1.ForbiddenException('You do not have access to this project');
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
    async deleteProject(id, userId) {
        const project = await this.projectRepository.findOne({
            where: { id },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${id} not found`);
        }
        if (project.ownerId !== userId) {
            throw new common_1.ForbiddenException('You do not have access to this project');
        }
        await this.taskRepository.delete({ projectId: id });
        await this.projectRepository.delete(id);
    }
    async createTask(data) {
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
        await this.updateProjectTaskCount(data.project_id);
        return this.mapTaskToResponse(saved);
    }
    async getProjectTasks(projectId, userId) {
        await this.getProjectById(projectId, userId);
        const tasks = await this.taskRepository.find({
            where: { projectId },
            order: { createdAt: 'DESC' },
        });
        return tasks.map(t => this.mapTaskToResponse(t));
    }
    async updateTask(data) {
        const task = await this.taskRepository.findOne({
            where: { id: data.id },
        });
        if (!task) {
            throw new common_1.NotFoundException(`Task ${data.id} not found`);
        }
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
        if (oldStatus !== updated.status) {
            await this.updateProjectTaskCount(task.projectId);
        }
        return this.mapTaskToResponse(updated);
    }
    async deleteTask(id, userId) {
        const task = await this.taskRepository.findOne({
            where: { id },
        });
        if (!task) {
            throw new common_1.NotFoundException(`Task ${id} not found`);
        }
        await this.getProjectById(task.projectId, userId);
        await this.taskRepository.delete(id);
        await this.updateProjectTaskCount(task.projectId);
    }
    async getProjectAnalytics(id, userId) {
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
        const overdueTasksCount = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
        const upcomingTasksCount = tasks.filter(t => {
            if (!t.dueDate || t.status === 'completed')
                return false;
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
    async updateProjectTaskCount(projectId) {
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
        });
        if (!project)
            return;
        const tasks = await this.taskRepository.find({
            where: { projectId },
        });
        project.totalTasks = tasks.length;
        project.completedTasks = tasks.filter(t => t.status === 'completed').length;
        await this.projectRepository.save(project);
    }
    mapProjectToResponse(project) {
        return {
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            owner_id: project.ownerId,
            owner_name: project.ownerName,
            total_tasks: project.totalTasks,
            completed_tasks: project.completedTasks,
            team_member_count: project.teamMemberCount,
            start_date: project.startDate ? project.startDate.toISOString().split('T')[0] : null,
            end_date: project.endDate ? project.endDate.toISOString().split('T')[0] : null,
            tags: project.tags || [],
            created_at: project.createdAt.toISOString(),
            updated_at: project.updatedAt.toISOString(),
        };
    }
    mapTaskToResponse(task) {
        return {
            id: task.id,
            project_id: task.projectId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assigned_to: task.assignedTo,
            assigned_to_name: task.assignedToName,
            created_by: task.createdBy,
            due_date: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null,
            created_at: task.createdAt.toISOString(),
            updated_at: task.updatedAt.toISOString(),
        };
    }
};
exports.ProjectSvcService = ProjectSvcService;
exports.ProjectSvcService = ProjectSvcService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(1, (0, typeorm_1.InjectRepository)(task_entity_1.Task)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectSvcService);
//# sourceMappingURL=project-svc.service.js.map