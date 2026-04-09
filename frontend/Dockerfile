# Build stage
FROM node:18-alpine AS builder

# Force cache invalidation
ARG CACHEBUST=2025-04-09-01

# NEXT_PUBLIC_ vars must be available at BUILD time for Next.js to inline them
ARG NEXT_PUBLIC_BACKEND_URL=https://studytogether-production.up.railway.app
ARG NEXT_PUBLIC_AMAP_KEY=8ae086b6aa1a363f43ab92e23f8e6a4d
ARG NEXT_PUBLIC_AMAP_SECRET=06e6de0b22b9fa3b5afe7a033eee484e
ARG NEXT_PUBLIC_METERED_TURN_URL=https://studytogether.metered.live/api/v1/turn/credentials?apiKey=d5543fb314e942a78f45f984d64bcdebc12c

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_AMAP_KEY=$NEXT_PUBLIC_AMAP_KEY
ENV NEXT_PUBLIC_AMAP_SECRET=$NEXT_PUBLIC_AMAP_SECRET
ENV NEXT_PUBLIC_METERED_TURN_URL=$NEXT_PUBLIC_METERED_TURN_URL

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source code
COPY . .

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
# Copy public directory if it exists from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Try to copy public directory if it exists (Next.js apps may not have one)
RUN mkdir -p ./public || true

# Expose port
EXPOSE 3000

# Start application with npm start
CMD ["npm", "start"]
