# ── Stage 1: Build shared package ────────────────────────────────────────────
FROM node:20-alpine AS shared-builder
WORKDIR /app
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src/
WORKDIR /app/shared
RUN npm install && npm run build

# ── Stage 2: Build client ─────────────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY shared/package.json ./shared/
RUN npm ci --workspace=client --workspace=shared --ignore-scripts

COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/package.json ./shared/
COPY client ./client/

WORKDIR /app/client
RUN npm run build

# ── Stage 3: Build server ─────────────────────────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci --workspace=server --workspace=shared --ignore-scripts

COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/package.json ./shared/
COPY server ./server/

WORKDIR /app/server
RUN npm run build

# ── Stage 4: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install production deps only
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci --workspace=server --workspace=shared --omit=dev --ignore-scripts

# Copy built artefacts
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/package.json ./shared/
COPY --from=client-builder /app/client/dist ./client/dist

# Data directory for SQLite
RUN mkdir -p /app/data && chown node:node /app/data

USER node

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/scoreforge.db

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
