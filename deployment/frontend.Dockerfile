# Build stage
FROM node:20 AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN npx vite build

# Production Nginx stage
FROM nginx:alpine

# Replace the stock Nginx welcome page with the Vite dashboard output.
# This project configures Vite to emit the browser bundle under dist/public.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/public/ /usr/share/nginx/html/

# Custom Nginx config to support SPA client routing and proxying API/auth/trpc traffic
RUN echo 'server { ' \
    '    listen 80; ' \
    '    location / { ' \
    '        root /usr/share/nginx/html; ' \
    '        try_files $uri $uri/ /index.html; ' \
    '    } ' \
    '    location /api/ { ' \
    '        proxy_pass http://backend:8080/api/; ' \
    '        proxy_http_version 1.1; ' \
    '        proxy_set_header Upgrade $http_upgrade; ' \
    '        proxy_set_header Connection "upgrade"; ' \
    '        proxy_set_header Host $host; ' \
    '        proxy_cache_bypass $http_upgrade; ' \
    '    } ' \
    '    location /health/ { ' \
    '        proxy_pass http://backend:8080/health/; ' \
    '        proxy_http_version 1.1; ' \
    '        proxy_set_header Host $host; ' \
    '    } ' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
