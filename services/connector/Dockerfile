# ── Build stage ──
FROM node:22-slim AS build

WORKDIR /app

# Install bun for dependency resolution
RUN npm install -g bun

# Copy workspace root files
COPY package.json bun.lock ./

# Copy shared package
COPY shared/ ./shared/

# Copy connector package
COPY services/connector/package.json ./services/connector/

# Install dependencies
RUN cd services/connector && bun install --frozen-lockfile

# Copy connector source
COPY services/connector/src/ ./services/connector/src/

# Copy convex generated types (needed for imports)
COPY convex/_generated/ ./convex/_generated/
COPY convex/connector.ts ./convex/

# ── Runtime stage ──
FROM node:22-slim

WORKDIR /app

# Copy everything from build stage
COPY --from=build /app ./

# Auth state on tmpfs (keys in memory only)
ENV AUTH_DIR=/tmp/wa-auth
ENV CONNECTOR_MODE=supervisor

WORKDIR /app/services/connector

EXPOSE 8080

CMD ["node", "--import", "tsx", "src/index.ts"]
