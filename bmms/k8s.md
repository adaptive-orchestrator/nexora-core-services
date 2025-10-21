# BMMS – Triển khai Kubernetes với Minikube

Tài liệu này hướng dẫn cách chạy các microservice order, billing, payment và hạ tầng redpanda trên Minikube, mỗi dịch vụ trong một namespace riêng.

## 1) Khởi động Minikube
```bash
minikube start --driver=docker
```
### Kiểm tra trạng thái
```bash
minikube status
```

|> Mẹo: nếu dùng images build cục bộ, hãy nạp vào Minikube:
```bash
minikube image load 0xt4i/order-service:0.0.1
minikube image load 0xt4i/billing-service:0.0.1
minikube image load 0xt4i/payment-service:0.0.1
```
## 2) Tạo namespaces
```bash
kubectl create namespace order
kubectl create namespace billing
kubectl create namespace payment
kubectl create namespace infras
```
Xem danh sách namespace:

```bash
kubectl get namespaces
```
## 3) Apply manifests theo namespace
```bash
kubectl apply -f k8s/order   -n order
kubectl apply -f k8s/billing -n billing
kubectl apply -f k8s/payment -n payment
kubectl apply -f k8s/infras  -n infras
```

Theo dõi Pod khởi tạo:
```bash
kubectl get pods -A -w
```

## 4) Truy cập dịch vụ từ máy ngoài (2 cách)
### Cách A – NodePort (khuyến nghị cho dev)

Lấy IP của Minikube:

```bash
minikube ip
```

Xem NodePort của service:

```bash
kubectl get svc -n order
```

Gọi API (ví dụ order-service NodePort 30011):

```bash
curl -X POST http://$(minikube ip):30011/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "notes": "Đơn test",
    "shippingAddress": "...",
    "billingAddress": "...",
    "items": [
      { "productId": 101, "quantity": 2, "price": 150000 },
      { "productId": 102, "quantity": 1, "price": 220000 }
    ]
  }'
```

Lưu ý: Service YAML phải là type: NodePort. Ví dụ:

```bash
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: order
spec:
  type: NodePort
  selector:
    io.kompose.service: order-service
  ports:
    - name: http
      port: 3011
      targetPort: 3011
      nodePort: 30011    # trong khoảng 30000–32767
```
### Cách B – Port-forward (nhanh, dùng khi chưa mở NodePort)
```bash
kubectl port-forward -n order svc/order-service 3011:3011
```
rồi gọi: http://localhost:3011/api/v1/orders

## 5) Xem log & sự kiện

```bash
Log ứng dụng (theo label io.kompose.service)
kubectl logs -n order   -l io.kompose.service=order-service   --tail=100 -f
kubectl logs -n billing -l io.kompose.service=billing-service --tail=100 -f
kubectl logs -n payment -l io.kompose.service=payment-service --tail=100 -f
```

### Sự kiện (Events): mô tả toàn bộ Pod theo label rồi grep Events (tăng A để xem thêm dòng)
```bash
kubectl describe pod -n order   -l io.kompose.service=order-service   | grep -A 20 ^Events
kubectl describe pod -n billing -l io.kompose.service=billing-service | grep -A 20 ^Events
kubectl describe pod -n payment -l io.kompose.service=payment-service | grep -A 20 ^Events
```
### Redpanda (Kafka)
```bash
# Tên pod có thể là redpanda-0 hoặc khác; dùng label nếu có
kubectl logs -n infras redpanda-0 --previous
kubectl get svc -n infras
```
## 6) Cập nhật & triển khai lại
Cách nhanh – rollout restart
```bash
kubectl rollout restart deployment -n order   --all
kubectl rollout restart deployment -n billing --all
kubectl rollout restart deployment -n payment --all
kubectl rollout restart deployment -n infras  --all
```
Xoá pod cho clean start (ít dùng hơn)
```bash
kubectl delete pods --all -n order
kubectl delete pods --all -n billing
kubectl delete pods --all -n payment
kubectl delete pods --all -n infras
```
## 7) Kiểm tra Storage (nếu DB/PVC bị kẹt)
```bash
kubectl get pvc,pv -A
kubectl describe pvc -n order
kubectl describe pod -n order -l io.kompose.service=order-db | grep -A 20 ^Events
```
## 8) Lỗi thường gặp & cách xử lý nhanh

- Không gọi được NodePort
→ Kiểm tra minikube ip, kubectl get svc -n <ns>, firewall host.

- Image không kéo được trong Minikube
→ minikube image load <image:tag> rồi kubectl rollout restart ….

- DB Pod chờ PVC
→ Kiểm tra pvc/pv & addon storage-provisioner trong Minikube.

- Kafka/Redpanda Connection Refused
→ Đảm bảo service/port đúng, broker dùng DNS nội bộ:
redpanda.infras.svc.cluster.local:9092.

## 9) Lệnh nhanh khác
```bash
# xem tất cả pod theo dõi thời gian thực
kubectl get pods -A -w

# xem service theo namespace
kubectl get svc -n order
kubectl get svc -n billing
kubectl get svc -n payment
kubectl get svc -n infras
```
Gợi ý: lưu file này thành README.md ở thư mục gốc repo để mọi người cùng team dùng chung.