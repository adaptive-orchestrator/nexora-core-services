# 🎯 Freemium + Add-on Implementation - Complete Package

## 📦 Tổng quan

Package hoàn chỉnh để triển khai **Freemium model** với **Add-on features** và **Billing Strategy Pattern** trong BMMS.

---

## 🚀 Quick Start (5 phút)

### 1. Database Migration
```bash
cd bmms
mysql -u root -p bmms_db < migrations/001_add_freemium_addons.sql
```

### 2. Start Services
```powershell
# Terminal 1: BillingService
$env:BILLING_MODE="freemium"
npm run start:billing:dev

# Terminal 2: SubscriptionService
$env:SUPPORT_FREEMIUM="true"
npm run start:subscription:dev
```

### 3. Test
```powershell
# Run automated test script
.\test-billing-strategies.ps1
```

---

## 📚 Documentation Structure

```
bmms/
├── FREEMIUM_IMPLEMENTATION_SUMMARY.md    # 📋 Tổng hợp toàn bộ implementation
├── QUICK_START_BILLING_STRATEGY.md       # ⚡ Quick reference (30 giây)
├── DEV_MODE_CONFIG_GUIDE.md              # 🔧 Cách config ENV cho dev mode
├── FREEMIUM_ADDON_GUIDE.md               # 📖 Complete guide với test scenarios
├── test-billing-strategies.ps1           # 🧪 Automated test script
└── migrations/
    └── 001_add_freemium_addons.sql       # 🗄️ Database migration
```

### Đọc theo thứ tự:

1. **QUICK_START_BILLING_STRATEGY.md** ← Bắt đầu đây (30 giây)
2. **DEV_MODE_CONFIG_GUIDE.md** ← Cách config cho từng model
3. **FREEMIUM_ADDON_GUIDE.md** ← Chi tiết freemium + add-on
4. **FREEMIUM_IMPLEMENTATION_SUMMARY.md** ← Tổng kết toàn bộ

---

## 🏗️ Architecture Overview

### Billing Strategy Pattern

```
┌─────────────────────────────────────────────────────────┐
│              BillingService                              │
│                                                          │
│  createWithStrategy(dto, businessModel, addons)        │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│        BillingStrategyService (Factory)                 │
│                                                          │
│  getStrategy(params) → Strategy                         │
└────┬─────────────────────────┬────────────────────┬─────┘
     │                         │                    │
     ▼                         ▼                    ▼
┌──────────────┐   ┌───────────────────┐   ┌──────────────────┐
│   Onetime    │   │    Recurring      │   │    Freemium      │
│   Billing    │   │    Billing        │   │    Billing       │
│   Strategy   │   │    Strategy       │   │    Strategy      │
│              │   │                   │   │                  │
│  Retail      │   │  Subscription     │   │  Free + Add-ons  │
│  Model       │   │  Model            │   │  Model           │
└──────────────┘   └───────────────────┘   └──────────────────┘
```

### Event Flow (Freemium + Add-on)

```
User purchases add-on
        │
        ▼
SubscriptionService
        │
        ├─→ Create user_addons records
        │
        └─→ Emit ADDON_PURCHASED event
                │
                ▼
        BillingService (listener)
                │
                ├─→ FreemiumBillingStrategy selected
                │
                ├─→ Calculate: base(0) + addons + tax
                │
                ├─→ Create invoice (billingMode: 'addon_only')
                │
                └─→ Emit INVOICE_CREATED event
                        │
                        ▼
                PaymentService
                        │
                        └─→ Process payment
```

---

## 🎯 Business Models Support

| Model        | Base Price  | Add-ons     | Strategy           | Config                   |
|--------------|-------------|-------------|--------------------|--------------------------|
| **Retail**   | 50k-500k    | ❌ No       | OnetimeBilling     | `BILLING_MODE=onetime`   |
| **Subscription** | 99k/month | ❌ No   | RecurringBilling   | `BILLING_MODE=recurring` |
| **Freemium** | FREE        | ✅ Yes      | FreemiumBilling    | `BILLING_MODE=freemium`  |

