start auth-svc api-gateway customer-svc
auth/signup

start catalogue  --- cái này chưa có update
create

start /inventory
create

start order
create

## 🛒 RETAIL MODEL (One-time Purchase)

Order-svc 
  └─ emit order.created 
       └─> Inventory-svc lắng nghe (ORDER_CREATED)
            └─ reserve stock
            └─ emit inventory.reserved
                 └─> Billing-svc lắng nghe (INVENTORY_RESERVED)
                      └─ tạo invoice
                      └─ emit invoice.created

─> Billing-svc lắng nghe (INVENTORY_RESERVED)
                      └─ tạo invoice
                      └─ emit invoice.created ✅
                           └─> Payment-svc lắng nghe (INVOICE_CREATED) ✅
                                └─ register invoice
                                └─ create pending payment
                                └─ emit payment.initiated
                                └─ [TODO: generate VNPay URL]
                                
                                [Customer pays via VNPay or Test API]
                                
                                └─ POST /payments/:id/test/success (giả lập trả tiền) 
                                http://localhost:3013/payments/3/test/success
                                     └─ emit payment.success
                                          └─> Billing-svc lắng nghe
                                               └─ update invoice status = 'paid'

### 🎯 FRONT-END INTEGRATION ✅ COMPLETED

**Checkout Flow (Front-end → Backend):**
```
User adds products to cart
  └─> Cart page (CartContext manages state)
       └─> Click "Proceed to Checkout"
            └─> Checkout page (/checkout)
                 ├─ Fill shipping address (required)
                 ├─ Fill billing address (optional)
                 └─> Click "Place Order"
                      └─> POST /api/orders ✅
                           {
                             customerId: number,
                             items: [{productId, quantity, price}],
                             shippingAddress: string,
                             billingAddress?: string
                           }
                           └─> Order-svc creates order ✅
                                └─> Emit ORDER_CREATED ✅
                                     └─> (Backend auto-processing continues...) ✅
```

**View Orders Flow:**
```
User goes to "My Orders" page
  └─> GET /api/orders/customer/:customerId ✅
       └─> Fetch customer's orders from backend ✅
            └─> Display:
                 ├─ Order number ✅
                 ├─ Status (pending/confirmed/shipped/etc) ✅
                 ├─ Items list ✅
                 ├─ Total amount ✅
                 ├─ Shipping address ✅
                 └─ Created date ✅
```

**Files Updated:**
- `front-end/src/lib/api/orders.ts` ✅
- `front-end/src/pages/Checkout/index.tsx` ✅
- `front-end/src/pages/MyOrders/index.tsx` ✅

**Documentation:**
- `front-end/ORDER_FLOW_GUIDE.md` ✅
- `front-end/ORDER_IMPLEMENTATION_SUMMARY.md` ✅
- `front-end/test-order-flow.ps1` ✅

1. Customer tạo order ✅ (FRONT-END INTEGRATED)
   └─> POST /api/orders (from Checkout page) ✅
        └─> Order-svc emit ORDER_CREATED ✅

2. Inventory-svc nhận ORDER_CREATED ✅
   └─> RESERVE stock (quantityReserved++)
   └─> Emit INVENTORY_RESERVED (cho mỗi item)

3. Billing-svc nhận INVENTORY_RESERVED
   └─> Tạo invoice (status: draft)
   └─> Emit INVOICE_CREATED

4. Payment-svc nhận INVOICE_CREATED
   └─> Tạo payment record (status: initiated)
   └─> Emit PAYMENT_INITIATED

5. Customer trả tiền (qua test endpoint)
   └─> Payment-svc emit PAYMENT_SUCCESS

6. Billing-svc nhận PAYMENT_SUCCESS ✅ NEW!
   └─> Update invoice status → "paid" ✅
   └─> Emit ORDER_COMPLETED ✅

7. Inventory-svc nhận ORDER_COMPLETED ✅ NEW!
   └─> Convert reservation → actual deduction ✅
   └─> quantityAvailable -= quantity ✅
   └─> quantityReserved -= quantity ✅

---

## 💎 SUBSCRIPTION MODEL (SaaS - Recurring Billing)

### Mục tiêu:
- Khách hàng đăng ký gói thuê bao (plan) và thanh toán định kỳ
- Hỗ trợ trial period (dùng thử miễn phí)
- Tự động tạo hóa đơn và xử lý thanh toán theo chu kỳ
- Hỗ trợ upgrade/downgrade plan

### Microservices sử dụng:
- **customer-svc**: Quản lý thông tin khách hàng
- **catalogue-svc**: Quản lý plans (gói thuê bao) và features
- **subscription-svc**: Quản lý vòng đời subscription
- **billing-svc**: Tạo hóa đơn định kỳ (recurring invoices)
- **payment-svc**: Xử lý thanh toán
- **promotion-svc**: Quản lý trial và discount codes (optional)

