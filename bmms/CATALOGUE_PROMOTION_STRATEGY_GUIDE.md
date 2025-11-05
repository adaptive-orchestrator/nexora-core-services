# Catalogue & Promotion Strategy Pattern Guide

## 📚 Overview

This guide explains how **CatalogueService** and **PromotionService** dynamically adapt behavior based on business models (Retail, Subscription, Freemium) using the **Strategy Pattern**.

---

## 🎯 Quick Summary

| Service | Purpose | Strategies |
|---------|---------|-----------|
| **CatalogueService** | Display different items per model | Retail, Subscription, Freemium |
| **PromotionService** | Validate & apply promotions per model | Retail, Subscription, Freemium |

---

## 📦 1. Catalogue Strategy Pattern

### Architecture

```
catalogue-svc/
├── strategies/
│   ├── catalogue-strategy.interface.ts  ✅ Interface
│   ├── retail-catalogue.strategy.ts     ✅ Retail products
│   ├── subscription-catalogue.strategy.ts ✅ Plans
│   ├── freemium-catalogue.strategy.ts   ✅ Free + add-ons
│   └── catalogue-strategy.service.ts    ✅ Factory
```

### Configuration

#### Dev Mode (ENV-based)
```bash
# .env
CATALOGUE_MODE=retail        # Show products only
CATALOGUE_MODE=subscription  # Show plans only
CATALOGUE_MODE=freemium      # Show free plans + add-ons
```

#### Usage in Code

**Option 1: ENV Mode (Dev)**
```typescript
// Auto-selects based on CATALOGUE_MODE
const items = await catalogueService.getItemsByEnv();
```

**Option 2: Explicit Model (Production)**
```typescript
// For a specific user's model
const items = await catalogueService.getItemsByModel('subscription');
```

---

### Strategies Explained

#### 1️⃣ RetailCatalogueStrategy
**Displays:** Physical/digital products for one-time purchase

```typescript
// Returns all active retail products
async getDisplayItems(): Promise<CatalogueItem[]> {
  const products = await productRepo.find({ 
    where: { isActive: true } 
  });
  
  return products.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    itemType: 'product',
  }));
}
```

**Example Response:**
```json
[
  { "id": 1, "name": "Premium Keyboard", "price": 1200000, "itemType": "product" },
  { "id": 2, "name": "Gaming Mouse", "price": 600000, "itemType": "product" }
]
```

---

#### 2️⃣ SubscriptionCatalogueStrategy
**Displays:** Recurring subscription plans (monthly/yearly)

```typescript
// Returns all active subscription plans
async getDisplayItems(): Promise<CatalogueItem[]> {
  const plans = await planRepo.find({ 
    where: { isActive: true } 
  });
  
  return plans.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    itemType: 'subscription_plan',
    metadata: {
      billingCycle: p.billingCycle,
      trialDays: p.trialDays,
    },
  }));
}
```

**Example Response:**
```json
[
  { 
    "id": 1, 
    "name": "Pro Monthly", 
    "price": 99000, 
    "itemType": "subscription_plan",
    "metadata": { "billingCycle": "monthly", "trialDays": 7 }
  }
]
```

---

#### 3️⃣ FreemiumCatalogueStrategy
**Displays:** Free base plan + purchasable add-ons

```typescript
async getDisplayItems(): Promise<CatalogueItem[]> {
  const freePlans = await planRepo.find({ 
    where: { price: 0, isActive: true } 
  });
  
  const addons = await addonRepo.find({ 
    where: { isActive: true } 
  });
  
  return [
    ...freePlans.map(p => ({ itemType: 'free_plan', ... })),
    ...addons.map(a => ({ itemType: 'addon', ... })),
  ];
}
```

**Example Response:**
```json
[
  { "id": 1, "name": "Free Plan", "price": 0, "itemType": "free_plan" },
  { "id": 101, "name": "Extra Storage 10GB", "price": 50000, "itemType": "addon" },
  { "id": 102, "name": "Priority Support", "price": 100000, "itemType": "addon" }
]
```

---

## 🎟️ 2. Promotion Strategy Pattern

### Architecture