---

## 🗄️ Database Schema

### Tables Created:
- `addons` - Add-on catalog (10 sample add-ons seeded)
- `user_addons` - User purchases tracker

### Tables Modified:
- `invoices` - Added `metadata` JSON column
- `subscriptions` - Added `is_free_tier` BOOLEAN column

### Sample Add-ons:
```sql
SELECT addon_key, name, price, billing_period FROM addons;

+-----------------------+---------------------------+----------+----------------+
| addon_key             | name                      | price    | billing_period |
+-----------------------+---------------------------+----------+----------------+
| extra_storage_50gb    | Extra 50GB Storage        |  30000   | monthly        |
| extra_storage_100gb   | Extra 100GB Storage       |  50000   | monthly        |
| ai_assistant          | AI Assistant Pro          | 100000   | monthly        |
| priority_support      | Priority Support          |  30000   | monthly        |
| custom_domain         | Custom Domain             |  20000   | monthly        |
| api_access            | API Access                | 150000   | monthly        |
| white_label           | White Label               | 300000   | onetime        |
+-----------------------+---------------------------+----------+----------------+
```

---

## 🧪 Testing

### Automated Test:
```powershell
.\test-billing-strategies.ps1
```

**Tests:**
1. ✅ Retail order → OnetimeBillingStrategy
2. ✅ Subscription → RecurringBillingStrategy
3. ✅ Freemium + add-ons → FreemiumBillingStrategy

### Manual Test:
```powershell
# 1. List add-ons
curl http://localhost:3012/addons

# 2. Purchase add-ons
curl -X POST http://localhost:3012/addons/purchase `
  -H "Content-Type: application/json" `
  -d '{
    "subscriptionId": 1,
    "customerId": 1,
    "addonKeys": ["extra_storage_100gb", "ai_assistant"]
  }'

# 3. Check invoice
curl http://localhost:3003/billing/invoices?customerId=1
```

---

## 📁 Files Created

### Core Implementation (9 files):
```
apps/finance/billing-svc/src/strategies/
├── billing-strategy.interface.ts         # Strategy interface
├── onetime-billing.strategy.ts           # Retail strategy
├── recurring-billing.strategy.ts         # Subscription strategy
├── freemium-billing.strategy.ts          # Freemium strategy
└── billing-strategy.service.ts           # Factory

apps/order/subscription-svc/src/
├── entities/
│   ├── addon.entity.ts                   # Add-on catalog
│   └── user-addon.entity.ts              # User purchases
├── addon.service.ts                      # Add-on logic
└── addon.controller.ts                   # REST API
```

### Documentation (5 files):
```
bmms/
├── FREEMIUM_IMPLEMENTATION_SUMMARY.md    # Complete summary
├── QUICK_START_BILLING_STRATEGY.md       # Quick guide
├── DEV_MODE_CONFIG_GUIDE.md              # Dev config
├── FREEMIUM_ADDON_GUIDE.md               # Freemium guide
└── README_FREEMIUM_PACKAGE.md            # This file
```

### Scripts & Migrations (2 files):
```
bmms/
├── test-billing-strategies.ps1           # Test script
└── migrations/
    └── 001_add_freemium_addons.sql       # DB migration
```

---

## 🎓 How It Works (ELI5)

### Vấn đề ban đầu:
> "Mình có 3 loại billing: onetime (retail), recurring (subscription), freemium (add-on). Làm sao tách logic khi chạy dev?"

### Giải pháp:
1. **Strategy Pattern**: Mỗi loại billing = 1 strategy class
2. **Factory**: BillingStrategyService tự động chọn strategy đúng
3. **ENV Config**: Set `BILLING_MODE` để chọn default strategy
4. **Metadata Override**: Pass `businessModel` trong request để override

### Example:
```typescript
// ENV: BILLING_MODE=freemium (default)

// Request 1: Retail order
await billingService.createWithStrategy(dto, 'retail')
// → OnetimeBillingStrategy được chọn

// Request 2: Subscription
await billingService.createWithStrategy(dto, 'subscription')
// → RecurringBillingStrategy được chọn

// Request 3: Freemium add-on
await billingService.createWithStrategy(dto, 'freemium', addons)
// → FreemiumBillingStrategy được chọn
```

