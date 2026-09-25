FROM node:22.20.0-bookworm-slim AS builder

WORKDIR /app
ARG REACT_APP_BACKEND_URL=https://api.glauberads.com.br
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:1.27.5-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
RUN find /usr/share/nginx/html -type d -exec chmod 0755 {} + \
    && find /usr/share/nginx/html -type f -exec chmod 0644 {} +
EXPOSE 3000
