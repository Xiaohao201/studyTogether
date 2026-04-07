FROM python:3.11-slim

# Force rebuild timestamp
ARG CACHEBUST=2025-04-07-13

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

# Start server (migrations will be run manually after deployment)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
