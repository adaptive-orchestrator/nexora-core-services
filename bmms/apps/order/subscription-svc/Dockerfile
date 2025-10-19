# Build stage
FROM node:22-alpine AS builder
WORKDIR /usr/app/
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /usr/app/
COPY --from=builder /usr/app/dist ./dist
COPY package.json  ./
ENV NODE_ENV=production
RUN npm install --omit=dev
CMD ["npm", "start"]