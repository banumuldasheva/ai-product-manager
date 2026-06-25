# syntax=docker/dockerfile:1

# ---- Stage 1: build the React client ----
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: install server deps (with native toolchain for better-sqlite3) ----
FROM node:22-slim AS server-deps
WORKDIR /app/server
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci --omit=dev

# ---- Stage 3: slim runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# server dependencies (native bindings compiled in the previous stage)
COPY --from=server-deps /app/server/node_modules ./server/node_modules
# server source
COPY server/ ./server/
# built client, served by Express in production
COPY --from=client-build /app/client/dist ./client/dist

# Render injects $PORT; the server falls back to 3001 locally.
EXPOSE 3001
CMD ["node", "server/index.js"]
