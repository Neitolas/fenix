FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY backend/operations/demo_catalog.json /app/backend/operations/demo_catalog.json
RUN npm run build
FROM nginx:1.28-alpine
COPY --from=frontend /app/frontend/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080 8443 9080
