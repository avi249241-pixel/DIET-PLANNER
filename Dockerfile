# syntax=docker/dockerfile:1
FROM oven/bun:1-slim AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Copy application source
COPY . .

# Build static client bundle and server bundle
RUN bun run build

# Default production environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run unified backend on Fly.io
CMD ["bun", "run", "server.ts"]
