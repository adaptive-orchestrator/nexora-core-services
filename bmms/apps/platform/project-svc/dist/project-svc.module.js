"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSvcModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const db_1 = require("@bmms/db");
const typeorm_1 = require("@nestjs/typeorm");
const project_svc_controller_1 = require("./project-svc.controller");
const project_svc_service_1 = require("./project-svc.service");
const project_entity_1 = require("./entities/project.entity");
const task_entity_1 = require("./entities/task.entity");
let ProjectSvcModule = class ProjectSvcModule {
};
exports.ProjectSvcModule = ProjectSvcModule;
exports.ProjectSvcModule = ProjectSvcModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            typeorm_1.TypeOrmModule.forFeature([project_entity_1.Project, task_entity_1.Task]),
            db_1.DbModule.forRoot({ prefix: 'PROJECT_SVC' }),
        ],
        controllers: [project_svc_controller_1.ProjectSvcController],
        providers: [project_svc_service_1.ProjectSvcService],
        exports: [project_svc_service_1.ProjectSvcService],
    })
], ProjectSvcModule);
//# sourceMappingURL=project-svc.module.js.map