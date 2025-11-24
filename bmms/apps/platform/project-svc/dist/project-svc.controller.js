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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSvcController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const project_svc_service_1 = require("./project-svc.service");
let ProjectSvcController = class ProjectSvcController {
    constructor(projectService) {
        this.projectService = projectService;
    }
    async createProject(data) {
        return this.projectService.createProject(data);
    }
    async getProjectsByUser(data) {
        const projects = await this.projectService.getProjectsByUser(data.user_id);
        return { projects };
    }
    async getProjectById(data) {
        return this.projectService.getProjectById(data.id, data.user_id);
    }
    async updateProject(data) {
        return this.projectService.updateProject(data);
    }
    async deleteProject(data) {
        await this.projectService.deleteProject(data.id, data.user_id);
        return { message: 'Project deleted successfully' };
    }
    async createTask(data) {
        return this.projectService.createTask(data);
    }
    async getProjectTasks(data) {
        const tasks = await this.projectService.getProjectTasks(data.project_id, data.user_id);
        return { tasks };
    }
    async updateTask(data) {
        return this.projectService.updateTask(data);
    }
    async deleteTask(data) {
        await this.projectService.deleteTask(data.id, data.user_id);
        return { message: 'Task deleted successfully' };
    }
    async getProjectAnalytics(data) {
        return this.projectService.getProjectAnalytics(data.id, data.user_id);
    }
};
exports.ProjectSvcController = ProjectSvcController;
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'CreateProject'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "createProject", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'GetProjectsByUser'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "getProjectsByUser", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'GetProjectById'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "getProjectById", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'UpdateProject'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "updateProject", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'DeleteProject'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "deleteProject", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'CreateTask'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "createTask", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'GetProjectTasks'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "getProjectTasks", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'UpdateTask'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "updateTask", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'DeleteTask'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "deleteTask", null);
__decorate([
    (0, microservices_1.GrpcMethod)('ProjectService', 'GetProjectAnalytics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectSvcController.prototype, "getProjectAnalytics", null);
exports.ProjectSvcController = ProjectSvcController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [project_svc_service_1.ProjectSvcService])
], ProjectSvcController);
//# sourceMappingURL=project-svc.controller.js.map