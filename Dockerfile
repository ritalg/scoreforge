# Single-stage build to avoid cross-stage native module issues
FROM node:20-alpine
WORKDIR /app

# Build tools for native modules (better-sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++

# Install all workspace deps (scripts enabled for native compilation)
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY shared/package.json ./shared/
RUN npm ci

# Copy source
COPY shared ./shared/
COPY server ./server/
COPY client ./client/

# Build server TypeScript
RUN cd server && npm run build

# Build client (Vite)
RUN cd client && npx vite build

# Remove dev dependencies and source (keep dist + node_modules)
RUN npm prune --omit=dev
RUN rm -rf server/src client/src

RUN mkdir -p /app/data && chown node:node /app/data

USER node

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/scoreforge.db

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
