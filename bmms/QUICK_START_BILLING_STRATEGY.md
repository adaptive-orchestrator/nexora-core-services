# 🚀 Quick Start: Billing Strategy Pattern

## Vấn đề bạn gặp
> "Mình không biết cách tách BillingService theo model (onetime/recurring) khi chạy dev"

## Giải pháp
✅ **Strategy Pattern** - BillingService tự động chọn logic đúng dựa trên ENV hoặc metadata

---

## 1️⃣ Cách hoạt động (30 giây)

```typescript
// BillingService nhận request
await billingService.createWithStrategy(dto, 'retail')
                                            ↓
// BillingStrategyService chọn strategy tự động
                                            ↓
          ┌─────────────────────────────────┴─────────────────────┐
          │                                                         │
    'retail' model?              'subscription' model?      'freemium' model?
          │                                  │                      │
  OnetimeBillingStrategy          RecurringBillingStrategy   FreemiumBillingStrategy
          │                                  │                      │
    subtotal + tax              plan + tax + nextBillingDate  base(0) + addons + tax
          │                                  │                      │
          └──────────────────────────────────┴──────────────────────┘
                                            ↓
                            Invoice created với billingMode đúng
```

---

## 2️⃣ Config trong Dev Mode (2 phút)

### Retail Model:
```powershell
$env:BILLING_MODE="onetime"
npm run start:billing:dev
```

### Subscription Model:
```powershell
$env:BILLING_MODE="recurring"
npm run start:billing:dev
```

### Freemium Model:
```powershell
$env:BILLING_MODE="freemium"
npm run start:billing:dev
```

**That's it!** BillingService sẽ tự động chọn strategy đúng.

---

## 3️⃣ Test nhanh (5 phút)

### Test Retail:
```powershell
# Terminal 1
$env:BILLING_MODE="onetime"
npm run start:billing:dev

# Terminal 2
curl -X POST http://localhost:3011/orders `
  -H "Content-Type: application/json" `
  -d '{"customerId": 1, "items": [{"productId": 1, "quantity": 2, "unitPrice": 50000}]}'

# Check logs → Should see:
# ✅ Selected strategy: OnetimeBillingStrategy
# 📊 billingMode: 'onetime'
```

### Test Subscription:
```powershell
# Terminal 1
$env:BILLING_MODE="recurring"
npm run start:billing:dev

# Terminal 2
curl -X POST http://localhost:3012/subscriptions `
  -H "Content-Type: application/json" `
  -d '{"customerId": 1, "planId": 1, "price": 199000}'

# Check logs → Should see:
# ✅ Selected strategy: RecurringBillingStrategy
# 📊 billingMode: 'recurring', nextBillingDate: (next month)
```

### Test Freemium:
```powershell
# Terminal 1
$env:BILLING_MODE="freemium"
npm run start:billing:dev

# Terminal 2: Purchase add-ons
curl -X POST http://localhost:3012/addons/purchase `
  -H "Content-Type: application/json" `
  -d '{"subscriptionId": 1, "customerId": 1, "addonKeys": ["extra_storage"]}'

# Check logs → Should see:
# ✅ Selected strategy: FreemiumBillingStrategy
# 📊 billingMode: 'addon_only', base: 0, addons: 50000
```

---

## 4️⃣ Debug (nếu có lỗi)

### Kiểm tra strategy được chọn:
```
# Tìm dòng này trong logs:
✅ Selected strategy: [StrategyName] (from ENV|metadata)
```

### Nếu strategy sai:
1. Check ENV: `echo $env:BILLING_MODE`
2. Restart service: `Ctrl+C` và chạy lại
3. Verify metadata trong request có `businessModel` field

---

## 5️⃣ Files quan trọng

```
bmms/apps/finance/billing-svc/src/
├── strategies/
│   ├── billing-strategy.service.ts      # 👈 Factory chọn strategy
│   ├── onetime-billing.strategy.ts      # Retail logic
│   ├── recurring-billing.strategy.ts    # Subscription logic
│   └── freemium-billing.strategy.ts     # Freemium logic
└── billing-svc.service.ts               # 👈 Gọi createWithStrategy()
```

---

## 6️⃣ Cheat Sheet

| Model        | ENV Variable               | Strategy               | Billing Mode   |
|--------------|----------------------------|------------------------|----------------|
| Retail       | `BILLING_MODE=onetime`     | OnetimeBilling         | `onetime`      |
| Subscription | `BILLING_MODE=recurring`   | RecurringBilling       | `recurring`    |
| Freemium     | `BILLING_MODE=freemium`    | FreemiumBilling        | `addon_only`   |

---

## 7️⃣ Đọc thêm

- **Full guide:** `DEV_MODE_CONFIG_GUIDE.md`
- **Freemium details:** `FREEMIUM_ADDON_GUIDE.md`
- **Summary:** `FREEMIUM_IMPLEMENTATION_SUMMARY.md`

---

## ❓ FAQ

**Q: Tôi muốn test cả 3 model cùng lúc?**  
A: Set `BILLING_MODE=onetime` (default), nhưng pass `businessModel` trong metadata của từng request:
```typescript
// Retail order
{ ..., metadata: { businessModel: 'retail' } }

// Subscription
{ ..., metadata: { businessModel: 'subscription' } }

// Freemium
{ ..., metadata: { businessModel: 'freemium' } }
```

**Q: Strategy tự động chọn dựa trên gì?**  
A: Priority:
1. `metadata.businessModel` (từ request/event)
2. ENV var `BILLING_MODE`
3. Default: onetime

**Q: Làm sao thêm model mới?**  
A: 
1. Tạo `NewBillingStrategy.ts` implement `IBillingStrategy`
2. Register trong `billing-svc.module.ts`
3. Add vào `BillingStrategyService.strategies` array
4. Done!

---

**TL;DR:**  
Set `$env:BILLING_MODE="onetime|recurring|freemium"` và strategy sẽ tự động được chọn. Easy! 🎉
