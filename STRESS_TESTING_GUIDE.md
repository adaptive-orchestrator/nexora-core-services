# HƯỚNG DẪN STRESS TESTING CHO TỪNG SERVICE

## Mục lục
1. [Tools cần thiết](#tools-cần-thiết)
2. [Stress Test cho từng Service](#stress-test-cho-từng-service)
3. [Load Testing Scenarios](#load-testing-scenarios)
4. [Metrics & Monitoring](#metrics--monitoring)
5. [Best Practices](#best-practices)

---

## Tools cần thiết

### 1. k6 (Load testing tool)
```bash
# Install trên macOS
brew install k6

# Install trên Windows
choco install k6

# Install trên Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. Postman (GUI hoặc Newman CLI)

**Option A: Postman GUI** (Khuyến nghị cho người mới bắt đầu)
- Download từ: https://www.postman.com/downloads/
- Có sẵn Collection Runner cho load testing
- Giao diện trực quan, dễ dùng
- **KHÔNG CẦN cài Newman**

**Option B: Newman CLI** (Cho automation/CI-CD)
```bash
npm install -g newman
```
Chỉ cần nếu muốn chạy Postman collections từ terminal hoặc tích hợp vào pipeline.

---

## Cách chọn Tool phù hợp

| Tool | Khi nào dùng | Ưu điểm | Nhược điểm |
|------|--------------|---------|------------|
| **Postman GUI** | Mới bắt đầu, smoke test, test đơn giản | Dễ dùng, trực quan, debug dễ | Hạn chế khi mô phỏng tải lớn |
| **Newman** | CI/CD, automation, chạy collection từ terminal | Chạy từ terminal, scripting | Cần có collection sẵn |
| **k6** | Load test phức tạp, kịch bản/stages lớn | Mạnh mẽ, JS-based, metrics đẹp | Cần viết script |

**Khuyến nghị:**
- **Nhẹ/Smoke:** Postman GUI hoặc Newman
- **Tải lớn/Scenario:** k6
- **CI/CD:** Newman cho Postman, hoặc k6 trong pipeline

---

## Stress Test bằng Postman GUI

### Bước 1: Tạo Collection
1. Mở Postman
2. Click **New** → **Collection**
3. Đặt tên: "Stress Test Collection"
4. Add requests:
   - GET Products
   - POST Create Order
   - POST Subscribe
   - GET Health Check

### Bước 2: Sử dụng Collection Runner

1. Click vào Collection → **Run**
2. Cấu hình:
   - **Iterations**: 100 (số lần chạy)
   - **Delay**: 100ms (giữa các request)
   - **Data**: Upload CSV nếu cần test data khác nhau

3. Click **Run** và xem kết quả real-time

### Bước 3: Performance Testing với Postman

```javascript
// Pre-request Script (đo thời gian)
pm.globals.set("startTime", new Date().getTime());

// Tests Script (check response time)
pm.test("Response time < 500ms", function () {
    const startTime = pm.globals.get("startTime");
    const endTime = new Date().getTime();
    const responseTime = endTime - startTime;
    pm.expect(responseTime).to.be.below(500);
});

pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});
```

### Bước 4: Export & Share Collection

```bash
# Export Collection từ Postman GUI
File → Export → Collection v2.1 → Save as stress-test.json

# Chạy bằng Newman (nếu cần)
newman run stress-test.json -n 100 --delay-request 100
```

### Ví dụ: Stress Test API Gateway với Postman

**Collection Structure:**
```
Stress Test Collection
├── Health Check
│   GET http://localhost:3000/health
├── List Products
│   GET http://localhost:3000/catalogue/products
├── Get Product Detail
│   GET http://localhost:3000/catalogue/products/{{productId}}
├── Create Order
│   POST http://localhost:3000/orders
│   Body: {
│     "customerId": {{customerId}},
│     "items": [{"productId": 1, "quantity": 2}]
│   }
└── Subscribe User
    POST http://localhost:3000/subscriptions/subscribe
    Body: {
      "userId": {{userId}},
      "planId": 1
    }
```

**Environment Variables:**
```json
{
  "productId": "{{$randomInt}}",
  "customerId": "{{$randomInt}}",
  "userId": "{{$randomInt}}"
}
```

**Run với 100 iterations:**
- Total requests: 500 (5 requests × 100 iterations)
- Duration: ~30 seconds (với 100ms delay)
- Postman sẽ hiển thị:
  - Pass/Fail rate
  - Average response time
  - Min/Max response time
  - Error logs

---

## Stress Test cho từng Service

### 1. API Gateway (Port 3000)

> Test nhẹ cho API Gateway: dùng Postman GUI theo phần trên (Health, list products, detail, create order, subscribe). Khi cần mô phỏng tải lớn, dùng k6.

#### Test 4: Load Test Script với k6
```javascript
// api-gateway-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '5m', target: 200 },  // Stay at 200
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests < 500ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
  },
};

export default function () {
  // Test GET products
  const getRes = http.get('http://localhost:3000/catalogue/products');
  check(getRes, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Chạy k6:
```bash
k6 run api-gateway-load-test.js
```

---

### 2. Catalogue Service (Port 3007)

> Test nhẹ cho Catalogue: dùng Postman GUI (list, detail, create). Khi cần tải lớn, dùng k6 script bên dưới.

#### Test 4: k6 Script cho Catalogue
```javascript
// catalogue-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
};

const BASE_URL = 'http://localhost:3007';

export default function () {
  // 70% GET requests
  if (Math.random() < 0.7) {
    const id = Math.floor(Math.random() * 100) + 1;
    const res = http.get(`${BASE_URL}/products/${id}`);
    check(res, { 'GET status 200': (r) => r.status === 200 });
  } 
  // 20% List all
  else if (Math.random() < 0.9) {
    const res = http.get(`${BASE_URL}/products`);
    check(res, { 'LIST status 200': (r) => r.status === 200 });
  }
  // 10% Create
  else {
    const payload = JSON.stringify({
      name: `Product ${Date.now()}`,
      price: Math.random() * 1000,
      description: 'Test product',
    });
    const res = http.post(`${BASE_URL}/products`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'POST status 201': (r) => r.status === 201 });
  }

  sleep(1);
}
```

---

### 3. Order Service (Port 3011)

> Test nhẹ cho Order: dùng Postman GUI (tạo order, xem chi tiết). Khi cần tải lớn, dùng k6.

#### Test 3: k6 Order Flow
```javascript
// order-flow-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,  // 50 virtual users
  duration: '2m',
};

const BASE_URL = 'http://localhost:3011';

export default function () {
  // Create order
  const orderPayload = JSON.stringify({
    customerId: Math.floor(Math.random() * 100) + 1,
    items: [
      {
        productId: Math.floor(Math.random() * 10) + 1,
        quantity: Math.floor(Math.random() * 5) + 1,
        price: Math.random() * 1000,
      },
    ],
  });

  const createRes = http.post(`${BASE_URL}/orders`, orderPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(createRes, {
    'order created': (r) => r.status === 201,
    'has order id': (r) => r.json('id') !== undefined,
  });

  const orderId = createRes.json('id');

  // Get order details
  const getRes = http.get(`${BASE_URL}/orders/${orderId}`);
  check(getRes, { 'get order success': (r) => r.status === 200 });

  sleep(2);
}
```

---

### 4. Subscription Service (Port 3012)

> Test nhẹ cho Subscription: dùng Postman GUI (list plans, subscribe). Khi cần tải lớn, dùng k6.

#### Test 3: k6 Subscription Flow
```javascript
// subscription-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '2m', target: 30 },
    { duration: '1m', target: 0 },
  ],
};

const BASE_URL = 'http://localhost:3012';

export default function () {
  // List plans
  const plansRes = http.get(`${BASE_URL}/plans`);
  check(plansRes, { 'list plans ok': (r) => r.status === 200 });

  // Subscribe
  const userId = Math.floor(Math.random() * 100) + 1;
  const subscribePayload = JSON.stringify({
    userId: userId,
    planId: 1,
    billingPeriod: 'monthly',
  });

  const subscribeRes = http.post(`${BASE_URL}/subscribe`, subscribePayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(subscribeRes, { 'subscribe success': (r) => r.status === 201 });

  // Get user subscriptions
  const subsRes = http.get(`${BASE_URL}/subscriptions/user/${userId}`);
  check(subsRes, { 'get subscriptions ok': (r) => r.status === 200 });

  sleep(3);
}
```

---

### 5. Billing Service (Port 3003)

> Test nhẹ: dùng Postman GUI (tạo invoice, tính amount). Tải lớn: dùng k6.

```javascript
// billing-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
};

const BASE_URL = 'http://localhost:3003';

export default function () {
  const payload = JSON.stringify({
    userId: Math.floor(Math.random() * 100) + 1,
    items: [{ name: 'Product 1', quantity: 2, price: 100 }],
    businessModel: 'retail',
  });

  const res = http.post(`${BASE_URL}/invoices`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'invoice created': (r) => r.status === 201 });

  sleep(1);
}
```

---

### 6. Payment Service (Port 3015)

> Test nhẹ: dùng Postman GUI (process payment). Tải lớn: dùng k6.

```javascript
// payment-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '2m',
};

const BASE_URL = 'http://localhost:3015';

export default function () {
  const payload = JSON.stringify({
    invoiceId: Math.floor(Math.random() * 1000) + 1,
    amount: Math.floor(Math.random() * 500) + 50,
    method: 'credit_card',
  });

  const res = http.post(`${BASE_URL}/payments`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'payment processed': (r) => r.status === 200 || r.status === 201 });
  sleep(1);
}
```

---

## Load Testing Scenarios

### Scenario 1: E-commerce Flow (Retail Model)
```javascript
// e2e-retail-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    retail_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
    },
  },
};

const API_BASE = 'http://localhost:3000';

export default function () {
  // 1. Browse products
  const productsRes = http.get(`${API_BASE}/catalogue/products`);
  check(productsRes, { 'browse products ok': (r) => r.status === 200 });
  sleep(2);

  // 2. View product detail
  const productId = Math.floor(Math.random() * 10) + 1;
  const detailRes = http.get(`${API_BASE}/catalogue/products/${productId}`);
  check(detailRes, { 'product detail ok': (r) => r.status === 200 });
  sleep(3);

  // 3. Add to cart & Create order
  const orderPayload = JSON.stringify({
    customerId: Math.floor(Math.random() * 100) + 1,
    items: [{ productId: productId, quantity: 1, price: 100 }],
  });

  const orderRes = http.post(`${API_BASE}/orders`, orderPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(orderRes, { 'order created': (r) => r.status === 201 });
  sleep(2);

  // 4. Process payment
  const paymentPayload = JSON.stringify({
    orderId: orderRes.json('id'),
    amount: 100,
    method: 'credit_card',
  });

  const paymentRes = http.post(`${API_BASE}/payments`, paymentPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(paymentRes, { 'payment success': (r) => r.status === 200 });

  sleep(5);
}
```

Chạy:
```bash
k6 run e2e-retail-flow.js
```

### Scenario 2: Subscription Flow
```javascript
// subscription-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 30,
  duration: '3m',
};

const API_BASE = 'http://localhost:3000';

export default function () {
  // 1. Browse subscription plans
  const plansRes = http.get(`${API_BASE}/subscriptions/plans`);
  check(plansRes, { 'list plans ok': (r) => r.status === 200 });
  sleep(3);

  // 2. Subscribe
  const userId = Math.floor(Math.random() * 100) + 1;
  const subscribePayload = JSON.stringify({
    userId: userId,
    planId: 1,
  });

  const subscribeRes = http.post(`${API_BASE}/subscriptions/subscribe`, subscribePayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(subscribeRes, { 'subscribe ok': (r) => r.status === 201 });
  sleep(2);

  // 3. Check subscription status
  const statusRes = http.get(`${API_BASE}/subscriptions/user/${userId}`);
  check(statusRes, { 'status ok': (r) => r.status === 200 });

  sleep(5);
}
```

---

## Metrics & Monitoring

### 1. Kubernetes Metrics
```bash
# Watch pod resource usage
watch kubectl top pods -A

# Get service endpoints
kubectl get svc -A

# Check pod logs during stress test
kubectl logs -f <pod-name> -n <namespace>
```

### 2. Service-specific Metrics

#### Monitor API Gateway
```bash
# Real-time connections
watch 'netstat -an | grep :3000 | wc -l'

# CPU/Memory
docker stats api-gateway

# Request rate
kubectl logs -f api-gateway-pod --tail=100 | grep "GET\|POST"
```

#### Monitor Database
```bash
# MySQL connections
mysql -u root -p -e "SHOW PROCESSLIST;"

# Query performance
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
mysql -u root -p -e "SHOW STATUS LIKE 'Slow_queries';"
```

### 3. Generate Test Report
```bash
# k6 với HTML report
k6 run --out json=test-results.json e2e-retail-flow.js

# Convert to HTML
npm install -g k6-reporter
k6-reporter test-results.json
```

---

## Best Practices

### 1. Preparation
- **Backup database** trước khi stress test
- **Monitor system resources**: CPU, RAM, Disk I/O
- **Set up alerts**: Slack/Email notifications khi service down
- **Use separate test environment**: Không test trên production

### 2. During Test
- **Start small**: 10-50 users trước, tăng dần
- **Monitor real-time**: Watch logs, metrics dashboards
- **Document issues**: Screenshot errors, save logs
- **Test one service at a time**: Isolate bottlenecks

### 3. Post-Test Analysis
```bash
# Analyze k6 results
cat test-results.json | jq '.metrics.http_req_duration'

# Check error logs
grep ERROR logs/*.log | wc -l

# Database slow queries
mysql -u root -p -e "SELECT * FROM mysql.slow_log LIMIT 10;"
```

### 4. Common Metrics to Track
- **Response Time**: p50, p95, p99
- **Throughput**: Requests per second (RPS)
- **Error Rate**: % failed requests
- **Resource Usage**: CPU, Memory, Network
- **Database Performance**: Query time, connections

---

## Troubleshooting

### Issue 1: Too Many Open Files
```bash
# Increase file limits
ulimit -n 10000

# Permanent fix (Linux)
echo "* soft nofile 10000" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 10000" | sudo tee -a /etc/security/limits.conf
```

### Issue 2: Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Issue 3: Out of Memory
```bash
# Check memory
free -h

# Restart service with more memory
docker run -m 2g your-service
```

### Issue 4: Database Connection Pool Exhausted
```bash
# Increase pool size in .env
DATABASE_POOL_SIZE=100
DATABASE_POOL_TIMEOUT=30000
```

---

## Quick Reference Commands

```bash
# Ramping load test with k6
k6 run --vus 10 --duration 30s script.js

# Monitor all pods
watch kubectl top pods -A

# Follow service logs
kubectl logs -f <pod-name> -n <namespace>

# Check service health
curl http://localhost:3000/health
```

---

**Lưu ý:** 
- Stress test nên chạy trong môi trường **isolated/staging**, không phải production
- Monitor system resources (CPU, RAM, Network) trong quá trình test
- Backup dữ liệu trước khi test
- Document kết quả test để phân tích và cải thiện performance