### Flow 1: Customer đăng ký subscription (với trial)

```
1. Customer chọn plan và đăng ký✅
   POST /api/v1/subscriptions
   {
     "customerId": 1,
     "planId": 2,
     "useTrial": true
   }
   
   └─> Subscription-svc
        └─> Validate customer exists (gRPC → customer-svc)
        └─> Validate plan exists (gRPC → catalogue-svc)
        └─> Create subscription (status: 'trial')
        └─> Emit SUBSCRIPTION_CREATED
        └─> Emit SUBSCRIPTION_TRIAL_STARTED

2. Billing-svc lắng nghe SUBSCRIPTION_CREATED✅
   └─> Check subscription status
   └─> If status = 'trial': Skip invoice creation (trial miễn phí)
   └─> If status = 'active': Create first recurring invoice
   └─> Emit INVOICE_CREATED (nếu không phải trial)

3. Payment-svc lắng nghe INVOICE_CREATED✅
   └─> Create payment record         oke✅
   └─> Emit PAYMENT_INITIATED ✅
   └─> Return payment URL to customer
   └─> Generate VNPay payment URL ❌ (chưa có)
   └─> Return URL to customer ❌ (chưa có)

4. (Sau X ngày trial) Scheduler kiểm tra trial ending
   └─> Subscription-svc emit SUBSCRIPTION_TRIAL_ENDING (3 days before)
   └─> Send notification to customer
   
5. Trial period kết thúc
   └─> Subscription-svc update status: 'trial' → 'active'
   └─> Emit SUBSCRIPTION_TRIAL_ENDED (convertedToActive: true)
   
   └─> Billing-svc lắng nghe SUBSCRIPTION_TRIAL_ENDED
        └─> Create first recurring invoice
        └─> Emit INVOICE_CREATED
        
   └─> Payment-svc process payment automatically
        └─> If payment succeeds: emit PAYMENT_SUCCESS
        └─> If payment fails: emit PAYMENT_FAILED

6. Billing-svc lắng nghe PAYMENT_SUCCESS✅
   └─> Update invoice status → 'paid'
   └─> Subscription continues (active)

7. Subscription-svc lắng nghe PAYMENT_FAILED✅
   └─> Update subscription status → 'past_due'
   └─> Send notification to customer
   └─> Retry payment after X days
```

### Flow 2: Customer đăng ký subscription (không có trial)

```
1. Customer chọn plan và đăng ký✅
   POST /api/v1/subscriptions
   {
     "customerId": 1,
     "planId": 2,
     "useTrial": false
   }
   
   └─> Subscription-svc
        └─> Create subscription (status: 'active')
        └─> Emit SUBSCRIPTION_CREATED

2. Billing-svc lắng nghe SUBSCRIPTION_CREATED✅
   └─> Create first recurring invoice
        {
          "subscriptionId": 5,
          "invoiceType": "recurring",
          "amount": 299000,
          "periodStart": "2025-10-26",
          "periodEnd": "2025-11-26",
          "dueDate": "2025-11-02"
        }
   └─> Emit INVOICE_CREATED

3. Payment-svc lắng nghe INVOICE_CREATED✅
   └─> Create payment record
   └─> Emit PAYMENT_INITIATED
   └─> Process payment ✅

4. Customer trả tiền✅
   └─> Payment-svc emit PAYMENT_SUCCESS
   └─> Billing-svc update invoice status → 'paid'
   └─> Subscription active ✅
```

### Flow 3: Recurring billing (Gia hạn tự động)

```
1. Scheduler (rl-scheduler hoặc cron job) chạy mỗi ngày
   └─> Call Subscription-svc.findSubscriptionsToRenew()
   └─> Find subscriptions with currentPeriodEnd <= 3 days from now
   
2. Subscription-svc renew subscription
   └─> Update currentPeriodStart & currentPeriodEnd
   └─> Emit SUBSCRIPTION_RENEWED
        {
          "subscriptionId": 5,
          "customerId": 1,
          "planId": 2,
          "previousPeriodEnd": "2025-11-26",
          "currentPeriodStart": "2025-11-26",
          "currentPeriodEnd": "2025-12-26",
          "amount": 299000
        }

3. Billing-svc lắng nghe SUBSCRIPTION_RENEWED
   └─> Create new recurring invoice for next period
   └─> Emit INVOICE_CREATED

4. Payment-svc auto-process payment
   └─> If PAYMENT_SUCCESS: Invoice paid, subscription continues
   └─> If PAYMENT_FAILED: Subscription → 'past_due', retry later
```

### Flow 4: Customer cancel subscription

