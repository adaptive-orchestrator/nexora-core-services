# 🏢 BMMS - Business Microservices Management System# repo-root

:D

A comprehensive microservices architecture built with NestJS, featuring domain-driven design, gRPC communication, and event-driven patterns with Kafka.

```

## 📁 Project Structureapps/ 

├─ platform/ 

```│ ├─ api-gateway/

bmms/│ ├─ llm-orchestrator/ 

├─ apps/                          # Microservices Applications│ └─ rl-scheduler/ 

│  ├─ platform/                   # Platform Services├─ customer/ 

│  │  ├─ api-gateway/            # REST API Gateway (Port 3000)│ ├─ customer-svc/ 

│  │  ├─ llm-orchestrator/       # LLM Integration Service│ ├─ crm-orchestrator/ 

│  │  ├─ rl-scheduler/           # Reinforcement Learning Scheduler├─ product/ 

│  │  └─ code-indexer/           # Code Indexing Service│ ├─ catalogue-svc/ 

│  ││ ├─ promotion-svc/ 

│  ├─ customer/                   # Customer Domain│ └─ pricing-engine/ 

│  │  ├─ auth-svc/               # Authentication Service (gRPC: 50051)├─ order/ 

│  │  ├─ customer-svc/           # Customer Management│ ├─ order-svc/ 

│  │  └─ crm-orchestrator/       # CRM Orchestration│ ├─ subscription-svc/ 

│  ││ └─ inventory-svc/ 

│  ├─ product/                    # Product Domain└─ finance/ 

│  │  ├─ catalogue-svc/          # Product Catalogue (gRPC: 50054)  ├─ billing-svc/ 

│  │  ├─ promotion-svc/          # Promotions & Discounts  └─ payment-svc/ 

│  │  └─ pricing-engine/         # Dynamic Pricinglibs/

│  │├─ Auth 

│  ├─ order/                      # Order Domain├─ Db 

│  │  ├─ order-svc/              # Order Management├─ Event 

│  │  ├─ subscription-svc/       # Subscription Handling├─ Common

│  │  └─ inventory-svc/          # Inventory Management```

│  │
│  └─ finance/                    # Finance Domain
│     ├─ billing-svc/            # Billing & Invoicing
│     └─ payment-svc/            # Payment Processing
│
├─ libs/                          # Shared Libraries
│  ├─ auth/                      # Authentication Module
│  ├─ db/                        # Database Module (TypeORM)
│  ├─ event/                     # Event Bus (Kafka)
│  └─ common/                    # Common Utilities
│
└─ llm_output/                    # LLM Generated Outputs
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

Copy and configure environment variables:

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
GRPC_LISTEN_AUTH_URL=0.0.0.0:50051
GRPC_LISTEN_CATALOGUE_URL=0.0.0.0:50054

# Kafka
KAFKA_BROKER=localhost:9092

# JWT
JWT_SECRET=your_super_secret_jwt_key
```

### 3. Start Infrastructure

```bash
# Start all databases and Kafka
docker-compose up -d

# Or start specific services
docker-compose up -d customer_db catalogue_db redpanda-0
```

### 4. Start Microservices

```bash
# Start API Gateway
npm run start:gateway

# Start Auth Service
npm run start:auth

# Start Catalogue Service
npm run start:catalogue

# Development mode (with watch)
npm run start:catalogue:dev
npm run start:gateway:dev
```

## 🌐 API Gateway Endpoints

### Base URL
```
http://localhost:3000
```

### 🔐 Authentication (`/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/signup` | User registration |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| GET | `/auth/me` | Get current user info (Protected) |

**Example - Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 📦 Catalogue (`/catalogue`)

#### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/catalogue/products` | Create new product |
| GET | `/catalogue/products` | Get all products |
| GET | `/catalogue/products/:id` | Get product by ID |

**Example - Create Product:**
```bash
curl -X POST http://localhost:3000/catalogue/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Business Plan",
    "description": "Full-featured business subscription",
    "price": 99.99,
    "sku": "PLAN-BUS-001",
    "category": "subscription"
  }'
```

#### Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/catalogue/plans` | Create new plan |
| GET | `/catalogue/plans` | Get all plans |
| GET | `/catalogue/plans/:id` | Get plan by ID |

