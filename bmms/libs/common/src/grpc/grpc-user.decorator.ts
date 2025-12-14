import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';

/**
 * GrpcUserContext interface - represents user data extracted from gRPC metadata
 */
export interface GrpcUserContext {
  userId: string;
  email?: string;
  role?: string;
  name?: string;
  requestId?: string;
  correlationId?: string;
}

/**
 * @GrpcCurrentUser decorator
 * 
 * Use this decorator in gRPC microservices to extract user context
 * from incoming gRPC metadata (set by API Gateway's GrpcMetadataInterceptor).
 * 
 * The decorator reads metadata keys:
 * - x-user-id: User ID
 * - x-user-email: User email
 * - x-user-role: User role
 * - x-user-name: User name
 * - x-request-id: Request ID for tracing
 * 
 * Usage in Microservice Controller:
 * ```typescript
 * import { GrpcCurrentUser, GrpcUserContext } from '@bmms/common';
 * 
 * @Controller()
 * export class ProjectController {
 *   @GrpcMethod('ProjectService', 'CreateProject')
 *   async createProject(
 *     data: CreateProjectRequest,
 *     @GrpcCurrentUser() user: GrpcUserContext,
 *   ) {
 *     console.log('Request from user:', user.userId);
 *     // user.userId, user.email, user.role, user.name available
 *     return this.projectService.create(data, user.userId);
 *   }
 * }
 * ```
 * 
 * Can also extract specific property:
 * ```typescript
 * @GrpcMethod('ProjectService', 'CreateProject')
 * async createProject(
 *   data: CreateProjectRequest,
 *   @GrpcCurrentUser('userId') userId: string,
 * ) {
 *   // Just the userId
 * }
 * ```
 */
export const GrpcCurrentUser = createParamDecorator(
  (data: keyof GrpcUserContext | undefined, ctx: ExecutionContext): GrpcUserContext | string | null => {
    // Get the RPC context
    const rpcContext = ctx.switchToRpc();
    
    // Try to get metadata from the context
    // NestJS stores metadata in different ways depending on the transport
    let metadata: Metadata | undefined;
    
    try {
      // For gRPC, metadata is typically in the context
      const context = rpcContext.getContext();
      
      // Check if context is Metadata directly
      if (context instanceof Metadata) {
        metadata = context;
      } 
      // Check if context has metadata property (common pattern)
      else if (context?.metadata instanceof Metadata) {
        metadata = context.metadata;
      }
      // Check if it's a Map-like object with get method
      else if (context?.get && typeof context.get === 'function') {
        metadata = context as Metadata;
      }
      // Try to get from call object
      else if (context?.call?.metadata) {
        metadata = context.call.metadata;
      }
    } catch (error) {
      // Silently fail if we can't get metadata
    }

    if (!metadata) {
      // Return null or empty context if no metadata found
      return data ? null : { userId: '' };
    }

    // Extract user info from metadata
    const getUserMetadataValue = (key: string): string | undefined => {
      try {
        const values = metadata!.get(key);
        return values?.[0]?.toString();
      } catch {
        return undefined;
      }
    };

    const userContext: GrpcUserContext = {
      userId: getUserMetadataValue('x-user-id') || '',
      email: getUserMetadataValue('x-user-email'),
      role: getUserMetadataValue('x-user-role'),
      name: getUserMetadataValue('x-user-name'),
      requestId: getUserMetadataValue('x-request-id'),
      correlationId: getUserMetadataValue('x-correlation-id'),
    };

    // If specific property requested, return just that
    if (data) {
      return userContext[data] || null;
    }

    return userContext;
  },
);

/**
 * @GrpcUserId decorator - shorthand for getting just the user ID
 * 
 * Usage:
 * ```typescript
 * @GrpcMethod('ProjectService', 'CreateProject')
 * async createProject(
 *   data: CreateProjectRequest,
 *   @GrpcUserId() userId: string,
 * ) {
 *   // userId directly available
 * }
 * ```
 */
export const GrpcUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const rpcContext = ctx.switchToRpc();
    let metadata: Metadata | undefined;
    
    try {
      const context = rpcContext.getContext();
      if (context instanceof Metadata) {
        metadata = context;
      } else if (context?.metadata instanceof Metadata) {
        metadata = context.metadata;
      } else if (context?.get && typeof context.get === 'function') {
        metadata = context as Metadata;
      }
    } catch {
      // Ignore
    }

    if (!metadata) {
      return '';
    }

    try {
      const values = metadata.get('x-user-id');
      return values?.[0]?.toString() || '';
    } catch {
      return '';
    }
  },
);

/**
 * @GrpcUserRole decorator - shorthand for getting user role
 */
export const GrpcUserRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const rpcContext = ctx.switchToRpc();
    let metadata: Metadata | undefined;
    
    try {
      const context = rpcContext.getContext();
      if (context instanceof Metadata) {
        metadata = context;
      } else if (context?.metadata instanceof Metadata) {
        metadata = context.metadata;
      } else if (context?.get && typeof context.get === 'function') {
        metadata = context as Metadata;
      }
    } catch {
      // Ignore
    }

    if (!metadata) {
      return 'user';
    }

    try {
      const values = metadata.get('x-user-role');
      return values?.[0]?.toString() || 'user';
    } catch {
      return 'user';
    }
  },
);
