# ── Build stage ──
FROM oven/bun:1-alpine AS build

WORKDIR /app

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

# Compile to single binary
RUN cd services/connector && bun build --compile --minify src/index.ts --outfile /app/connector

# ── Runtime stage ──
FROM gcr.io/distroless/cc-debian12

COPY --from=build /app/connector /connector

# Auth state on tmpfs (keys in memory only)
ENV AUTH_DIR=/tmp/wa-auth

CMD ["/connector"]
