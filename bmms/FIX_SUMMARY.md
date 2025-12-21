# 🔧 Fix: "Tổng doanh thu tháng này" trả về NULL

## ❌ Vấn đề
Query "tổng doanh thu tháng này" trả về:
```json
{
  "success": true,
  "raw_data": "[{\"totalRevenueThisMonth\":null}]",
  "natural_response": "📊 Không tìm thấy dữ liệu..."
}
```

## 🔍 Nguyên nhân
1. **SQL query đúng** nhưng **data test thiếu**:
   ```sql
   SELECT SUM(totalAmount) FROM orders 
   WHERE paymentStatus = 'paid' AND YEAR(createdAt) = 2025 AND MONTH(createdAt) = 12;
   ```

2. **Test script chỉ tạo orders** → không simulate payment:
   - `frontend/test-order-flow.ps1` tạo orders với `paymentStatus='pending'`
   - Không có event `PAYMENT_SUCCESS` được emit
   - Orders không bao giờ được update thành `'paid'`

3. **Event flow bị thiếu**:
   ```
   ❌ THIẾU: Payment Success Event → Order Service → Update paymentStatus='paid'
   ```

## ✅ Giải pháp đã áp dụng

### 1. Fix Test Data (Manual)
```sql
-- File: fix-december-orders.sql
UPDATE orders 
SET paymentStatus = 'paid', status = 'paid'
WHERE YEAR(createdAt) = 2025 AND MONTH(createdAt) = 12 
  AND paymentStatus = 'pending'
LIMIT 3;
```

**Kết quả:**
```
✅ Before: 0 paid orders → revenue = 0.00
✅ After:  3 paid orders → revenue = 4999.96 đ
```

### 2. Cách test đúng trong tương lai

**Option A: Sử dụng Test API** (Recommended)
```bash
# Bước 1: Tạo order
POST http://localhost:3000/orders
{
  "customerId": "xxx",
  "items": [...]
}
# → Response: {order: {id: "order-xxx", ...}}

# Bước 2: Lấy payment từ order
GET http://localhost:3000/payments?orderId=order-xxx
# → Response: {payments: [{id: "payment-yyy", ...}]}

# Bước 3: Simulate payment success (trigger event flow)
POST http://localhost:3000/payments/payment-yyy/test/success
{
  "invoiceId": "invoice-zzz",
  "orderId": "order-xxx",
  "customerId": "customer-aaa",
  "amount": 1299.99
}
# → Tự động emit PAYMENT_SUCCESS event
# → Order Service nhận event và update paymentStatus='paid'
```

**Option B: Script PowerShell hoàn chỉnh**
```powershell
# Tạo file: test-order-with-payment.ps1
# 1. Create order
$order = Invoke-RestMethod -Uri "$API_BASE/orders" -Method POST -Body $orderJson

# 2. Wait for invoice creation (2s)
Start-Sleep -Seconds 2

# 3. Get payment
$payments = Invoke-RestMethod -Uri "$API_BASE/payments?orderId=$($order.id)"
$paymentId = $payments[0].id

# 4. Simulate payment success
Invoke-RestMethod -Uri "$API_BASE/payments/$paymentId/test/success" -Method POST -Body $paymentData

# 5. Verify order updated
Start-Sleep -Seconds 1
$updatedOrder = Invoke-RestMethod -Uri "$API_BASE/orders/$($order.id)"
Write-Host "Payment Status: $($updatedOrder.paymentStatus)" # Should be 'paid'
```

## 📊 Verification

```bash
# Kiểm tra data đã fix
docker exec bmms-order-db mysql -uroot -pbmms_root_password order_db -e \
  "SELECT 
     COUNT(*) as total,
     COUNT(CASE WHEN paymentStatus='paid' THEN 1 END) as paid,
     SUM(CASE WHEN paymentStatus='paid' THEN totalAmount ELSE 0 END) as revenue
   FROM orders 
   WHERE YEAR(createdAt) = 2025 AND MONTH(createdAt) = 12;"

# Output hiện tại:
# total=4, paid=3, revenue=4999.96 ✅
```

## 🎯 Để chạy đúng lần sau

### Services cần chạy:
```bash
# Terminal 1: Order Service (lắng nghe PAYMENT_SUCCESS)
cd nexora-core-services/bmms
npm run start order-svc

# Terminal 2: Payment Service (emit PAYMENT_SUCCESS)  
npm run start payment-svc

# Terminal 3: LLM Orchestrator (Text-to-SQL)
npm run start:llm:dev

# Terminal 4: API Gateway (REST API)
npm run start api-gateway
```

### Test flow hoàn chỉnh:
1. ✅ Tạo order qua API Gateway
2. ✅ Đợi invoice được tạo tự động (2s)
3. ✅ Call test API để emit PAYMENT_SUCCESS event
4. ✅ Order Service nhận event và update `paymentStatus='paid'`
5. ✅ Query "tổng doanh thu tháng này" → trả về số tiền đúng

## 📚 Files quan trọng

### Event Listener (nhận PAYMENT_SUCCESS)
- `apps/order/order-svc/src/order.event-listener.ts`
  ```typescript
  @EventPattern(event.EventTopics.PAYMENT_SUCCESS)
  async handlePaymentSuccess(@Payload() evt) {
    order.paymentStatus = 'paid';
    order.status = 'paid';
    await this.orderRepository.save(order);
  }
  ```

### Event Emitter (phát PAYMENT_SUCCESS)
- `apps/finance/payment-svc/src/stripe-webhook.service.ts` (Stripe webhook)
- `apps/finance/payment-svc/src/payment-svc.service.ts` (Test API)

### Test API
- `apps/finance/payment-svc/src/payment-svc.controller.ts`
  ```typescript
  @Post(':paymentId/test/success') // ← API để test
  async testEmitSuccess(@Param('paymentId') id, @Body() data) {
    await this.paymentService.emitPaymentSuccess({...});
  }
  ```

---

**Status**: ✅ Fixed  
**Data**: December 2025 orders updated  
**Next**: Chạy full services và test lại với LLM service
