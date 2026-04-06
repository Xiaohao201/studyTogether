# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source files (including lib, components, etc.)
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY store ./store
COPY types ./types
COPY public ./public
COPY next.config.js ./
COPY next-env.d.ts ./
COPY tsconfig.json ./

# List files to debug
RUN ls -la && echo "=== lib directory ===" && ls -la lib/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy required files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
