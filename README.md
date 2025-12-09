# 🏢 BMMS - Business Microservices Management System

Hệ thống quản lý đa mô hình kinh doanh (Retail, Subscription, Freemium) với kiến trúc Microservices, tích hợp LLM để điều khiển hệ thống bằng ngôn ngữ tự nhiên và tự động triển khai lên Kubernetes.

## 🎯 Tính năng chính

- **4 mô hình kinh doanh**: Retail (bán lẻ), Subscription (đăng ký), Freemium (miễn phí + add-on), Multi-Model
- **LLM Integration**: Điều khiển hệ thống bằng tiếng Việt tự nhiên (Google Gemini)
- **K8s Auto-Deployment**: Tự động sinh YAML và deploy lên Kubernetes
- **Event-Driven Architecture**: Kafka/Redpanda cho giao tiếp async giữa services
- **Strategy Pattern**: Linh hoạt chuyển đổi billing modes (Onetime/Recurring/Freemium)
- **gRPC Communication**: Giao tiếp hiệu suất cao giữa các microservices

## 📁 Cấu trúc dự án

```
bmms/
├─ apps/                         # Microservices (14 services)
│  ├─ platform/                  # Platform Services
│  │  ├─ api-gateway/            # REST API Gateway (Port 3000)
│  │  ├─ llm-orchestrator/       # LLM + Helm Integration (Port 3019, gRPC: 50052)
│  │  ├─ project-svc/            # Task/Project Management (Port 3021)
│  │  ├─ job-scheduler/          # Background Job Scheduler (Renewals, Invoices)
│  │  └─ code-indexer/           # Code Indexing for RAG
│  │
│  ├─ customer/                  # Customer Domain
│  │  ├─ auth-svc/               # Authentication (JWT, gRPC: 50051)
│  │  ├─ customer-svc/           # Customer Management & Segmentation
│  │  └─ crm-orchestrator/       # CRM Orchestration
│  │
│  ├─ product/                   # Product Domain
│  │  ├─ catalogue-svc/          # Products, Plans, Features (gRPC: 50054)
│  │  ├─ promotion-svc/          # Promotions & Discounts
│  │  └─ pricing-engine/         # Dynamic Pricing Strategies
│  │
│  ├─ order/                     # Order Domain
│  │  ├─ order-svc/              # Order Management (Retail)
│  │  ├─ subscription-svc/       # Subscriptions + Add-ons (Freemium)
│  │  └─ inventory-svc/          # Stock & Reservation Management
│  │
│  └─ finance/                   # Finance Domain
│     ├─ billing-svc/            # Invoicing + Billing Strategies
│     └─ payment-svc/            # Payment Processing
│
├─ libs/                         # Shared Libraries
│  ├─ auth/                      # Authentication Module
│  ├─ db/                        # Database Module (TypeORM)
│  ├─ event/                     # Event Bus (Kafka)
│  └─ common/                    # Common Utilities
│
└─ k8s/                          # Kubernetes Configurations
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.x
- **Docker** & Docker Compose
- **MySQL** 8.0 (via Docker)
- **Kafka/Redpanda** (via Docker)

### 1. Install Dependencies

```bash
cd bmms
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Key environment variables:
```env
# Database
DB_USERNAME=bmms_user
DB_PASSWORD=bmms_password

# gRPC Services
GRPC_SERVER_AUTH_URL=127.0.0.1:50051
GRPC_SERVER_CATALOGUE_URL=127.0.0.1:50054
GRPC_LISTEN_LLM_URL=0.0.0.0:50052

# Kafka
KAFKA_BROKER=localhost:9092

# JWT
JWT_SECRET=your_super_secret_jwt_key

# LLM (Google Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
LLM_MODEL=gemini-2.5-flash
```

### 3. Start Infrastructure

```bash
docker-compose up -d
```

### 4. Start Microservices

```bash
npm run start:gateway          # API Gateway
npm run start:auth             # Auth Service
npm run start:catalogue        # Catalogue Service
npm run start:order            # Order Service
npm run start:billing          # Billing Service
npm run start:payment          # Payment Service
npm run start:subscription     # Subscription Service
npm run start:inventory        # Inventory Service
npm run start:llm              # LLM Orchestrator
```

## 🌐 API Endpoints (80+ endpoints)

### Base URL: `http://localhost:3000`

### 🔐 Authentication (`/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login, returns JWT |
| POST | `/auth/signup` | User registration |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |
| GET | `/auth/me` | Get current user info |

### 👥 Customers (`/customers`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers` | List customers (paginated, filter by segment) |
| GET | `/customers/:id` | Get customer by ID |
| GET | `/customers/email/:email` | Get customer by email |
| GET | `/customers/:id/insights` | AI-powered customer insights |
| PATCH | `/customers/:id` | Update customer |
| DELETE | `/customers/:id` | Delete customer |

### 📦 Catalogue (`/catalogue`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/catalogue/products` | CRUD products |
| POST/GET | `/catalogue/plans` | CRUD subscription plans |
| POST/GET | `/catalogue/features` | CRUD plan features |

### 📦 Inventory (`/inventory`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/inventory` | CRUD inventory |
| GET | `/inventory/product/:id` | Get product inventory |
| POST | `/inventory/product/:id/adjust` | Adjust stock level |
| POST | `/inventory/product/:id/reserve` | Reserve stock for order |
| POST | `/inventory/product/:id/release` | Release reservation |
| GET | `/inventory/low-stock` | Get items below reorder level |

### 🛒 Orders (`/orders`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Create order |
| GET | `/orders` | List orders (paginated) |
| GET | `/orders/:id` | Get order by ID |
| GET | `/orders/customer/:customerId` | Get customer's orders |
| PATCH | `/orders/:id/status` | Update order status |
| DELETE | `/orders/:id` | Cancel order |

