FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_API_URL=https://university-materiality-api.onrender.com
ARG PAGES_BASE_PATH=
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV PAGES_BASE_PATH=$PAGES_BASE_PATH
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
