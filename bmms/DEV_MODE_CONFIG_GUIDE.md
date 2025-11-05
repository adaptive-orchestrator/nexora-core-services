# Environment Configuration cho Dev Mode
# Cách config BillingService theo từng business model khi chạy dev

## 🎯 Mục đích
Khi chạy dev mode (không dùng K8s), bạn cần set ENV vars để BillingService tự động chọn strategy đúng.

## 📝 Các ENV Variables

### 1. BILLING_MODE (Bắt buộc)
Quyết định strategy mặc định khi không có metadata từ order/subscription.

**Giá trị:**
- `onetime` - Retail model (one-time purchase)
- `recurring` - Subscription model (monthly/yearly payment)
- `freemium` - Freemium model (free base + paid add-ons)

**Example:**
```bash
# PowerShell
$env:BILLING_MODE="onetime"    # Cho retail
$env:BILLING_MODE="recurring"  # Cho subscription
$env:BILLING_MODE="freemium"   # Cho freemium + add-ons
```

### 2. TAX_RATE (Optional, default: 0.1)
Thuế VAT (10% cho VN).

```bash
$env:TAX_RATE="0.1"  # 10%
```

### 3. BUSINESS_MODEL (Optional)
Override business model cho toàn bộ hệ thống.

```bash
$env:BUSINESS_MODEL="retail"
$env:BUSINESS_MODEL="subscription"
$env:BUSINESS_MODEL="freemium"
$env:BUSINESS_MODEL="multi"  # Hỗ trợ nhiều model
```

---

## 🚀 Cách chạy từng Model trong Dev Mode

### A. RETAIL MODEL (One-time Purchase)

```powershell
# Terminal 1: Set ENV và run BillingService
cd bmms
$env:BILLING_MODE="onetime"
$env:BUSINESS_MODEL="retail"
npm run start:billing:dev

# Terminal 2: Run OrderService
npm run start:order:dev

# Terminal 3: Run InventoryService
npm run start:inventory:dev

# Terminal 4: Test API
curl -X POST http://localhost:3011/orders `
  -H "Content-Type: application/json" `
  -d '{
    "customerId": 1,
    "items": [
      {"productId": 101, "quantity": 2, "unitPrice": 50000}
    ]
  }'
```

**Flow:**
1. OrderService nhận request → tạo order
2. OrderService emit `ORDER_CREATED` event
3. BillingService nghe event → gọi `createWithStrategy(dto, 'retail')`
4. **OnetimeBillingStrategy** tự động được chọn
5. Tính toán: subtotal + tax = total
6. Tạo invoice với `billingMode: 'onetime'`

---

### B. SUBSCRIPTION MODEL (Recurring Payment)

```powershell
# Terminal 1: Set ENV và run BillingService
cd bmms
$env:BILLING_MODE="recurring"
$env:BUSINESS_MODEL="subscription"
npm run start:billing:dev

# Terminal 2: Run SubscriptionService
npm run start:subscription:dev

# Terminal 3: Run PromotionService (optional)
npm run start:promotion:dev

# Terminal 4: Test API
curl -X POST http://localhost:3012/subscriptions `
  -H "Content-Type: application/json" `
  -d '{
    "customerId": 1,
    "planId": 1,
    "billingPeriod": "monthly",
    "price": 199000
  }'
```

**Flow:**
1. SubscriptionService nhận request → tạo subscription
2. SubscriptionService emit `SUBSCRIPTION_CREATED` event
3. BillingService nghe event → gọi `createWithStrategy(dto, 'subscription')`
4. **RecurringBillingStrategy** tự động được chọn
5. Tính toán: plan_price + tax + nextBillingDate
6. Tạo invoice với `billingMode: 'recurring'`

---

### C. FREEMIUM MODEL (Free + Add-ons)

