import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

/**
 * Global gRPC Exception Filter for Catalogue Service
 * Converts NestJS HTTP exceptions to proper gRPC status codes
 */
@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter<any> {
  catch(exception: any, host: ArgumentsHost): Observable<any> {
    // Map HTTP status codes to gRPC status codes
    const grpcStatusMap: Record<number, number> = {
      400: 3,  // INVALID_ARGUMENT
      401: 16, // UNAUTHENTICATED
      403: 7,  // PERMISSION_DENIED
      404: 5,  // NOT_FOUND
      409: 6,  // ALREADY_EXISTS
      429: 8,  // RESOURCE_EXHAUSTED
      500: 13, // INTERNAL
      501: 12, // UNIMPLEMENTED
      503: 14, // UNAVAILABLE
    };

    let grpcCode = 2; // UNKNOWN (default)
    let message = 'Internal server error';

    if (exception?.getStatus) {
      const httpStatus = exception.getStatus();
      grpcCode = grpcStatusMap[httpStatus] || 2;
      message = exception.message || exception.getResponse?.()?.message || message;
    } else if (exception instanceof RpcException) {
      const error = exception.getError();
      if (typeof error === 'object' && error !== null) {
        grpcCode = (error as any).code || grpcCode;
        message = (error as any).message || (error as any).details || message;
      } else {
        message = String(error);
      }
    } else {
      message = exception?.message || exception?.details || message;
    }

    // Return gRPC-formatted error
    return throwError(() => ({
      code: grpcCode,
      message,
      details: message,
    }));
  }
}
