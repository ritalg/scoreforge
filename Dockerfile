# ── Stage 1: Build client ─────────────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY shared/package.json ./shared/
RUN npm ci --workspace=client --workspace=shared --ignore-scripts

COPY shared ./shared/
COPY client ./client/

WORKDIR /app/client
RUN npx vite build

# ── Stage 2: Build server ─────────────────────────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /app

# Need python3/make/g++ to compile native modules (better-sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci --workspace=server --workspace=shared

COPY shared ./shared/
COPY server ./server/

WORKDIR /app/server
RUN npm run build

# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copy package manifests so Node resolves workspaces correctly
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Copy compiled native node_modules from builder (includes .node binaries)
COPY --from=server-builder /app/node_modules ./node_modules

COPY shared ./shared/
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p /app/data && chown node:node /app/data

USER node

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/scoreforge.db

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
