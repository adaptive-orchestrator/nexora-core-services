import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

/**
 * GrpcMetadataInterceptor
 * 
 * This interceptor runs on the API Gateway to inject user context (from JWT)
 * into gRPC metadata before forwarding requests to microservices.
 * 
 * It extracts user info from the HTTP request (set by JwtGuard) and adds it
 * to gRPC metadata so downstream services can identify the user.
 * 
 * Metadata keys added:
 * - x-user-id: The user's ID
 * - x-user-email: The user's email
 * - x-user-role: The user's role (user/admin)
 * - x-user-name: The user's name
 * - x-request-id: Unique request ID for tracing
 * 
 * Usage in API Gateway:
 * ```typescript
 * // In your module
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useClass: GrpcMetadataInterceptor,
 *     },
 *   ],
 * })
 * export class ApiGatewayModule {}
 * 
 * // Or at controller level
 * @UseInterceptors(GrpcMetadataInterceptor)
 * @Controller('projects')
 * export class ProjectController {}
 * ```
 */
@Injectable()
export class GrpcMetadataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    // Extract user from JWT (set by JwtGuard/Passport)
    const user = request.user;

    if (user) {
      // Store user context in request for later use by services
      request.grpcMetadata = this.createGrpcMetadata(user, request);
    }

    return next.handle();
  }

  /**
   * Create gRPC Metadata object from user context
   */
  createGrpcMetadata(user: any, request?: any): Metadata {
    const metadata = new Metadata();

    // Add user information
    if (user.userId || user.sub || user.id) {
      metadata.add('x-user-id', String(user.userId || user.sub || user.id));
    }
    if (user.email) {
      metadata.add('x-user-email', user.email);
    }
    if (user.role) {
      metadata.add('x-user-role', user.role);
    }
    if (user.name) {
      metadata.add('x-user-name', user.name);
    }

    // Add request tracing
    const requestId = request?.headers?.['x-request-id'] || 
                      request?.id || 
                      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    metadata.add('x-request-id', requestId);

    // Forward correlation ID if exists
    if (request?.headers?.['x-correlation-id']) {
      metadata.add('x-correlation-id', request.headers['x-correlation-id']);
    }

    return metadata;
  }
}

/**
 * Helper function to create metadata for gRPC calls
 * Use this in services when calling gRPC methods
 * 
 * Usage:
 * ```typescript
 * // In your API Gateway service
 * @Injectable()
 * export class ProjectService {
 *   constructor(
 *     @Inject('PROJECT_PACKAGE') private projectClient: ClientGrpc,
 *   ) {}
 * 
 *   async createProject(userId: string, dto: CreateProjectDto) {
 *     const metadata = createUserMetadata({ userId, role: 'user' });
 *     return this.projectGrpc.CreateProject({ ...dto, userId }, metadata);
 *   }
 * }
 * ```
 */
export function createUserMetadata(user: {
  userId?: string;
  email?: string;
  role?: string;
  name?: string;
}, requestId?: string): Metadata {
  const metadata = new Metadata();

  if (user.userId) {
    metadata.add('x-user-id', user.userId);
  }
  if (user.email) {
    metadata.add('x-user-email', user.email);
  }
  if (user.role) {
    metadata.add('x-user-role', user.role);
  }
  if (user.name) {
    metadata.add('x-user-name', user.name);
  }

  metadata.add('x-request-id', requestId || `req-${Date.now()}`);

  return metadata;
}

/**
 * Extract user context from gRPC Metadata
 * Use this in microservices to get user info from incoming requests
 * 
 * Note: GrpcUserContext interface is defined in grpc-user.decorator.ts
 * to avoid duplicate exports. Import from there.
 */
import { GrpcUserContext } from './grpc-user.decorator';

export function extractUserFromMetadata(metadata: Metadata): GrpcUserContext | null {
  const userId = metadata.get('x-user-id')?.[0]?.toString();
  
  if (!userId) {
    return null;
  }

  return {
    userId,
    email: metadata.get('x-user-email')?.[0]?.toString(),
    role: metadata.get('x-user-role')?.[0]?.toString(),
    name: metadata.get('x-user-name')?.[0]?.toString(),
    requestId: metadata.get('x-request-id')?.[0]?.toString(),
    correlationId: metadata.get('x-correlation-id')?.[0]?.toString(),
  };
}
