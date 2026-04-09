FROM python:3.11-slim

# Force rebuild timestamp
ARG CACHEBUST=2025-04-08-03

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Print deployment info for debugging
RUN echo "Build timestamp: $CACHEBUST" && \
    echo "Python version:" && python --version && \
    echo "Files in app:" && ls -la app/

# Expose port
EXPOSE 8000

# Start server: run migrations first, then uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:socket_app --host 0.0.0.0 --port ${PORT:-8000}"]