```
promotion-svc/
├── strategies/
│   ├── promotion-strategy.interface.ts  ✅ Interface
│   ├── retail-promotion.strategy.ts     ✅ Discount codes, BOGO
│   ├── subscription-promotion.strategy.ts ✅ Trial extension, first-month discount
│   ├── freemium-promotion.strategy.ts   ✅ Add-on bundles
│   └── promotion-strategy.service.ts    ✅ Factory
```

### Configuration

#### Dev Mode (ENV-based)
```bash
# .env
PROMOTION_MODE=retail        # Retail discount rules
PROMOTION_MODE=subscription  # Trial/subscription rules
PROMOTION_MODE=freemium      # Add-on bundle rules
```

#### Usage in Code

**Option 1: ENV Mode (Dev)**
```typescript
const result = await promotionService.validatePromotionByEnv({
  promotionCode: 'SAVE20',
  userId: 123,
});
```

**Option 2: Explicit Model (Production)**
```typescript
const result = await promotionService.validatePromotionByModel('subscription', {
  promotionCode: 'TRIAL14',
  subscriptionPlanId: 3,
});
```

---

### Strategies Explained

#### 1️⃣ RetailPromotionStrategy
**Handles:** Percentage, fixed amount, BOGO discounts

```typescript
async validatePromotion(params) {
  // Check promotion exists and is active
  // Calculate discount based on type
  
  if (promotion.type === 'percentage') {
    discountAmount = (orderAmount * promotion.discountValue) / 100;
  } else if (promotion.type === 'fixed_amount') {
    discountAmount = promotion.discountValue;
  } else if (promotion.type === 'bogo') {
    // Buy One Get One logic
  }
}
```

**Example:**
```bash
POST /promotions/validate
{
  "promotionCode": "SAVE20",
  "orderAmount": 1000000
}

# Response:
{
  "isValid": true,
  "discountAmount": 200000,
  "discountType": "percentage"
}
```

---

#### 2️⃣ SubscriptionPromotionStrategy
**Handles:** Free trial extension, first-month discount, annual discount

```typescript
async validatePromotion(params) {
  if (promotion.type === 'trial_extension') {
    // Extend trial from 7 → 14 days
    return { trialExtensionDays: 7 };
  }
  
  if (promotion.type === 'percentage') {
    // 50% OFF first month
    discountAmount = (planPrice * promotionValue) / 100;
  }
  
  if (promotion.type === 'free_months') {
    // 2 months FREE on annual plan
    return { freeMonths: 2 };
  }
}
```

**Example:**
```bash
POST /promotions/validate
{
  "promotionCode": "TRIAL14",
  "subscriptionPlanId": 3
}

# Response:
{
  "isValid": true,
  "discountType": "free_trial",
  "metadata": {
    "trialExtensionDays": 7
  }
}
```

---

#### 3️⃣ FreemiumPromotionStrategy
**Handles:** Add-on bundles, upgrade discounts

```typescript
async validatePromotion(params) {
  // Check minimum add-ons for bundle
  if (params.addonIds.length < promotion.minItemsRequired) {
    return { isValid: false, reason: 'Requires 2+ add-ons' };
  }
  
  // Bundle discount (Buy 2 add-ons, get 20% OFF)
  if (promotion.type === 'bundle') {
    discountAmount = (totalAddonPrice * 20) / 100;
  }
}
```

**Example:**
```bash
POST /promotions/validate
{
  "promotionCode": "BUNDLE20",
  "addonIds": [101, 102]
}

# Response:
{
  "isValid": true,
  "discountAmount": 30000,
  "discountType": "bundle"
}
```

---

## 🚀 Testing Guide

### 1. Test Catalogue Strategies

```bash
# Test Retail Catalogue
export CATALOGUE_MODE=retail
curl http://localhost:3004/api/catalogue/items

# Test Subscription Catalogue
export CATALOGUE_MODE=subscription
curl http://localhost:3004/api/catalogue/items

# Test Freemium Catalogue
export CATALOGUE_MODE=freemium
curl http://localhost:3004/api/catalogue/items
```

### 2. Test Promotion Strategies

