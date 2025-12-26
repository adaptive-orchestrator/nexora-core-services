# Quick Test - RCA Scenarios (Nhóm C)

## Test nhanh 5 câu (thay vì 10)

### C1: Payment Error - Card Declined
```json
{
  "errorLog": "[PaymentService] StripeError: card_declined - insufficient_funds for transaction #TXN-001",
  "question": "Tại sao thanh toán bị từ chối?"
}
```
**Expected**: error_type="PaymentError", confidence >= 0.8

---

### C2: Database Timeout
```json
{
  "errorLog": "[OrderService] Connection timeout after 5000ms at OrderRepository.save() in order-svc.service.ts:120",
  "question": "Lỗi khi tạo đơn hàng"
}
```
**Expected**: error_type="DatabaseError", confidence >= 0.8

---

### C3: Out of Stock
```json
{
  "errorLog": "[InventoryService] Product PROD-123 out of stock. Available: 0, Requested: 5. Order ORD-100 cancelled.",
  "question": "Tại sao đơn hàng bị hủy?"
}
```
**Expected**: error_type="BusinessLogicError", confidence >= 0.8

---

### C4: Kafka Consumer Lag
```json
{
  "errorLog": "[BillingService] No handler for event 'order.created'. Consumer lag: 150 messages",
  "question": "Hóa đơn không được tạo tự động"
}
```
**Expected**: error_type="EventProcessingError", confidence >= 0.8

---

### C5: Service Unavailable
```json
{
  "errorLog": "[CRMOrchestrator] gRPC call failed: UNAVAILABLE (localhost:50051). CustomerService not responding.",
  "question": "Không lấy được thông tin khách hàng"
}
```
**Expected**: error_type="NetworkError", confidence >= 0.8

---

## Test với curl (PowerShell)

```powershell
# Test C1
$body1 = @{
    errorLog = "[PaymentService] StripeError: card_declined"
    question = "Tại sao thanh toán bị từ chối?"
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3100/llm/rca' -Method Post -Body $body1 -ContentType 'application/json' | ConvertTo-Json -Depth 10

# Test C2
$body2 = @{
    errorLog = "[OrderService] Connection timeout after 5000ms"
    question = "Lỗi khi tạo đơn hàng"
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3100/llm/rca' -Method Post -Body $body2 -ContentType 'application/json' | ConvertTo-Json -Depth 10
```

---

## One-liner test all 5

```powershell
# Quick test script
@(
    @{log="[PaymentService] StripeError: card_declined"; q="Tại sao thanh toán bị từ chối?"},
    @{log="[OrderService] Connection timeout"; q="Lỗi khi tạo đơn hàng"},
    @{log="[InventoryService] Out of stock"; q="Tại sao đơn hàng bị hủy?"},
    @{log="[BillingService] No handler for event"; q="Hóa đơn không được tạo"},
    @{log="[CRMOrchestrator] gRPC UNAVAILABLE"; q="Không lấy được thông tin khách"}
) | ForEach-Object {
    Write-Host "Testing: $($_.q)" -ForegroundColor Cyan
    $body = @{errorLog=$_.log; question=$_.q} | ConvertTo-Json
    $result = Invoke-RestMethod -Uri 'http://localhost:3100/llm/rca' -Method Post -Body $body -ContentType 'application/json'
    Write-Host "  Error Type: $($result.analysis.error_type)" -ForegroundColor Yellow
    Write-Host "  Confidence: $($result.analysis.confidence)" -ForegroundColor Green
    Write-Host ""
}
```

---

## Expected Results

Với paper claim: **Nhóm C - Semantic Accuracy: 90%**

→ Ít nhất **4/5 test cases** phải có confidence >= 0.7
→ 1 case có thể fail hoặc low confidence

---

## Kiểm tra RAG hoạt động

Xem log của LLM service:
```
[CodeSearchService] Searching for: "PaymentService StripeError"
[CodeSearchService] Found 3 relevant code snippets
[RCA] Context injected: 450 tokens from payment-svc.service.ts
```

Nếu thấy log này → RAG đang hoạt động ✅

Nếu không thấy → Cần index codebase:
```bash
npm run index-codebase
```
