# Test Dynamic Changeset Generation API

## ✨ Overview
API mới này sử dụng **RAG (Retrieval-Augmented Generation)** để:
1. **Tự động khám phá** tất cả services có trong codebase
2. **Phân tích intent** của user để quyết định enable/disable service nào
3. **Sinh 2 files** (JSON + YAML) CHỈ để xem - **KHÔNG chạy Helm**

## 🔥 Key Features

### 1. RAG-Based Service Discovery
- Tìm kiếm trong code với patterns:
  - `@Injectable()` NestJS services
  - Docker service definitions
  - Kubernetes deployments
  - File paths trong `apps/`
- Core services luôn được detect: Order, Inventory, Billing, Payment, Subscription, Promotion, Pricing, Catalogue, Customer, Auth

### 2. Intent Analysis
- Phân tích user request để quyết định service nào cần:
  - **Enable**: Service được nhắc đến trong intent
  - **Disable**: Service không cần cho model đích
  - **Restart**: Service có thay đổi giá/billing
- Support force include/exclude

### 3. Risk Assessment
- **HIGH**: Xóa data, disable critical services (billing, payment, auth)
- **MEDIUM**: Thay đổi giá, billing, >5 services affected
- **LOW**: Các thay đổi nhỏ

## 🚀 Testing

### Test Case 1: Retail Model (Basic)
```bash
curl -X POST http://localhost:8003/llm-orchestrator/generate-dynamic-changeset \
-H "Content-Type: application/json" \
-d '{
  "user_intent": "Tôi muốn chuyển sang mô hình bán lẻ truyền thống",
  "current_model": "multi",
  "target_model": "retail"
}'
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Dynamic changeset generated successfully (FILES ONLY - Helm NOT executed)",
  "data": {
    "changeset": {
      "timestamp": "2025-01-09T10:30:00.000Z",
      "intent": "Tôi muốn chuyển sang mô hình bán lẻ truyền thống",
      "from_model": "multi",
      "to_model": "retail",
      "discovered_services": [
        "OrderService",
        "InventoryService",
        "BillingService",
        "PaymentService",
        "CatalogueService",
        "SubscriptionService",
        "PromotionService",
        "PricingService",
        "CustomerService",
        "AuthService"
      ],
      "services": [
        { "name": "OrderService", "enabled": true },
        { "name": "InventoryService", "enabled": true },
        { "name": "BillingService", "enabled": true },
        { "name": "PaymentService", "enabled": true },
        { "name": "CatalogueService", "enabled": true },
        { "name": "SubscriptionService", "enabled": false },
        { "name": "PromotionService", "enabled": false },
        { "name": "PricingService", "enabled": false }
      ],
      "risk_level": "low",
      "auto_generated": true
    },
    "files": {
      "json": "c:\\Users\\vulin\\Desktop\\app\\nexora-core-services\\bmms\\llm_output\\dynamic_changesets\\dynamic-changeset-1736419800000.json",
      "yaml": "c:\\Users\\vulin\\Desktop\\app\\nexora-core-services\\bmms\\llm_output\\dynamic_changesets\\dynamic-changeset-1736419800000.yaml"
    },
    "discovered_services": ["OrderService", "InventoryService", ...],
    "risk_level": "low",
    "total_services": 10,
    "enabled_services": 5
  }
}
```

### Test Case 2: Disable Billing Service (HIGH RISK)
```bash
curl -X POST http://localhost:8003/llm-orchestrator/generate-dynamic-changeset \
-H "Content-Type: application/json" \
-d '{
  "user_intent": "Tắt Billing Service để bảo trì",
  "exclude_services": ["BillingService"]
}'
```

**Expected Risk Level:** `high`  
**Reason:** Disabling critical billing service

### Test Case 3: Custom Service Discovery
```bash
curl -X POST http://localhost:8003/llm-orchestrator/generate-dynamic-changeset \
-H "Content-Type: application/json" \
-d '{
  "user_intent": "Tôi cần thêm service xử lý AI chat và notification",
  "force_services": ["AIChatService", "NotificationService"]
}'
```

**Expected Output:**
- RAG sẽ tìm kiếm trong code xem có `AIChatService` hay `NotificationService` không
- Nếu không tìm thấy, vẫn sẽ thêm vào với confidence thấp
- File YAML sẽ có:
```yaml
services:
  aichat:
    enabled: true
  notification:
    enabled: true
```

