# Use Debian-based image for glibc compatibility with better-sqlite3 prebuilt binaries
FROM node:20-slim
WORKDIR /app

# Build tools needed for native modules if prebuilt binaries don't match
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install all workspace deps
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

RUN mkdir -p /app/data /app/uploads && chown node:node /app/data /app/uploads

USER node

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/scoreforge.db
ENV UPLOAD_DIR=/app/uploads

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3001/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "server/dist/index.js"]
