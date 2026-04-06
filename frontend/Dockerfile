# Build stage
FROM node:18-alpine AS builder

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

# Build application with verbose output
RUN npm run build -- --no-lint 2>&1 | tee build.log || \
    (echo "=== BUILD FAILED ===" && \
     cat build.log && \
     echo "=== CHECKING FILE STRUCTURE ===" && \
     find . -name "*.tsx" -o -name "*.ts" | head -20 && \
     exit 1)

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