```bash
# Test Retail Promotions
export PROMOTION_MODE=retail
curl -X POST http://localhost:3005/api/promotions/validate \
  -H "Content-Type: application/json" \
  -d '{"promotionCode":"SAVE20","orderAmount":1000000}'

# Test Subscription Promotions
export PROMOTION_MODE=subscription
curl -X POST http://localhost:3005/api/promotions/validate \
  -H "Content-Type: application/json" \
  -d '{"promotionCode":"TRIAL14","subscriptionPlanId":3}'

# Test Freemium Promotions
export PROMOTION_MODE=freemium
curl -X POST http://localhost:3005/api/promotions/validate \
  -H "Content-Type: application/json" \
  -d '{"promotionCode":"BUNDLE20","addonIds":[101,102]}'
```

---

## 🔧 Integration Examples

### Frontend Integration

```typescript
// 1. Fetch catalogue based on user's business model
const fetchCatalogue = async (userModel: string) => {
  const response = await fetch(`/api/catalogue/items?model=${userModel}`);
  return response.json();
};

// Usage:
const retailProducts = await fetchCatalogue('retail');
const subscriptionPlans = await fetchCatalogue('subscription');
const freemiumItems = await fetchCatalogue('freemium');
```

### Checkout Flow Integration

```typescript
// 2. Validate promotion before checkout
const validatePromotion = async (code: string, model: string, context: any) => {
  const response = await fetch('/api/promotions/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promotionCode: code,
      businessModel: model,
      ...context, // orderAmount, subscriptionPlanId, or addonIds
    }),
  });
  
  return response.json();
};

// Usage in checkout:
if (promoCode) {
  const result = await validatePromotion(promoCode, userModel, {
    orderAmount: cartTotal,
    subscriptionPlanId: selectedPlan?.id,
    addonIds: selectedAddons.map(a => a.id),
  });
  
  if (result.isValid) {
    finalAmount = cartTotal - result.discountAmount;
  }
}
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend / API Gateway                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
    ┌──────▼──────┐               ┌───────▼────────┐
    │  Catalogue  │               │   Promotion    │
    │   Service   │               │    Service     │
    └──────┬──────┘               └───────┬────────┘
           │                               │
           │ Inject Factory                │ Inject Factory
           │                               │
    ┌──────▼──────────────┐        ┌──────▼──────────────┐
    │ CatalogueStrategy   │        │ PromotionStrategy   │
    │      Service        │        │      Service        │
    │   (Factory)         │        │   (Factory)         │
    └──────┬──────────────┘        └──────┬──────────────┘
           │                               │
           │ Auto-select strategy          │ Auto-select strategy
           │                               │
    ┌──────▼──────────────┐        ┌──────▼──────────────┐
    │  Strategy Pattern   │        │  Strategy Pattern   │
    ├─────────────────────┤        ├─────────────────────┤
    │ RetailCatalogue     │        │ RetailPromotion     │
    │ SubscriptionCatalogue│       │ SubscriptionPromo   │
    │ FreemiumCatalogue   │        │ FreemiumPromotion   │
    └─────────────────────┘        └─────────────────────┘
```

---

## ✅ Summary

### Catalogue Strategy
- **Retail**: Shows products only
- **Subscription**: Shows plans only  
- **Freemium**: Shows free plans + add-ons

### Promotion Strategy
- **Retail**: Discount codes, BOGO
- **Subscription**: Trial extension, first-month discount
- **Freemium**: Add-on bundle discounts

### Configuration
- **Dev Mode**: Use `CATALOGUE_MODE` and `PROMOTION_MODE` ENV variables
- **Production**: Pass explicit `businessModel` parameter

---

## 🎓 Next Steps

1. Test each strategy in dev mode using ENV variables
2. Integrate with frontend checkout flow
3. Add custom promotion types as needed
4. Monitor strategy selection logs

**Need Help?** See:
- `QUICK_START_BILLING_STRATEGY.md` - Similar pattern for BillingService
- `DEV_MODE_CONFIG_GUIDE.md` - ENV configuration details
- `ARCHITECTURE_DIAGRAMS.md` - Full system diagrams
