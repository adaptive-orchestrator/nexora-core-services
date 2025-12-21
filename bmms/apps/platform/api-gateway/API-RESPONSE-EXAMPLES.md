# API Response Examples for Frontend Integration

## Stripe Payment APIs

### 1. POST /api/v1/payments/stripe/checkout
**Create Stripe Checkout Session for one-time payment**

**Request:**
```json
{
  "orderId": "order-uuid-123",
  "items": [
    {
      "productId": "prod-1",
      "name": "Premium Widget",
      "price": 2999,
      "quantity": 2
    }
  ],
  "successUrl": "https://yourapp.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://yourapp.com/checkout/cancel",
  "currency": "usd"
}
```

**Success Response (200):**
```json
{
  "sessionId": "cs_test_a1b2c3d4e5f6g7h8i9j0",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6g7h8i9j0",
  "success": true
}
```

**Error Response (400):**
```json
{
  "statusCode": 400,
  "message": "Invalid items: price must be a positive integer",
  "error": "Bad Request"
}
```

---

### 2. POST /api/v1/payments/stripe/subscription-checkout
**Create Stripe Checkout Session for subscription**

**Request:**
```json
{
  "priceId": "price_1ABC123def456",
  "successUrl": "https://yourapp.com/subscription/success",
  "cancelUrl": "https://yourapp.com/subscription/cancel",
  "trialDays": 14
}
```

**Success Response (200):**
```json
{
  "sessionId": "cs_test_subscription_xyz",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_subscription_xyz",
  "success": true
}
```

---

### 3. POST /api/v1/payments/stripe/billing-portal
**Create Billing Portal Session for self-service**

**Request:**
```json
{
  "returnUrl": "https://yourapp.com/account"
}
```

**Success Response (200):**
```json
{
  "portalUrl": "https://billing.stripe.com/session/sess_xxx",
  "success": true
}
```

---

## Subscription APIs

### 4. GET /api/v1/subscriptions/my/status
**Get current user subscription status**

**Success Response (200) - Active subscription:**
```json
{
  "isActive": true,
  "status": "active",
  "planId": "plan-premium-monthly",
  "planName": "Premium Plan",
  "currentPeriodEnd": "2024-01-15T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "stripeSubscriptionId": "sub_1ABC123"
}
```

**Success Response (200) - No active subscription:**
```json
{
  "isActive": false,
  "status": "expired",
  "planId": "",
  "planName": "",
  "currentPeriodEnd": "",
  "cancelAtPeriodEnd": false
}
```

---

### 5. GET /api/v1/subscriptions/my/limits
**Get plan resource limits for quota checking**

**Success Response (200):**
```json
{
  "isActive": true,
  "planId": "plan-premium-monthly",
  "planName": "Premium Plan",
  "maxProjects": 25,
  "maxTeamMembers": 25,
  "maxStorageGb": 50,
  "maxApiCalls": 100000,
  "features": [
    "advanced_analytics",
    "priority_support",
    "api_access",
    "custom_domain"
  ],
  "currentPeriodEnd": "2024-01-15T00:00:00.000Z"
}
```

---

### 6. GET /api/v1/subscriptions/my/active
**Get full active subscription details**

**Success Response (200):**
```json
{
  "subscription": {
    "id": "sub-uuid-123",
    "customerId": "cust-uuid-456",
    "planId": "plan-premium-monthly",
    "planName": "Premium Plan",
    "amount": 29.99,
    "billingCycle": "monthly",
    "status": "active",
    "currentPeriodStart": "2023-12-15T00:00:00.000Z",
    "currentPeriodEnd": "2024-01-15T00:00:00.000Z",
    "isTrialUsed": true,
    "trialStart": "2023-12-01T00:00:00.000Z",
    "trialEnd": "2023-12-14T23:59:59.000Z",
    "cancelAtPeriodEnd": false,
    "cancelledAt": "",
    "cancellationReason": "",
    "createdAt": "2023-12-01T00:00:00.000Z",
    "updatedAt": "2023-12-15T00:00:00.000Z"
  },
  "message": "Active subscription found"
}
```

