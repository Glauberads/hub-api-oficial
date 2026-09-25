FROM node:22.20.0-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps
RUN npx prisma generate
COPY . .
RUN mkdir -p public && npm run build

FROM node:22.20.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/gads-api-entrypoint
RUN chmod 0555 /usr/local/bin/gads-api-entrypoint
USER node
EXPOSE 6000
ENTRYPOINT ["gads-api-entrypoint"]
CMD ["node", "dist/main.js"]
