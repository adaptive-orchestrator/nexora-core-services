# Kịch bản test Nhóm C - Root Cause Analysis (RCA)

## Tổng quan
Nhóm này test khả năng phân tích lỗi (Root Cause Analysis) của LLM-Orchestrator với sự hỗ trợ của RAG (Retrieval-Augmented Generation) thông qua CodeSearchService.

## Các components được kiểm chứng
- ✅ `RCA_SYSTEM_PROMPT` - System prompt cho phân tích lỗi
- ✅ `CodeSearchService` - Vector search với Qdrant 
- ✅ RAG context injection - Tự động tìm code liên quan
- ✅ Schema validation - Đầu ra tuân thủ RCAOutputSchema

## 10 Câu mẫu test RCA (Nhóm C)

### C1: Payment Processing Error
**Input:**
```json
{
  "errorLog": "[PaymentService] Error processing payment #TXN-2025-001: StripeError: card_declined - insufficient_funds",
  "question": "Tại sao giao dịch thanh toán #TXN-2025-001 bị từ chối?"
}
```
**Expected:** 
- `error_type`: "PaymentError"
- `root_cause`: Thẻ khách hàng không đủ tiền
- `affected_component`: "payment-svc"
- `suggested_fix`: Thông báo khách hàng kiểm tra số dư

---

### C2: Database Connection Timeout
**Input:**
```json
{
  "errorLog": "[OrderService] TypeError: Cannot read property 'save' of undefined\n  at OrderRepository.create (order.repository.ts:45)\n  at OrderService.createOrder (order-svc.service.ts:120)\nCaused by: Connection timeout after 5000ms",
  "question": "Lỗi khi tạo order mới, nguyên nhân là gì?"
}
```
**Expected:**
- `error_type`: "DatabaseError"
- `root_cause`: Database connection bị timeout
- `affected_component`: "order-svc / OrderRepository"
- `suggested_fix`: Tăng timeout hoặc kiểm tra database health

---

### C3: Inventory Reserve Failed
**Input:**
```json
{
  "errorLog": "[InventoryService] WARN: Product #PROD-123 out of stock. Available: 0, Requested: 5\n[OrderEvent] Inventory reserve failed for order ORD-2025-100",
  "question": "Đơn hàng ORD-2025-100 không thể xử lý vì sao?"
}
```
**Expected:**
- `error_type`: "BusinessLogicError"
- `root_cause`: Sản phẩm PROD-123 hết hàng trong kho
- `affected_component`: "inventory-svc"
- `suggested_fix`: Nhập thêm hàng hoặc notify khách chọn sản phẩm khác

---

### C4: Kafka Event Not Consumed
**Input:**
```json
{
  "errorLog": "[BillingService] WARN: No handler for event 'order.created' from partition 2\n[Kafka] Consumer group 'billing-group' lag: 150 messages",
  "question": "Hóa đơn không được tạo tự động sau khi có order mới"
}
```
**Expected:**
- `error_type`: "EventProcessingError"
- `root_cause`: Kafka consumer không lắng nghe event 'order.created'
- `affected_component`: "billing-svc event listener"
- `suggested_fix`: Check @EventPattern decorator và restart service

---

### C5: gRPC Call Failed
**Input:**
```json
{
  "errorLog": "[CRMOrchestrator] Error calling CustomerService.getCustomer(): UNAVAILABLE: 14 UNAVAILABLE: Connection refused (localhost:50051)",
  "question": "Không lấy được thông tin khách hàng khi tạo order"
}
```
**Expected:**
- `error_type`: "NetworkError"
- `root_cause`: Customer Service không chạy hoặc sai port
- `affected_component`: "customer-svc gRPC server"
- `suggested_fix`: Start customer-svc hoặc kiểm tra port config

---

