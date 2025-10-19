# repo-root

```
apps/ 
├─ platform/ 
│ ├─ api-gateway/
│ ├─ llm-orchestrator/ 
│ └─ rl-scheduler/ 
├─ customer/ 
│ ├─ customer-svc/ 
│ ├─ crm-orchestrator/ 
├─ product/ 
│ ├─ catalogue-svc/ 
│ ├─ promotion-svc/ 
│ └─ pricing-engine/ 
├─ order/ 
│ ├─ order-svc/ 
│ ├─ subscription-svc/ 
│ └─ inventory-svc/ 
└─ finance/ 
  ├─ billing-svc/ 
  └─ payment-svc/ 
libs/
├─ Auth 
├─ Db 
├─ Event 
├─ Common
```

create .env and add content below:

```bash
# ==========================================
# DATABASE COMMON CONFIGURATION
# ==========================================
DB_TYPE=mysql
DB_PORT=3306
DB_USERNAME=bmms_user
DB_PASSWORD=bmms_password
DB_ROOT_PASSWORD=bmms_root_password

# ==========================================
# CUSTOMER SERVICE DATABASE
# ==========================================
CUSTOMER_SVC_DB_HOST=localhost
CUSTOMER_SVC_DB_PORT=3306
CUSTOMER_SVC_DB_USER=bmms_user
CUSTOMER_SVC_DB_PASS=bmms_password
CUSTOMER_SVC_DB_NAME=customer_db

# ==========================================
# CRM ORCHESTRATOR DATABASE
# ==========================================
CRM_ORCHESTRATOR_DB_HOST=crm_db
CRM_ORCHESTRATOR_DB_PORT=3306
CRM_ORCHESTRATOR_DB_USER=bmms_user
CRM_ORCHESTRATOR_DB_PASS=bmms_password
CRM_ORCHESTRATOR_DB_NAME=crm_db

# ==========================================
# CATALOGUE SERVICE DATABASE
# ==========================================
CATALOGUE_SVC_DB_HOST=catalogue_db
CATALOGUE_SVC_DB_PORT=3306
CATALOGUE_SVC_DB_USER=bmms_user
CATALOGUE_SVC_DB_PASS=bmms_password
CATALOGUE_SVC_DB_NAME=catalogue_db

# ==========================================
# PROMOTION SERVICE DATABASE
# ==========================================
PROMOTION_SVC_DB_HOST=promotion_db
PROMOTION_SVC_DB_PORT=3306
PROMOTION_SVC_DB_USER=bmms_user
PROMOTION_SVC_DB_PASS=bmms_password
PROMOTION_SVC_DB_NAME=promotion_db

# ==========================================
# PRICING ENGINE DATABASE
# ==========================================
PRICING_ENGINE_DB_HOST=pricing_db
PRICING_ENGINE_DB_PORT=3306
PRICING_ENGINE_DB_USER=bmms_user
PRICING_ENGINE_DB_PASS=bmms_password
PRICING_ENGINE_DB_NAME=pricing_db

# ==========================================
# ORDER SERVICE DATABASE
# ==========================================
ORDER_SVC_DB_HOST=localhost
ORDER_SVC_DB_PORT=3311
ORDER_SVC_DB_USER=bmms_user
ORDER_SVC_DB_PASS=bmms_password
ORDER_SVC_DB_NAME=order_db

# ==========================================
# SUBSCRIPTION SERVICE DATABASE
# ==========================================
SUBSCRIPTION_SVC_DB_HOST=subscription_db
SUBSCRIPTION_SVC_DB_PORT=3306
SUBSCRIPTION_SVC_DB_USER=bmms_user
SUBSCRIPTION_SVC_DB_PASS=bmms_password
SUBSCRIPTION_SVC_DB_NAME=subscription_db

# ==========================================
# INVENTORY SERVICE DATABASE
# ==========================================
INVENTORY_SVC_DB_HOST=localhost
INVENTORY_SVC_DB_PORT=3313
INVENTORY_SVC_DB_USER=bmms_user
INVENTORY_SVC_DB_PASS=bmms_password
INVENTORY_SVC_DB_NAME=inventory_db

# ==========================================
# BILLING SERVICE DATABASE
# ==========================================
BILLING_SVC_DB_HOST=localhost
BILLING_SVC_DB_PORT=3314
BILLING_SVC_DB_USER=bmms_user
BILLING_SVC_DB_PASS=bmms_password
BILLING_SVC_DB_NAME=billing_db

# ==========================================
# PAYMENT SERVICE DATABASE
# ==========================================
PAYMENT_SVC_DB_HOST=payment_db
PAYMENT_SVC_DB_PORT=3306
PAYMENT_SVC_DB_USER=bmms_user
PAYMENT_SVC_DB_PASS=bmms_password
PAYMENT_SVC_DB_NAME=payment_db

# ==========================================
# PLATFORM SERVICES (if needed)
# ==========================================
API_GATEWAY_PORT=3000
LLM_ORCHESTRATOR_PORT=3001
RL_SCHEDULER_PORT=3002

# ==========================================
# KAFKA/REDPANDA CONFIGURATION
# ==========================================
#KAFKA_BROKER=redpanda-0:29092,redpanda-1:29092
# Development (local Docker)
KAFKA_BROKER=localhost:9092

# ==========================================
# JWT & SECURITY
# ==========================================
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
TOKEN_EXPIRE_TIME=24h

# ==========================================
# MAIL CONFIGURATION (if needed)
# ==========================================
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_FROM=noreply@bmms.com

# ==========================================
# FRONTEND
# ==========================================
FRONTEND_BASE_URL=http://localhost:4200
```

Then install dependencies for app

```bash
npm i
```

Run app

```bash
docker compose up -d
cd bmms
npm run start order-svc
```
# Docker
Create network for docker 
```bash
docker network create bmms-net
```
```bash
docker run -d --name customer-svc \
  --network bmms-net \
  --env-file .env \
  -p 3000:3000 \
  0xt4i/customer-service:0.0.1

docker run -d --name order-svc \
  --network bmms-net \
  --env-file .env \
  -p 3011:3011 \
  0xt4i/order-service:0.0.1

```
### Demo
using url: `http://localhost:3011/api/v1/orders`, test `order service`
```bash
{
  "customerId": 1,
  "notes": "Đơn hàng test tạo qua Postman",
  "shippingAddress": "123 Đường Lê Lợi, Quận 1, TP.HCM",
  "billingAddress": "123 Đường Lê Lợi, Quận 1, TP.HCM",
  "items": [
    {
      "productId": 101,
      "quantity": 2,
      "price": 150000,
      "notes": "Bọc quà giúp mình nha"
    },
    {
      "productId": 102,
      "quantity": 1,
      "price": 220000
    }
  ]
}
```

# Kubernetes:
Download https://minikube.sigs.k8s.io/docs/start/?arch=%2Flinux%2Fx86-64%2Fstable%2Fbinary+download

https://kompose.io/installation/

Ref https://devopscube.com/create-kubernetes-yaml/

Check node master on k8s
```bash
kubectl get nodes
```

Create namespace for project
```bash
kubectl create namespace project-1
```
convert docker-compose to kompose
```bash
kompose convert -f docker-compose.yaml -o k8s/
```

folder `k8s` created and store all file yaml.

deployment all file to k8s

```bash
kubectl apply -f k8s/ -n project-1
```