# ==============================
# 🧱 Stage 1 — Build
# ==============================
FROM node:22-alpine AS builder

# Tạo thư mục làm việc
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ source code vào container
COPY . .

# Build NestJS (output sẽ vào ./dist)
RUN npm run build

# ==============================
# 🚀 Stage 2 — Production
# ==============================
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy chỉ những gì cần cho runtime
COPY --from=builder /usr/src/app/dist ./dist
COPY package*.json ./

# Cài dependencies production (nhanh hơn, nhẹ hơn)
RUN npm install --omit=dev

# Đặt biến môi trường
ENV NODE_ENV=production

# Expose port (thay bằng port service bạn muốn)
EXPOSE 3011

# Command start service
CMD ["node", "dist/main.js"]