```powershell
# Terminal 1: Set ENV và run BillingService
cd bmms
$env:BILLING_MODE="freemium"
$env:BUSINESS_MODEL="freemium"
npm run start:billing:dev

# Terminal 2: Run SubscriptionService với freemium support
$env:SUPPORT_FREEMIUM="true"
$env:FREE_TIER_ENABLED="true"
npm run start:subscription:dev

# Terminal 3: Test free signup
curl -X POST http://localhost:3012/subscriptions/freemium `
  -H "Content-Type: application/json" `
  -d '{
    "customerId": 1,
    "planId": 0,
    "isFreeTier": true
  }'

# Terminal 4: Test add-on purchase
curl -X POST http://localhost:3012/subscriptions/1/addons `
  -H "Content-Type: application/json" `
  -d '{
    "addons": [
      {"addonId": "extra_storage", "name": "Extra 100GB Storage", "price": 50000},
      {"addonId": "ai_assistant", "name": "AI Assistant", "price": 100000}
    ]
  }'
```

**Flow:**
1. User đăng ký free tier → **KHÔNG TẠO INVOICE** (totalAmount = 0)
2. User mua add-ons → emit `ADDON_PURCHASED` event
3. BillingService nghe event → gọi `createWithStrategy(dto, 'freemium', addons)`
4. **FreemiumBillingStrategy** tự động được chọn
5. Tính toán: base (0) + addon_prices + tax
6. Tạo invoice với `billingMode: 'addon_only'`

---

### D. MULTI-MODEL (Tất cả Models)

```powershell
# Terminal 1: Set ENV cho BillingService
cd bmms
$env:BILLING_MODE="onetime"  # Default, sẽ override bởi metadata
$env:BUSINESS_MODEL="multi"
npm run start:billing:dev

# Terminal 2-5: Run tất cả services
npm run start:order:dev
npm run start:subscription:dev
npm run start:inventory:dev
npm run start:promotion:dev
```

**Trong multi-model:**
- BillingService tự động detect model từ metadata
- Order với `businessModel: 'retail'` → OnetimeBillingStrategy
- Subscription với `businessModel: 'subscription'` → RecurringBillingStrategy
- Freemium add-on → FreemiumBillingStrategy

---

## 🔍 Debug & Troubleshooting

### Check strategy được chọn
BillingService sẽ log ra strategy name:
```
✅ Selected strategy: OnetimeBillingStrategy (from metadata)
✅ Selected strategy: RecurringBillingStrategy (from ENV)
```

### Verify ENV variables
```powershell
# PowerShell
echo $env:BILLING_MODE
echo $env:BUSINESS_MODEL

# Check trong service
curl http://localhost:3003/billing/config
```

### Reset ENV
```powershell
Remove-Item Env:BILLING_MODE
Remove-Item Env:BUSINESS_MODEL
```

---

## 📊 So sánh các Mode

| Model        | BILLING_MODE | Services cần     | Invoice Mode   | NextBillingDate |
|--------------|--------------|------------------|----------------|-----------------|
| Retail       | `onetime`    | Order, Inventory | `onetime`      | null            |
| Subscription | `recurring`  | Subscription     | `recurring`    | +1 month        |
| Freemium     | `freemium`   | Subscription     | `addon_only`   | null            |
| Multi        | (dynamic)    | Tất cả           | (auto-detect)  | (varies)        |

---

## 💡 Best Practices

1. **Luôn set BILLING_MODE** khi chạy dev để tránh fallback strategy
2. **Pass businessModel trong order/subscription metadata** để override ENV
3. **Test từng model riêng** trước khi test multi-model
4. **Check logs** để xác nhận strategy được chọn đúng
5. **Dùng .env file** cho từng service thay vì manual set ENV

---

## 📝 Example .env Files

### `bmms/apps/finance/billing-svc/.env`
```env
# Retail mode
BILLING_MODE=onetime
BUSINESS_MODEL=retail
TAX_RATE=0.1

# OR Subscription mode
# BILLING_MODE=recurring
# BUSINESS_MODEL=subscription

# OR Freemium mode
# BILLING_MODE=freemium
# BUSINESS_MODEL=freemium
```

### `bmms/apps/order/subscription-svc/.env`
```env
# Enable freemium support
SUPPORT_FREEMIUM=true
FREE_TIER_ENABLED=true
```

---

## 🎓 Next: Add-on Implementation
Xem `ADDON_IMPLEMENTATION.md` để hiểu cách implement add-on features trong SubscriptionService.
