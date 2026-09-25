FROM node:22.20.0-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

FROM node:22.20.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg postgresql-client \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/.sequelizerc ./
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/config ./config
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/gads-backend-entrypoint
RUN mkdir -p /app/private /app/logs \
    && chown node:node /app/private /app/logs \
    && chmod 0555 /usr/local/bin/gads-backend-entrypoint
USER node
EXPOSE 8080
ENTRYPOINT ["gads-backend-entrypoint"]
CMD ["node", "dist/server.js"]
