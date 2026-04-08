#!/bin/bash
# Railway deployment startup script
# Expands Railway variable templates before starting the application

set -e

echo "==================================="
echo "[INFO] Starting StudyTogether Backend"
echo "==================================="

# Expand Railway variable templates in DATABASE_URL
# Railway uses ${{VARIABLE}} syntax for service references
if [[ "$DATABASE_URL" == *"${{"*"}}}"* ]]; then
    echo "[INFO] Expanding Railway variable templates in DATABASE_URL..."

    # Extract variables from DATABASE_URL template
    # Example: postgresql+asyncpg://${{Postgres.PGUSER}}:${{Postgres.POSTGRES_PASSWORD}}@...

    # Get values from Railway environment
    PGUSER="${PGUSER:-postgres}"
    PGDATABASE="${PGDATABASE:-railway}"

    # Try to get password from Railway's Postgres service
    # In Railway, these are available as environment variables
    if [ -n "$POSTGRES_PASSWORD" ]; then
        # Use the POSTGRES_PASSWORD if available
        :
    else
        # Try to get from Railway's internal reference
        echo "[WARNING] POSTGRES_PASSWORD not found, trying alternative methods..."
    fi

    # Manually construct DATABASE_URL if we have all components
    if [ -n "$PGUSER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$RAILWAY_PRIVATE_DOMAIN" ] && [ -n "$PGDATABASE" ]; then
        export DATABASE_URL="postgresql+asyncpg://${PGUSER}:${POSTGRES_PASSWORD}@${RAILWAY_PRIVATE_DOMAIN}:5432/${PGDATABASE}"
        echo "[INFO] DATABASE_URL constructed successfully"
        echo "[DEBUG] DATABASE_URL (partially masked): postgresql+asyncpg://${PGUSER}:***@${RAILWAY_PRIVATE_DOMAIN}:5432/${PGDATABASE}"
    else
        echo "[ERROR] Missing required database connection variables:"
        echo "  PGUSER: ${PGUSER:+set}"
        echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:+set}"
        echo "  RAILWAY_PRIVATE_DOMAIN: ${RAILWAY_PRIVATE_DOMAIN:+set}"
        echo "  PGDATABASE: ${PGDATABASE:+set}"
        echo ""
        echo "[INFO] All environment variables:"
        env | grep -E "(DATABASE|POSTGRES|PG|RAILWAY)" | sort
        exit 1
    fi
fi

echo ""
echo "[INFO] Running database migrations..."
alembic upgrade head

echo ""
echo "[INFO] Starting FastAPI server..."
exec uvicorn app.main:socket_app --host 0.0.0.0 --port "${PORT:-8000}"
