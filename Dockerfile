# Stage 1: Build
FROM node:22.22.2-bookworm-slim AS builder

# Prisma needs openssl
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma configuration and source
COPY prisma ./prisma/
COPY prisma.config.ts tsconfig.json ./
COPY src ./src

# Generate Prisma Client and compile TypeScript
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate
RUN npm run build


# Stage 2: Production
FROM node:22.22.2-bookworm-slim AS runner

ENV NODE_ENV=production

# Prisma needs openssl
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies and remove the caches to reduce image size
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force 

# Copy compiled application (includes generated Prisma Client)
COPY --from=builder /app/dist ./dist

# Run as non-root
USER node

EXPOSE 3000

CMD ["node", "dist/src/server.js"]