### C6: TypeORM Entity Relation Error
**Input:**
```json
{
  "errorLog": "[OrderService] QueryFailedError: Cannot add or update a child row: a foreign key constraint fails (`order_db`.`order_items`, CONSTRAINT `FK_order_id` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`))",
  "question": "Lỗi khi thêm order items vào database"
}
```
**Expected:**
- `error_type`: "DatabaseError"
- `root_cause`: Foreign key constraint violation - orderId không tồn tại
- `affected_component`: "order-svc / OrderItem entity"
- `suggested_fix`: Đảm bảo save Order trước khi save OrderItems (cascade)

---

### C7: Billing Strategy Not Found
**Input:**
```json
{
  "errorLog": "[BillingService] Error: No pricing strategy found for subscriptionId=SUB-123, billingCycle=monthly\n  at PricingEngine.calculate (pricing-engine.ts:88)",
  "question": "Không tính được giá subscription SUB-123"
}
```
**Expected:**
- `error_type`: "BusinessLogicError"
- `root_cause`: Chưa cấu hình pricing strategy cho gói SUB-123 monthly
- `affected_component`: "billing-svc / PricingEngine"
- `suggested_fix`: Tạo PricingStrategy với cycle='monthly' trong database

---

### C8: Redis Cache Connection Lost
**Input:**
```json
{
  "errorLog": "[AuthService] RedisError: Connection timeout (127.0.0.1:6379)\n[JWT] Unable to cache access token for user USER-456",
  "question": "Người dùng không thể login được"
}
```
**Expected:**
- `error_type`: "CacheError"
- `root_cause`: Redis server không available
- `affected_component`: "auth-svc / Token cache"
- `suggested_fix`: Start Redis container: docker-compose up -d redis

---

### C9: Schema Validation Failed
**Input:**
```json
{
  "errorLog": "[LLM-Orchestrator] ZodError: Invalid JSON output from LLM\n  - Missing required field: 'business_model'\n  - Invalid type for 'confidence': expected number, received string",
  "question": "LLM không trả về kết quả đúng format"
}
```
**Expected:**
- `error_type`: "ValidationError"
- `root_cause`: LLM output không pass Zod schema validation
- `affected_component`: "llm-orchestrator / Schema validator"
- `suggested_fix`: Cải thiện System Prompt hoặc kích hoạt Self-Correction

---

### C10: Stripe Webhook Signature Invalid
**Input:**
```json
{
  "errorLog": "[StripeWebhook] Error: Webhook signature verification failed\n[Payment] Skipping event 'payment_intent.succeeded' from Stripe",
  "question": "Webhook từ Stripe không được xử lý"
}
```
**Expected:**
- `error_type`: "AuthError" 
- `root_cause`: Stripe webhook secret không đúng hoặc expired
- `affected_component`: "payment-svc / Stripe webhook handler"
- `suggested_fix`: Cập nhật STRIPE_WEBHOOK_SECRET trong .env

---

## Cách test qua API

### Sử dụng curl (PowerShell)
```powershell
$body = @{
    errorLog = "[PaymentService] StripeError: card_declined"
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3100/rca' -Method Post -Body $body -ContentType 'application/json'
```

### Sử dụng HTTP file (VS Code REST Client)
```http
POST http://localhost:3100/rca
Content-Type: application/json

{
  "errorLog": "[OrderService] Connection timeout after 5000ms"
}
```

## Đánh giá kết quả

### Tiêu chí Syntax Validity (100%)
- ✅ Response phải là valid JSON
- ✅ Có đầy đủ các field: `summary`, `error_type`, `root_cause`, `affected_component`, `suggested_fix`, `severity`, `confidence`
- ✅ `error_type` phải nằm trong enum: RuntimeError | TypeError | NetworkError | DatabaseError | ValidationError | AuthError | Unknown
- ✅ `severity` phải nằm trong: critical | high | medium | low
- ✅ `confidence` phải là số từ 0.0 đến 1.0

### Tiêu chí Semantic Accuracy (90%)
- ✅ `root_cause` phải chỉ đúng nguyên nhân kỹ thuật
- ✅ `affected_component` phải map đúng service/module trong hệ thống
- ✅ `suggested_fix` phải khả thi và cụ thể (có code hoặc command)
- ⚠️ Cho phép 10% sai số do: log không đủ context, LLM hallucinate khi không có code reference

### Tiêu chí RAG Effectiveness
Kiểm tra log để verify CodeSearchService được kích hoạt:
```
[CodeSearchService] Searching for: "PaymentService StripeError"
[CodeSearchService] Found 3 relevant code snippets
[RCA] Context injected: 450 tokens from payment-svc.service.ts
```

## Test automation script

Tạo file `test-rca.ps1`:
```powershell
# Test all 10 RCA scenarios
$scenarios = @(
    @{name="C1"; log="[PaymentService] StripeError: card_declined"; question="Tại sao thanh toán bị từ chối?"},
    @{name="C2"; log="[OrderService] Connection timeout"; question="Lỗi khi tạo order"},
    # ... 8 scenarios khác
)

$passed = 0
$failed = 0

foreach ($test in $scenarios) {
    Write-Host "Testing $($test.name)..." -ForegroundColor Cyan
    
    $body = @{
        errorLog = $test.log
        question = $test.question
    } | ConvertTo-Json
    
    try {
        $result = Invoke-RestMethod -Uri 'http://localhost:3100/llm/rca' -Method Post -Body $body -ContentType 'application/json'
        
        # Validate schema
        if ($result.success -and $result.analysis.error_type -and $result.analysis.confidence -ge 0.8) {
            Write-Host "✅ PASSED" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "❌ FAILED - Low confidence or missing fields" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "❌ FAILED - Error: $_" -ForegroundColor Red
        $failed++
    }
    
    Start-Sleep -Seconds 2  # Rate limiting
}

Write-Host "`nResults: $passed passed, $failed failed" -ForegroundColor Yellow
Write-Host "Accuracy: $([math]::Round($passed / ($passed + $failed) * 100, 2))%" -ForegroundColor Yellow
```

## Expected Performance
- **Syntax Validity**: 100% (schema validation enforced)
- **Semantic Accuracy**: 90% (với RAG support)
- **Average Latency**: 5.1 ± 1.2 seconds (do RAG vector search + LLM call)
- **RAG Context Hit Rate**: >80% (code snippets found for 8/10 cases)

---

**Note:** 
- Đảm bảo CodeSearchService đã index codebase: `npm run index-codebase`
- Qdrant vector DB phải running: `docker ps | grep qdrant`
- LLM service cần có đủ API keys để tránh rate limit