**Example - Create Plan:**
```bash
curl -X POST http://localhost:3000/catalogue/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enterprise Plan",
    "description": "Customized enterprise solution",
    "price": 299.99,
    "billingCycle": "monthly",
    "features": [1, 2]
  }'
```

#### Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/catalogue/features` | Create new feature |
| GET | `/catalogue/features` | Get all features |
| GET | `/catalogue/features/:id` | Get feature by ID |

**Example - Create Feature:**
```bash
curl -X POST http://localhost:3000/catalogue/features \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Advanced Analytics",
    "description": "Real-time analytics dashboard",
    "code": "FEAT-ANALYTICS-001"
  }'
```

## 🗄️ Database Ports

| Service | Container | Host Port | Internal Port |
|---------|-----------|-----------|---------------|
| Customer DB | `bmms-customer-db` | 3306 | 3306 |
| CRM DB | `bmms-crm-db` | 3307 | 3306 |
| Catalogue DB | `bmms-catalogue-db` | 3308 | 3306 |
| Promotion DB | `bmms-promotion-db` | 3309 | 3306 |
| Pricing DB | `bmms-pricing-db` | 3310 | 3306 |
| Order DB | `bmms-order-db` | 3311 | 3306 |
| Subscription DB | `bmms-subscription-db` | 3312 | 3306 |
| Inventory DB | `bmms-inventory-db` | 3313 | 3306 |
| Billing DB | `bmms-billing-db` | 3314 | 3306 |
| Payment DB | `bmms-payment-db` | 3315 | 3306 |

## 🔌 gRPC Services

| Service | gRPC Port | Protocol |
|---------|-----------|----------|
| Auth Service | 50051 | gRPC |
| LLM Orchestrator | 50052 | gRPC |
| User Service | 50053 | gRPC |
| Catalogue Service | 50054 | gRPC |

## 🎯 Architecture Patterns

### Communication Patterns

1. **Synchronous (gRPC)**: Client-server request-response
   - API Gateway ↔️ Microservices
   - Inter-service communication

2. **Asynchronous (Kafka)**: Event-driven messaging
   - Domain events (product.created, order.placed, etc.)
   - Event sourcing and CQRS patterns

### Domain-Driven Design

- **Bounded Contexts**: Customer, Product, Order, Finance
- **Aggregates**: Entities grouped by business logic
- **Event Publishing**: Domain events for inter-service communication

## 📚 Documentation

### Swagger API Documentation

Once the API Gateway is running, access interactive API docs:

```
http://localhost:3000/api
```

### Proto Files

gRPC service definitions located in:
- `apps/{service}/src/proto/*.proto`
- `apps/platform/api-gateway/src/proto/*.proto`

## 🛠️ Development

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Building for Production

```bash
# Build all services
npm run build

# Build specific service
npm run build catalogue-svc
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f catalogue_db

# Stop all services
docker-compose down

# Rebuild containers
docker-compose up -d --build

# Remove volumes (⚠️ deletes data)
docker-compose down -v
```

## 🔧 Troubleshooting

### Port Conflicts

If you get `EADDRINUSE` errors:

```bash
# Check which process is using the port (Windows)
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <process_id> /F
```

### Database Connection Issues

1. Ensure Docker containers are running:
   ```bash
   docker ps
   ```

2. Check database logs:
   ```bash
   docker-compose logs catalogue_db
   ```

3. Verify `.env` configuration matches `docker-compose.yaml`

### gRPC Connection Errors

1. Ensure microservice is running on correct port
2. Check firewall settings
3. Verify proto file paths in service configuration

## 📝 Available Scripts

```bash
# Platform Services
npm run start:gateway          # API Gateway
npm run start:gateway:dev      # API Gateway (watch mode)

# Customer Domain
npm run start:auth             # Auth Service
npm run start:customer         # Customer Service

# Product Domain
npm run start:catalogue        # Catalogue Service
npm run start:catalogue:dev    # Catalogue (watch mode)

# Order Domain
npm run start:order            # Order Service
npm run start:order:dev        # Order (watch mode)
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Built with ❤️ by the BMMS Development Team