**Not Found Response (404):**
```json
{
  "subscription": null,
  "message": "No active subscription found"
}
```

---

## Project APIs

### 7. POST /api/v1/projects
**Create a new project (with quota checking)**

**Request:**
```json
{
  "name": "My New Project",
  "description": "A description of my project",
  "status": "planning",
  "tags": ["web", "react"]
}
```

**Success Response (201):**
```json
{
  "id": 1,
  "name": "My New Project",
  "description": "A description of my project",
  "status": "planning",
  "owner_id": 123,
  "owner_name": "John Doe",
  "total_tasks": 0,
  "completed_tasks": 0,
  "team_member_count": 1,
  "start_date": "",
  "end_date": "",
  "tags": ["web", "react"],
  "created_at": "2024-01-01T12:00:00.000Z",
  "updated_at": "2024-01-01T12:00:00.000Z"
}
```

**Payment Required Response (402):**
```json
{
  "statusCode": 402,
  "message": "Active subscription required to create projects. Please subscribe to a plan.",
  "error": "Payment Required"
}
```

**Quota Exceeded Response (400):**
```json
{
  "statusCode": 400,
  "message": "Quota exceeded: You have 5 projects out of 5 allowed by your Basic plan. Please upgrade your plan or delete existing projects.",
  "error": "Bad Request"
}
```

---

### 8. GET /api/v1/projects/quota/status
**Get project quota status**

**Success Response (200):**
```json
{
  "currentProjects": 3,
  "maxProjects": 5,
  "remainingProjects": 2,
  "planName": "Basic Plan",
  "isActive": true
}
```

**Error Response (when subscription service unavailable):**
```json
{
  "currentProjects": 0,
  "maxProjects": 0,
  "remainingProjects": 0,
  "planName": "Unknown",
  "isActive": false,
  "error": "Could not retrieve quota information"
}
```

---

## Webhook Endpoint (Stripe → API Gateway)

### 9. POST /api/v1/payments/webhook
**Stripe Webhook Handler (Public endpoint - no auth)**

This endpoint is called by Stripe servers. Frontend does NOT call this directly.

**Headers Required:**
```
stripe-signature: t=1671234567,v1=abc123...
Content-Type: application/json
```

**Response (always 200 to acknowledge receipt):**
```json
{
  "received": true,
  "eventType": "checkout.session.completed"
}
```

---

## Frontend Integration Flow

### One-Time Payment Flow:
```
1. User clicks "Pay Now" → Frontend calls POST /payments/stripe/checkout
2. Frontend receives checkoutUrl → Redirect user to Stripe Checkout
3. User completes payment → Stripe redirects to successUrl
4. Frontend shows success page, optionally fetches order status
```

### Subscription Flow:
```
1. User selects plan → Frontend calls POST /payments/stripe/subscription-checkout
2. Frontend receives checkoutUrl → Redirect user to Stripe Checkout
3. User completes payment → Stripe sends webhook → API Gateway → payment-svc → subscription-svc
4. subscription-svc activates subscription
5. User redirected to successUrl
6. Frontend calls GET /subscriptions/my/status to verify
```

### Creating Project with Quota Check:
```
1. Frontend checks quota first: GET /projects/quota/status
2. If remainingProjects > 0 → Show "Create Project" button
3. If remainingProjects = 0 → Show "Upgrade Plan" button
4. User clicks "Create Project" → POST /projects
5. Backend validates quota again before creating
6. If 402/400 error → Show upgrade modal
```

---

## Error Code Reference

| HTTP Code | Error Type | Description |
|-----------|------------|-------------|
| 400 | Bad Request | Invalid input data or quota exceeded |
| 401 | Unauthorized | Missing or invalid JWT token |
| 402 | Payment Required | No active subscription |
| 403 | Forbidden | Access denied to resource |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server-side error |
