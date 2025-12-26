# Audit & Bug Fixing Summary Report

## 1. Swagger Authentication Fix ✅

### Problem
Token không được gửi kèm trong Header khi gọi API từ Swagger UI mặc dù đã nhập vào nút "Authorize".

### Root Cause
- `main.ts` định nghĩa scheme là `'accessToken'` trong `.addBearerAuth()`
- Nhưng các controllers dùng `@ApiBearerAuth()` không có tham số → không match với scheme

### Solution
Đã cập nhật tất cả `@ApiBearerAuth()` thành `@ApiBearerAuth('accessToken')` trong các file:
- `payment.controller.ts` (14 endpoints)
- `subscription.controller.ts` (15 endpoints)
- `order.controller.ts` (9 endpoints)
- `inventory.controller.ts` (12 endpoints)
- `catalogue.controller.ts` (8 endpoints)
- `ai-chat.controller.ts` (class-level)
- `admin-stats.controller.ts` (class-level)
- `customer.controller.ts` (1 endpoint)

---

## 2. libs/event Audit ✅

### Current State
- ✅ Đã dùng **Kafka** (không phải EventEmitter in-memory) → Đây là đúng cho Microservices!
- ✅ Hỗ trợ publish events qua Kafka topics

### Improvements Made
1. Thêm `@Global()` decorator vào `EventModule`
2. Thêm `global: true` vào DynamicModule config
3. Export `EventPublisher` và `EventService` từ module

### Files Changed
- [event.module.ts](libs/event/src/event.module.ts)

### Usage Example
```typescript
// In your service module
@Module({
  imports: [
    EventModule.forRoot({
      clientId: 'my-service',
      consumerGroupId: 'my-service-group',
    }),
  ],
})
export class MyServiceModule {}

// In your service
@Injectable()
export class MyService {
  constructor(private readonly eventPublisher: EventPublisher) {}
  
  async doSomething() {
    await this.eventPublisher.publish('topic.name', { data: 'value' });
  }
}
```

---

## 3. gRPC Context Propagation (libs/common) ✅

### Problem
Khi API Gateway giải mã JWT để lấy `userId`, làm sao để truyền thông tin này xuống các Microservice qua gRPC?

### Solution
Tạo các utilities mới trong `libs/common/src/grpc/`:

#### A. GrpcMetadataInterceptor (API Gateway side)
- Chạy sau JwtGuard
- Tự động inject user info vào gRPC Metadata
- Metadata keys: `x-user-id`, `x-user-email`, `x-user-role`, `x-user-name`, `x-request-id`

#### B. GrpcCurrentUser Decorator (Microservice side)
- Extract user context từ gRPC Metadata
- Sử dụng giống như `@CurrentUser()` trong HTTP controllers

### Files Created
- [grpc-metadata.interceptor.ts](libs/common/src/grpc/grpc-metadata.interceptor.ts)
- [grpc-user.decorator.ts](libs/common/src/grpc/grpc-user.decorator.ts)
- [grpc/index.ts](libs/common/src/grpc/index.ts)

### Files Changed
- [libs/common/src/index.ts](libs/common/src/index.ts) - Export grpc module
- [api-gateway.module.ts](apps/platform/api-gateway/src/api-gateway.module.ts) - Register global interceptor

### Usage in Microservice
```typescript
import { GrpcCurrentUser, GrpcUserContext, GrpcUserId } from '@bmms/common';

@Controller()
export class ProjectController {
  @GrpcMethod('ProjectService', 'CreateProject')
  async createProject(
    data: CreateProjectRequest,
    @GrpcCurrentUser() user: GrpcUserContext,  // Full user context
    // OR
    @GrpcUserId() userId: string,  // Just userId
  ) {
    console.log('Request from user:', user.userId);
    return this.projectService.create(data, user.userId);
  }
}
```

---

## 4. Webhook Events Update ✅

### Problem
Payment-svc emit Stripe events, nhưng Subscription-svc chưa lắng nghe đầy đủ.

### Solution

#### A. Added Stripe Webhook Event Handlers in subscription-svc
Events được handle:
- `stripe.checkout.completed` - Activate pending subscription
- `stripe.subscription.created` - Link Stripe subscription ID
- `stripe.subscription.updated` - Sync status changes
- `stripe.subscription.deleted` - Cancel subscription
- `stripe.invoice.paid` - Extend subscription period
- `stripe.invoice.failed` - Mark as past_due

#### B. Added Helper Methods in SubscriptionService
- `findPendingByCustomer()` - Find pending subscription for customer
- `linkStripeSubscription()` - Link Stripe subscription ID to local subscription
- `updateByStripeId()` - Update subscription by Stripe ID
- `cancelByStripeId()` - Cancel subscription by Stripe ID
- `extendPeriodByStripeId()` - Extend period after payment

#### C. Added Stripe Fields to Subscription Entity
```typescript
@Column({ nullable: true })
stripeSubscriptionId?: string;

@Column({ nullable: true })
stripeCustomerId?: string;
```

### Files Changed
- [subscription.event-listener.ts](apps/order/subscription-svc/src/subscription.event-listener.ts)
- [subscription-svc.service.ts](apps/order/subscription-svc/src/subscription-svc.service.ts)
- [subscription.entity.ts](apps/order/subscription-svc/src/entities/subscription.entity.ts)

### Migration Required
Run migration: [add-stripe-fields-to-subscriptions.sql](migrations/add-stripe-fields-to-subscriptions.sql)

---

## Event Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Stripe API    │────▶│   payment-svc   │────▶│     Kafka       │
│   (Webhook)     │     │ (webhook handler)│     │   (Events)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
              ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
              │ subscription-svc │            │   billing-svc   │            │   order-svc     │
              │ (event listener) │            │ (event listener) │            │ (event listener) │
              └─────────────────┘            └─────────────────┘            └─────────────────┘
```

## Testing Checklist

- [ ] Start all services with `docker-compose up`
- [ ] Open Swagger UI at `http://localhost:3000/api`
- [ ] Click "Authorize" and enter JWT token
- [ ] Verify token is sent in Authorization header for protected endpoints
- [ ] Test Stripe webhook with test mode
- [ ] Verify subscription status updates after payment