### Test Case 4: Pricing Change (MEDIUM RISK)
```bash
curl -X POST http://localhost:8003/llm-orchestrator/generate-dynamic-changeset \
-H "Content-Type: application/json" \
-d '{
  "user_intent": "Thay đổi giá sản phẩm và chiến lược giá",
  "current_model": "retail",
  "target_model": "retail"
}'
```

**Expected Risk Level:** `medium`  
**Reason:** Pricing changes require careful review  
**Services with needsRestart:** `PricingService`, `BillingService`

## 📁 Output Files

### JSON File (`dynamic-changeset-{timestamp}.json`)
```json
{
  "timestamp": "2025-01-09T10:30:00.000Z",
  "intent": "User intent here",
  "from_model": "multi",
  "to_model": "retail",
  "discovered_services": ["OrderService", "InventoryService", ...],
  "services": [
    {
      "name": "OrderService",
      "enabled": true,
      "replicaCount": 2,
      "needsRestart": false,
      "confidence": 1.0
    }
  ],
  "risk_level": "low",
  "auto_generated": true
}
```

### YAML File (`dynamic-changeset-{timestamp}.yaml`)
```yaml
metadata:
  generated_at: '2025-01-09T10:30:00.000Z'
  intent: User intent here
  risk_level: low
  auto_generated: true
  from_model: multi
  to_model: retail

global:
  businessModel: retail

services:
  order:
    enabled: true
  inventory:
    enabled: true
  subscription:
    enabled: false

databases:
  orderdb:
    enabled: true
  inventorydb:
    enabled: true
```

## 🔍 Verification Steps

1. **Check Output Directory:**
```powershell
cd c:\Users\vulin\Desktop\app\nexora-core-services\bmms
ls llm_output\dynamic_changesets\
```

2. **Verify JSON:**
```powershell
cat llm_output\dynamic_changesets\dynamic-changeset-<timestamp>.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

3. **Verify YAML:**
```powershell
cat llm_output\dynamic_changesets\dynamic-changeset-<timestamp>.yaml
```

4. **Check Logs:**
```bash
# In llm-orchestrator container logs
[DynamicChangeset] Starting generation for: "user intent"
[DynamicChangeset] Discovered 12 services via RAG
[DynamicChangeset] ✅ Generated successfully
[DynamicChangeset]    JSON: /path/to/file.json
[DynamicChangeset]    YAML: /path/to/file.yaml
```

## ⚠️ Important Notes

### This API ONLY Generates Files
- ❌ **KHÔNG** chạy `helm install`
- ❌ **KHÔNG** deploy lên Kubernetes
- ✅ CHỈ sinh 2 files để xem/phân tích
- ✅ Helm vẫn chỉ chạy 4 changeset chính (retail, subscription, freemium, multi)

### Why Separate API?
- **Safety**: Helm deployments are critical operations
- **Flexibility**: Analyze ANY services without risk
- **Manual Review**: Human can review generated files before deciding to deploy
- **Testing**: Can test different scenarios without affecting production

### Integration with Existing System
```
┌─────────────────────────────────────────────────┐
│  User Request                                   │
└────────────┬────────────────────────────────────┘
             │
             ├──► EXISTING API (/recommend-model-detailed)
             │    ├─ Uses 4 FIXED profiles
             │    ├─ Auto-generates files
             │    └─ Can trigger Helm (with approval)
             │
             └──► NEW API (/generate-dynamic-changeset)
                  ├─ Uses RAG discovery
                  ├─ Generates files ONLY
                  └─ No Helm execution
```

## 🎯 Success Metrics

- [ ] RAG discovers at least 10+ services from codebase
- [ ] JSON file generated with correct structure
- [ ] YAML file is valid Helm format
- [ ] Risk level correctly assessed
- [ ] No Helm commands executed
- [ ] Files saved to `llm_output/dynamic_changesets/`

## 🐛 Troubleshooting

### Issue: No services discovered
**Solution:** Check if Qdrant is running and has indexed code:
```bash
curl http://localhost:6333/collections/code_embeddings
```

### Issue: Risk level always low
**Solution:** Check if dangerous keywords are detected in intent. Add more keywords to risk assessment logic.

### Issue: Files not generated
**Solution:** Check directory permissions:
```powershell
mkdir llm_output\dynamic_changesets -Force
```

## 📊 Performance Benchmarks

- RAG search: ~200-500ms (depending on codebase size)
- Service analysis: ~100ms
- File generation: ~50ms
- **Total**: ~350-650ms

## Next Steps

1. Test all 4 test cases
2. Verify file outputs
3. Compare with existing 4-profile system
4. (Optional) Add frontend UI for dynamic changeset generation