```
1. Customer cancel subscription
   POST /api/v1/subscriptions/:id/cancel
   {
     "reason": "Too expensive",
     "cancelAtPeriodEnd": true  // or false for immediate
   }
   
   └─> Subscription-svc
        └─> If cancelAtPeriodEnd = true:
             └─> Set cancelAtPeriodEnd = true
             └─> Subscription remains active until currentPeriodEnd
        └─> If cancelAtPeriodEnd = false:
             └─> Update status → 'cancelled' immediately
        └─> Emit SUBSCRIPTION_CANCELLED

2. Billing-svc lắng nghe SUBSCRIPTION_CANCELLED
   └─> Stop creating new invoices for this subscription
   └─> Process any outstanding invoices

3. At period end (if cancelAtPeriodEnd = true)
   └─> Subscription-svc update status → 'expired'
   └─> Emit SUBSCRIPTION_EXPIRED
```

### Flow 5: Customer change plan (upgrade/downgrade)

```
1. Customer change plan
   POST /api/v1/subscriptions/:id/change-plan
   {
     "newPlanId": 3,
     "immediate": true  // or false for end of period
   }
   
   └─> Subscription-svc
        └─> Validate new plan exists
        └─> If immediate = true:
             └─> Update planId, amount
             └─> Reset billing period (prorate if needed)
        └─> If immediate = false:
             └─> Schedule plan change for end of current period
        └─> Emit SUBSCRIPTION_PLAN_CHANGED

2. Billing-svc lắng nghe SUBSCRIPTION_PLAN_CHANGED
   └─> If immediate: Create new invoice with prorated amount
   └─> If not immediate: Next renewal will use new plan
```

### API Endpoints:

**Catalogue Service:**
- `POST /api/v1/plans` - Create plan
- `GET /api/v1/plans` - List all plans
- `GET /api/v1/plans/:id` - Get plan details

**Subscription Service:**
- `POST /api/v1/subscriptions` - Create subscription
- `GET /api/v1/subscriptions/customer/:customerId` - List customer subscriptions
- `GET /api/v1/subscriptions/:id` - Get subscription details
- `POST /api/v1/subscriptions/:id/cancel` - Cancel subscription
- `POST /api/v1/subscriptions/:id/change-plan` - Change plan

**Billing Service:**
- `GET /api/v1/invoices` - List invoices
- `GET /api/v1/invoices/subscription/:subscriptionId` - List subscription invoices
- `GET /api/v1/invoices/:id` - Get invoice details

**Payment Service:**
- `POST /api/v1/payments/:id/test/success` - Test payment success
- `POST /api/v1/payments/:id/test/fail` - Test payment failure

### Events:

**Subscription Events:**
- `subscription.created` - Subscription được tạo ✅
- `subscription.renewed` - Subscription được gia hạn
- `subscription.cancelled` - Subscription bị hủy
- `subscription.expired` - Subscription hết hạn
- `subscription.trial.started` - Trial period bắt đầu✅
- `subscription.trial.ending` - Trial sắp kết thúc (3 days warning)
- `subscription.trial.ended` - Trial period kết thúc
- `subscription.plan.changed` - Đổi plan
- `subscription.updated` - Subscription được cập nhật

**Invoice Events:**
- `invoice.created` - Invoice được tạo (onetime hoặc recurring) ✅
- `invoice.updated` - Invoice được cập nhật ✅
- `invoice.overdue` - Invoice quá hạn

**Payment Events:**
- `payment.initiated` - Payment được khởi tạo ✅
- `payment.success` - Payment thành công✅
- `payment.failed` - Payment thất bại✅
- `payment.retry` - Retry payment
- `payment.refunded` - Payment được hoàn tiền

### Database Tables:

**subscriptions:**
- id, customerId, planId, planName
- amount, billingCycle (monthly/yearly)
- status (trial/active/past_due/cancelled/expired)
- currentPeriodStart, currentPeriodEnd
- isTrialUsed, trialStart, trialEnd
- cancelAtPeriodEnd, cancelledAt, cancellationReason
- metadata (JSON)
- createdAt, updatedAt

**subscription_history:**
- id, subscriptionId
- action (created/renewed/cancelled/status_changed/plan_changed)
- previousStatus, newStatus
- previousPlanId, newPlanId
- details, metadata
- createdAt

**invoices:**
- id, invoiceNumber
- orderId (nullable), orderNumber (nullable)
- subscriptionId (nullable)
- invoiceType (onetime/recurring) ⭐ NEW
- customerId
- status, subtotal, tax, discount, totalAmount
- dueAmount, paidAmount, dueDate
- periodStart (nullable), periodEnd (nullable) ⭐ NEW
- notes, createdAt, updatedAt

**plans:**
- id, name, description
- price, billingCycle (monthly/yearly)
- trialEnabled, trialDays ⭐ NEW
- createdAt, updatedAt
