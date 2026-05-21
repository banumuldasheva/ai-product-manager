# Stage 1: build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: install backend production deps
# sqlite3 is optional and may fail on alpine — that's fine, Render uses Postgres
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 3: runtime image
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app/backend
COPY backend/ ./
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3001
CMD ["node", "server.js"]
