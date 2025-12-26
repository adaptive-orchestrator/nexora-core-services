/**
 * gRPC utilities for microservices communication
 * 
 * This module provides:
 * - GrpcMetadataInterceptor: Inject user context into gRPC calls (API Gateway)
 * - GrpcCurrentUser: Extract user context from gRPC metadata (Microservices)
 * - createUserMetadata: Helper to create metadata for gRPC calls
 */

export * from './grpc-metadata.interceptor';
export * from './grpc-user.decorator';
