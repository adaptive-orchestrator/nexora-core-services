# ==============================
# Stage 1 — Build
# ==============================
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ==============================
# Stage 2 — Production
# ==============================
FROM node:22-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist ./dist
COPY package*.json ./
ENV NODE_ENV=production
RUN npm install --omit=dev

EXPOSE 3000

CMD ["npm", "run" ,"start"]