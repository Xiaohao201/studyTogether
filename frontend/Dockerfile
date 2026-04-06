# Build stage
FROM node:18-alpine AS builder

# Force cache invalidation
ARG CACHEBUST=2025-04-06-14

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source code
COPY . .

# List files for debugging
RUN echo "=== Directory structure ===" && \
    ls -la && \
    echo "" && \
    echo "=== lib directory ===" && \
    ls -la lib/ && \
    echo "" && \
    echo "=== components directory ===" && \
    ls -la components/

# Build application
RUN npm run build

# Check if standalone was created
RUN echo "=== Checking .next directory ===" && \
    ls -la .next/ && \
    echo "" && \
    echo "=== Checking for standalone ===" && \
    ls -la .next/standalone/ || echo "standalone not found"

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy all files (using simpler approach without standalone)
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Start application with npm start
CMD ["npm", "start"]
