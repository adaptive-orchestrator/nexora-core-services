# Hướng Dẫn Triển Khai Code Indexer lên Kubernetes với Helm Chart

## Tổng Quan Dịch Vụ

**Service**: `code-indexer`
**Mục đích**: Index source code vào Qdrant vector database để hỗ trợ RAG (Retrieval-Augmented Generation)
**Dockerfile**: `Dockerfile.code-indexer`

### Chức Năng Chính
- Quét codebase theo pattern cấu hình
- Tạo embeddings sử dụng Gemini API
- Lưu vectors vào Qdrant
- Hỗ trợ 2 mode:
  - **One-time mode**: Chạy một lần rồi exit
  - **Watch mode**: Chạy liên tục và re-index theo interval

## Yêu Cầu Triển Khai

### 1. Biến Môi Trường Cần Thiết

#### Biến Nhạy Cảm (Cần dùng Kubernetes Secret)
```yaml
GEMINI_API_KEY=AIzaSyA7UFOQTT0oL5P_0lwW1UMzQDiT0UHYb44
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
TOKEN_EXPIRE_TIME=24h
```

#### Biến Cấu Hình Thông Thường (Dùng ConfigMap)
```yaml
# RAG & LLM Configuration
USE_RAG=true
EMBEDDING_PROVIDER=gemini
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=codebase_embeddings
RECREATE_COLLECTION=true

# Workspace Configuration
WORKSPACE_PATH=/workspace/bmms
INDEX_MODE=minimal

# Watch Mode Configuration
WATCH_MODE=true
WATCH_INTERVAL_HOURS=6
INCLUDE_PATTERNS=**/*.service.ts,**/*.controller.ts,**/*.module.ts
```

### 2. Dependencies
- **Qdrant Service**: Dịch vụ code-indexer cần kết nối đến Qdrant database
- **Source Code Access**: Cần mount source code vào container tại WORKSPACE_PATH

## Vấn Đề Cần Giải Quyết

### Vấn Đề 1: Dockerfile Issues
**File hiện tại**: `Dockerfile.code-indexer` có lỗi syntax ở line 26:
```dockerfile
ARG TOKEN_EXPIRE_TIME:   # Dấu : thừa
```

**Yêu cầu**: Fix lỗi này trước khi build image

### Vấn Đề 2: Source Code Mount
**Vấn đề**: WORKSPACE_PATH hiện tại là `C:/Users/vulin/Desktop/repo-root/bmms` (Windows local path)

**Giải pháp có thể áp dụng** (chọn 1 trong các cách sau):

#### Option A: Git-Sync Sidecar (Recommended)
- Sử dụng git-sync container để clone/sync code từ Git repository
- Mount shared volume giữa git-sync và code-indexer container
- Auto-update khi có thay đổi trong repo

#### Option B: ConfigMap Mount
- Mount source code files qua ConfigMap (chỉ phù hợp với codebase nhỏ < 1MB)

#### Option C: Persistent Volume
- Tạo PVC và copy source code vào đó
- Mount PVC vào container

#### Option D: Init Container
- Dùng init container để git clone code vào shared volume
- Main container sử dụng code từ volume đó

### Vấn Đề 3: Deployment Type
**Cần xác định**:
- Nếu `WATCH_MODE=true` → Dùng **Deployment** (long-running service)
- Nếu `WATCH_MODE=false` → Dùng **Job** hoặc **CronJob** (one-time execution)

## Cấu Trúc Helm Chart Cần Tạo

```
helm-charts/code-indexer/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
└── templates/
    ├── _helpers.tpl
    ├── configmap.yaml
    ├── secret.yaml
    ├── deployment.yaml (hoặc job.yaml nếu one-time)
    ├── service.yaml (optional - nếu cần expose metrics/health check)
    ├── pvc.yaml (nếu dùng persistent storage)
    └── NOTES.txt
```

## Yêu Cầu Chi Tiết Cho Từng File

### 1. Chart.yaml
```yaml
apiVersion: v2
name: code-indexer
description: A Helm chart for BMMS Code Indexer service
type: application
version: 0.1.0
appVersion: "1.0"
```

### 2. values.yaml (Template)
Cần define các values sau:

```yaml
# Image configuration
image:
  repository: <registry>/bmms-code-indexer
  tag: latest
  pullPolicy: IfNotPresent

# Deployment mode
mode: deployment  # deployment | job | cronjob

# Watch mode configuration
watchMode:
  enabled: true
  intervalHours: 6

# Resource limits
resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi

# Source code configuration
sourceCode:
  # Strategy: git-sync | configmap | pvc | init-container
  strategy: git-sync
  gitSync:
    repo: <git-repo-url>
    branch: develop
    depth: 1
  mountPath: /workspace/bmms

# Qdrant configuration
qdrant:
  url: http://qdrant:6333
  collection: codebase_embeddings
  recreateCollection: true

# Embedding configuration
embedding:
  provider: gemini
  indexMode: minimal
  includePatterns: "**/*.service.ts,**/*.controller.ts,**/*.module.ts"

# Secrets (reference to existing secrets)
secrets:
  geminiApiKey: <from-external-secret>
  jwtSecret: <from-external-secret>

# ConfigMap data
config:
  useRag: true
  tokenExpireTime: 24h
```

