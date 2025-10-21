# 🐳 Docker Compose — BMMS Microservices Stack

## 📦 Tổng quan
Hệ thống **BMMS (Business Management Microservices System)** bao gồm 3 dịch vụ chính:
- **Order Service**
- **Billing Service**
- **Payment Service**

Mỗi service được container hóa bằng **Docker** và có **database MySQL riêng**, cùng một **Redpanda broker** phục vụ giao tiếp sự kiện.

---

## 🗺️ Cấu trúc mạng
Toàn bộ các container nằm trong **bridge network**:
```
bmms-network
```

---

## ⚙️ Bảng dịch vụ và cổng kết nối

| Service Name     | Container Name     | Description / Context Path | Internal Port | Exposed Port | Dependencies                    |
|------------------|--------------------|-----------------------------|----------------|---------------|----------------------------------|
| 🧾 **Order Service**   | `order-service`     | Handles order processing and status updates | `3011` | `3011` | `order-db`, `redpanda-0` |
| 💳 **Billing Service** | `billing-service`   | Handles billing and invoicing | `3003` | `3003` | `billing-db`, `redpanda-0` |
| 💰 **Payment Service** | `payment-service`   | Processes payments and transactions | `3015` | `3015` | `payment-db`, `redpanda-0` |
| 🗃️ **Order DB**        | `bmms-order-db`     | MySQL database for order-service | `3306` | `3311` | — |
| 🗃️ **Billing DB**      | `bmms-billing-db`   | MySQL database for billing-service | `3307` | `3314` | — |
| 🗃️ **Payment DB**      | `bmms-payment-db`   | MySQL database for payment-service | `3308` | `3315` | — |
| 📡 **Redpanda Broker** | `redpanda-0`        | Kafka-compatible broker for event streaming | `9092 / 29092 / 9644` | same | — |

---

## 🧩 Network & Volume Configuration

**Networks**
```yaml
networks:
  bmms-network:
    driver: bridge
```

**Volumes**
```yaml
volumes:
  order_db_data:
  billing_db_data:
  payment_db_data:
  redpanda_0_data:
```

---

## 🚀 Cách chạy hệ thống
1. **Build và khởi chạy toàn bộ stack**
   ```bash
   docker compose up -d --build
   ```

2. **Kiểm tra trạng thái container**
   ```bash
   docker ps --format "table {{.Names}}	{{.Status}}	{{.Ports}}"
   ```

3. **Truy cập dịch vụ**
   | Service | URL |
   |----------|-----|
   | Order Service | http://localhost:3011 |
   | Billing Service | http://localhost:3003 |
   | Payment Service | http://localhost:3015 |
   | Redpanda Console | http://localhost:9644 |

4. **Dừng và xóa container**
   ```bash
   docker compose down -v
   ```

---