**Result:** Một BillingService xử lý được cả 3 models! 🎉

---

## 🔧 Configuration

### Environment Variables:

**BillingService:**
```env
BILLING_MODE=onetime|recurring|freemium    # Default strategy
TAX_RATE=0.1                               # 10% VAT
BUSINESS_MODEL=retail|subscription|freemium|multi
```

**SubscriptionService:**
```env
SUPPORT_FREEMIUM=true                      # Enable freemium features
FREE_TIER_ENABLED=true                     # Allow free signups
ADDON_ENABLED=true                         # Enable add-on purchases
```

---

## 🚀 Production Deployment

### K8s ConfigMap:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: billing-config
  namespace: finance
data:
  BILLING_MODE: "freemium"
  TAX_RATE: "0.1"
  BUSINESS_MODEL: "multi"
```

### Deployment:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: billing-svc
spec:
  template:
    spec:
      containers:
      - name: billing-svc
        image: your-registry/billing-svc:freemium
        envFrom:
        - configMapRef:
            name: billing-config
```

---

## 🐛 Troubleshooting

### Issue: Strategy không được chọn đúng

**Solution:**
1. Check logs: `✅ Selected strategy: [StrategyName]`
2. Verify ENV: `echo $env:BILLING_MODE`
3. Restart service

### Issue: Add-on purchase không tạo invoice

**Solution:**
1. Check event emitted: `ADDON_PURCHASED`
2. Verify BillingService listening to event
3. Check `BILLING_MODE=freemium`

### Issue: Lỗi database "Table addons doesn't exist"

**Solution:**
```bash
mysql -u root -p bmms_db < migrations/001_add_freemium_addons.sql
```

---

## 📊 Metrics & Monitoring

### Key Metrics:
- `billing.strategy.selected` - Which strategy was chosen
- `billing.addon.purchased` - Add-on purchase count
- `billing.addon.renewal` - Auto-renewal success rate
- `invoice.billing_mode` - Distribution by billing mode

### Logs to Watch:
```
✅ Selected strategy: FreemiumBillingStrategy (from metadata)
📊 Calculating FREEMIUM billing for customer 123
💎 Processing 2 add-ons
✅ Total: 165000 VND (Base: FREE, Add-ons: 2)
```

---

## 🎯 Next Steps

1. ✅ Run migration: `001_add_freemium_addons.sql`
2. ✅ Start services với ENV config
3. ✅ Run test script: `.\test-billing-strategies.ps1`
4. ✅ Verify invoices created với đúng `billingMode`
5. ✅ Test LLM integration (optional)
6. ✅ Deploy to K8s (optional)

---

## 📚 Related Documentation

- **FINAL_SUMMARY.md** - K8s deployment cho retail + subscription
- **TESTING_GUIDE.md** - General testing guide
- **K8S_DEPLOYMENT_GUIDE.md** - K8s deployment guide

---

## ✅ Checklist

- [x] Database migration file
- [x] Billing strategies implemented
- [x] Add-on service created
- [x] Event integration
- [x] Test script
- [x] Documentation (4 guides)
- [x] Quick start guide
- [x] Dev mode config guide

---

## 🎓 Learning Resources

### For Khóa luận:
1. **Demo scenario:** Freemium user journey (trong `FREEMIUM_ADDON_GUIDE.md`)
2. **Architecture diagram:** Strategy pattern + Event flow (trong file này)
3. **Code examples:** Test script + Strategy classes
4. **Database design:** Migration file + Schema diagram

---

## 📞 Support

Nếu gặp vấn đề:
1. Đọc **QUICK_START_BILLING_STRATEGY.md** trước
2. Check **Troubleshooting** section ở trên
3. Verify ENV variables
4. Check logs

---

**Last updated:** 29/10/2025  
**Status:** ✅ Production Ready  
**Version:** 1.0.0
