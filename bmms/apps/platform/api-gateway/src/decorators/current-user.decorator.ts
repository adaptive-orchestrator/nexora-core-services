import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current user from JWT token
 * Use after JwtGuard to get the authenticated user
 * 
 * Usage:
 * @UseGuards(JwtGuard)
 * @Get('my-data')
 * async getMyData(@CurrentUser() user: JwtUserPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtUserPayload | undefined, ctx: ExecutionContext): JwtUserPayload | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtUserPayload;
    
    // If a specific property is requested, return only that
    if (data) {
      return user?.[data];
    }
    
    return user;
  },
);

/**
 * Interface for JWT payload stored in request.user
 */
export interface JwtUserPayload {
  userId: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

/**
 * Helper to get customerId from userId
 * In this system, userId from auth-svc maps to customerId in customer-svc
 */
export function getUserIdAsCustomerId(user: JwtUserPayload): string {
  return user?.userId;
}