### 📅 Subscriptions (`/subscriptions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/subscriptions` | Create subscription |
| GET | `/subscriptions/customer/:customerId` | Get customer's subscriptions |
| PATCH | `/subscriptions/:id/cancel` | Cancel subscription |
| PATCH | `/subscriptions/:id/renew` | Renew subscription |
| POST | `/subscriptions/:id/activate` | Activate after payment |
| PATCH | `/subscriptions/:id/change-plan` | Upgrade/downgrade plan |

### 🎁 Add-ons (`/addons`) - Freemium Model

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/addons` | List available add-ons |
| GET | `/addons/:key` | Get add-on by key |
| POST | `/addons` | Create add-on (Admin) |
| POST | `/addons/purchase` | Purchase add-ons |
| GET | `/addons/user/:customerId` | Get user's add-ons |
| DELETE | `/addons/user/:id` | Cancel add-on |

### 💰 Billing (`/billing`, `/invoices`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/invoices` | Create invoice |
| GET | `/invoices` | List invoices |
| GET | `/invoices/:id` | Get invoice |
| PATCH | `/invoices/:id/status` | Update status |
| GET | `/billing/customer/:customerId` | Customer's invoices |

### 💳 Payments (`/payments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payments` | List payments |
| GET | `/payments/stats/summary` | Payment statistics |
| POST | `/payments/initiate` | Initiate payment |
| POST | `/payments/confirm` | Confirm payment |
| POST | `/payments/subscription/pay` | Subscription payment |

### 🎉 Promotions (`/promotions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/promotions` | CRUD promotions |
| GET | `/promotions/code/:code` | Get by code |
| POST | `/promotions/validate` | Validate promo code |
| POST | `/promotions/apply` | Apply promo code |

### 🤖 AI Chat (`/ai/chat`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/chat` | Send message to AI |
| GET | `/ai/chat/history` | Get chat history |

### 🚀 LLM Orchestrator (`/llm`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/llm/chat` | Send business request to LLM |
| POST | `/llm/chat-and-deploy` | Chat + trigger K8s deployment |

### 📊 Admin (`/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats/dashboard` | Dashboard statistics |
| GET | `/admin/stats/revenue` | Revenue breakdown by model |

## 🗄️ Database Ports

| Service | Container | Port |
|---------|-----------|------|
| Customer DB | bmms-customer-db | 3306 |
| CRM DB | bmms-crm-db | 3307 |
| Catalogue DB | bmms-catalogue-db | 3308 |
| Promotion DB | bmms-promotion-db | 3309 |
| Pricing DB | bmms-pricing-db | 3310 |
| Order DB | bmms-order-db | 3311 |
| Subscription DB | bmms-subscription-db | 3312 |
| Inventory DB | bmms-inventory-db | 3313 |
| Billing DB | bmms-billing-db | 3314 |
| Payment DB | bmms-payment-db | 3315 |
| Project DB | bmms-project-db | 3320 |

## 🔌 gRPC Services

| Service | Port | Package |
|---------|------|---------|
| Auth Service | 50051 | AUTH_PACKAGE |
| LLM Orchestrator | 50052 | LLM_ORCHESTRATOR_PACKAGE |
| User Service | 50053 | USER_PACKAGE |
| Catalogue Service | 50054 | CATALOGUE_PACKAGE |

## 🏗️ Architecture Patterns

### Billing Strategy Pattern

```
┌─────────────────────────────────────────┐
│          IBillingStrategy               │
├─────────────────────────────────────────┤
│ OnetimeBilling   │ RecurringBilling   │ FreemiumBilling │
│ (Retail)         │ (Subscription)     │ (Free + Addons) │
└─────────────────────────────────────────┘
```

### Event-Driven Flow (Kafka)

```
User Signup → Auth Service → user.created → Customer Service → customer.created
Order Created → order.created → Inventory Service → inventory.reserved → Billing Service → invoice.created → Payment Service
```

### Key Kafka Topics

| Topic | Producer | Consumer |
|-------|----------|----------|
| `user.created` | auth-svc | customer-svc |
| `order.created` | order-svc | inventory-svc, billing-svc |
| `order.completed` | order-svc | inventory-svc |
| `invoice.created` | billing-svc | payment-svc |
| `payment.success` | payment-svc | billing-svc, subscription-svc |
| `subscription.created` | subscription-svc | billing-svc |

## 🤖 LLM Integration

### Supported Provider
- **Google Gemini** (gemini-2.5-flash)

### Changeset Generation
```json
{
  "proposal_text": "Vietnamese explanation",
  "changeset": {
    "model": "BusinessModel",
    "features": [{"key": "business_model", "value": "subscription"}],
    "impacted_services": ["SubscriptionService", "BillingService"]
  },
  "metadata": {
    "intent": "business_model_change",
    "confidence": 0.95,
    "risk": "high"
  }
}
```

## 📝 Available Scripts

```bash
# Platform
npm run start:gateway          # API Gateway
npm run start:llm              # LLM Orchestrator

# Customer Domain
npm run start:auth             # Auth Service
npm run start:customer         # Customer Service

# Product Domain
npm run start:catalogue        # Catalogue Service
npm run start:promotion        # Promotion Service

# Order Domain
npm run start:order            # Order Service
npm run start:subscription     # Subscription Service
npm run start:inventory        # Inventory Service

# Finance Domain
npm run start:billing          # Billing Service
npm run start:payment          # Payment Service
```

## 🐳 Docker Commands

```bash
docker-compose up -d           # Start all
docker-compose down            # Stop all
docker-compose logs -f         # View logs
```

## 📚 API Documentation

Swagger UI available at: `http://localhost:3000/api`

## 📄 License

MIT License