### 3. templates/configmap.yaml
Tạo ConfigMap chứa các biến môi trường non-sensitive

### 4. templates/secret.yaml
Tạo Secret chứa:
- GEMINI_API_KEY
- JWT_SECRET
- TOKEN_EXPIRE_TIME (hoặc có thể để trong ConfigMap)

### 5. templates/deployment.yaml
Nếu `mode: deployment`:
- Định nghĩa Deployment với replica: 1 (hoặc configurable)
- Mount ConfigMap và Secret
- Mount source code volume (theo strategy đã chọn)
- Có liveness/readiness probe nếu cần
- Environment variables injection

### 6. templates/job.yaml (Alternative)
Nếu `mode: job`:
- Định nghĩa Job với backoffLimit, ttlSecondsAfterFinished
- Các mount và env tương tự deployment

### 7. Git-Sync Sidecar (Nếu chọn strategy git-sync)
Trong deployment/job, thêm:
- Init container hoặc sidecar chạy git-sync
- Shared emptyDir volume giữa git-sync và code-indexer
- Cấu hình git-sync container:
  - Image: `registry.k8s.io/git-sync/git-sync:v4.0.0`
  - Args: repo URL, branch, sync period, destination path

## Checklist Triển Khai

- [ ] Fix lỗi syntax trong Dockerfile.code-indexer (line 26)
- [ ] Build và push Docker image lên registry
- [ ] Tạo cấu trúc thư mục Helm chart
- [ ] Viết Chart.yaml
- [ ] Viết values.yaml với các giá trị mặc định
- [ ] Viết templates/configmap.yaml
- [ ] Viết templates/secret.yaml (hoặc sử dụng External Secrets Operator)
- [ ] Viết templates/deployment.yaml hoặc job.yaml
- [ ] Cấu hình source code mounting strategy (git-sync recommended)
- [ ] Test Helm chart locally: `helm template code-indexer ./helm-charts/code-indexer`
- [ ] Deploy lên K8s cluster: `helm install code-indexer ./helm-charts/code-indexer`
- [ ] Verify pods running: `kubectl get pods -l app=code-indexer`
- [ ] Check logs: `kubectl logs -f <pod-name>`
- [ ] Verify Qdrant có vectors: Query Qdrant API để check collection

## Lưu Ý Quan Trọng

### Security
1. **KHÔNG** hardcode GEMINI_API_KEY trong values.yaml
2. Sử dụng External Secrets Operator hoặc sealed-secrets để quản lý secrets
3. Giới hạn RBAC permissions cho service account

### Performance
1. Nếu codebase lớn, cần tăng resources (memory/cpu)
2. Watch mode sẽ giữ pod running liên tục → cần monitor resource usage
3. Cân nhắc sử dụng node affinity nếu cần GPU cho embedding

### Networking
1. Code-indexer chỉ cần outbound connection đến:
   - Qdrant service (internal)
   - Gemini API (external - internet)
2. KHÔNG cần expose service ra ngoài (trừ khi cần metrics endpoint)

### Storage
1. Nếu dùng git-sync, emptyDir là đủ (ephemeral storage)
2. Nếu cần persistence, dùng PVC với RWO access mode

## Example Commands

### Install Helm Chart
```bash
helm install code-indexer ./helm-charts/code-indexer \
  --namespace bmms \
  --create-namespace \
  --values values-dev.yaml
```

### Upgrade Release
```bash
helm upgrade code-indexer ./helm-charts/code-indexer \
  --namespace bmms \
  --values values-dev.yaml
```

### Debug
```bash
# Dry-run và xem generated manifests
helm install code-indexer ./helm-charts/code-indexer --dry-run --debug

# Check pod logs
kubectl logs -f -n bmms -l app=code-indexer

# Exec into pod
kubectl exec -it -n bmms <pod-name> -- sh

# Check mounted source code
kubectl exec -it -n bmms <pod-name> -- ls -la /workspace/bmms
```

## Câu Hỏi Cần Làm Rõ

1. **Registry**: Docker image sẽ push lên registry nào? (Docker Hub, GCR, ECR, Private registry?)
2. **Git Repository**: Source code BMMS có sẵn trên Git repository không? URL là gì?
3. **Qdrant**: Qdrant đã được deploy trên K8s cluster chưa? Service name là gì?
4. **Secrets Management**: Có sử dụng External Secrets Operator hay sealed-secrets không?
5. **Namespace**: Deploy vào namespace nào? (`bmms`, `default`, hay namespace khác?)
6. **Watch Mode**: Production có cần watch mode không hay chỉ chạy one-time indexing?
7. **Resource Limits**: Cluster có resource constraints gì không?

## Kết Luận

Hãy thực hiện theo checklist trên, bắt đầu từ việc fix Dockerfile, sau đó tạo từng template file của Helm chart. Ưu tiên sử dụng git-sync strategy để mount source code vì nó flexible và auto-update được.

Nếu cần example code chi tiết cho từng template file, hãy yêu cầu cụ thể cho file nào.
