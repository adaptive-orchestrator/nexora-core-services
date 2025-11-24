"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const project_svc_module_1 = require("./project-svc.module");
const config_1 = require("@nestjs/config");
const dotenv = require("dotenv");
const path = require("path");
const microservices_1 = require("@nestjs/microservices");
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
async function bootstrap() {
    const configService = new config_1.ConfigService();
    const app = await core_1.NestFactory.create(project_svc_module_1.ProjectSvcModule);
    app.connectMicroservice({
        transport: microservices_1.Transport.GRPC,
        options: {
            package: 'project',
            protoPath: path.join(__dirname, './proto/project.proto'),
            url: configService.get('GRPC_LISTEN_PROJECT_URL') || '0.0.0.0:50062',
        },
    });
    await app.startAllMicroservices();
    console.log('✅ Project Service (gRPC) running on port 50062');
}
bootstrap();
//# sourceMappingURL=main.js.map