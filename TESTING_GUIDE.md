# 🧪 Testing Guide - BMMS System

## Kịch bản Test LLM + K8s Deployment

### Kịch bản 1: Retail → Subscription

**Input tiếng Việt:**
```bash
curl -X POST http://localhost:3019/llm/chat-and-deploy \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Chuyển đổi sản phẩm Premium Plan từ mô hình bán lẻ sang subscription theo tháng với giá 199,000 VNĐ",
    "tenant_id": "tenant-demo",
    "role": "admin",
    "auto_deploy": true
  }'
```

**Expected Output:**
```json
{
  "proposal_text": "Chuyển từ Retail sang Subscription...",
  "changeset": {
    "model": "BusinessModel",
    "features": [
      {"key": "business_model", "value": "subscription"},
      {"key": "subscription_price", "value": 199000},
      {"key": "billing_period", "value": "monthly"}
    ],
    "impacted_services": [
      "SubscriptionService",
      "PromotionService",
      "BillingService"
    ]
  },
  "metadata": {
    "intent": "business_model_change",
    "confidence": 0.95,
    "risk": "high"
  }
}
```

### Kịch bản 2: Multi-Model

**Input:**
```bash
curl -X POST http://localhost:3019/llm/chat-and-deploy \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Chuyển đổi hệ thống sang hỗ trợ đa mô hình: 2 sản phẩm Retail, 1 gói Subscription 99k/tháng, và 1 gói Freemium miễn phí",
    "auto_deploy": true
  }'
```

---

## Service Mapping

| Domain | Service Name | Technical Name | Namespace | Port |
|--------|--------------|----------------|-----------|------|
| Customer | AuthService | auth-svc | customer | 3001 |
| Customer | CustomerService | customer-svc | customer | 3002 |
| Product | CatalogueService | catalogue-svc | product | 3007 |
| Product | PromotionService | promotion-svc | product | 3009 |
| Order | OrderService | order-svc | order | 3011 |
| Order | SubscriptionService | subscription-svc | order | 3012 |
| Order | InventoryService | inventory-svc | order | 3013 |
| Finance | BillingService | billing-svc | finance | 3003 |
| Finance | PaymentService | payment-svc | finance | 3015 |
| Platform | APIGatewayService | api-gateway | platform | 3000 |
| Platform | LLMOrchestratorService | llm-orchestrator | platform | 3019 |

---

## API Testing

### Auth Service
```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Signup
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com", "password": "password123", "name": "Test User"}'
```

### Catalogue Service
```bash
# Create Product
curl -X POST http://localhost:3000/catalogue/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Product", "price": 100000, "sku": "TEST-001"}'

# Create Plan
curl -X POST http://localhost:3000/catalogue/plans \
  -H "Content-Type: application/json" \
  -d '{"name": "Basic Plan", "price": 99000, "billingCycle": "monthly"}'
```

### Order Service
```bash
# Create Order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": 1, "items": [{"productId": 1, "quantity": 2, "price": 50000}]}'
```

### Subscription Service
```bash
# Create Subscription
curl -X POST http://localhost:3000/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"customerId": 1, "planId": 1}'

# Purchase Add-ons
curl -X POST http://localhost:3000/addons/purchase \
  -H "Content-Type: application/json" \
  -d '{"customerId": 1, "subscriptionId": 1, "addonKeys": ["extra_storage", "ai_assistant"]}'
```

---

## Stress Testing với K6

### Install K6
```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6
```

### Run Tests
```bash
# Single service
k6 run Stress_Test/Catalogue/k6-catalogue-stress-test.js

# Full retail flow (1000 VUs)
k6 run Stress_Test/retail-flow/k6-retail-flow-1000vus-test.js
```

---

## Troubleshooting

### Check Services
```bash
# Health check
curl http://localhost:3000/health

# Check pods (K8s)
kubectl get pods --all-namespaces
```

### Check Kafka
```bash
# List topics
docker exec -it bmms-redpanda-0 rpk topic list
```

### Check Database
```bash
docker exec -it bmms-catalogue-db mysql -ubmms_user -pbmms_password -e "USE catalogue_db; SHOW TABLES;"
```
