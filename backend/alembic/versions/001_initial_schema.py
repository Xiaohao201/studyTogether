"""Initial schema: users, user_locations, study_sessions tables.

Revision ID: 001
Revises:
Create Date: 2026-01-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema — idempotent."""

    conn = op.get_bind()

    # Create ENUM types only if they don't exist
    existing_enums = {
        row[0] for row in conn.execute(
            sa.text("SELECT typname FROM pg_type WHERE typtype = 'e'")
        )
    }

    if 'user_status' not in existing_enums:
        conn.execute(sa.text(
            "CREATE TYPE user_status AS ENUM ('studying', 'break', 'offline')"
        ))
    if 'privacy_mode' not in existing_enums:
        conn.execute(sa.text(
            "CREATE TYPE privacy_mode AS ENUM ('exact', 'fuzzy', 'invisible')"
        ))

    # Create users table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            email VARCHAR(255) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            subject VARCHAR(100),
            status user_status NOT NULL DEFAULT 'offline',
            study_duration_minutes INTEGER NOT NULL DEFAULT 0,
            privacy_mode privacy_mode NOT NULL DEFAULT 'fuzzy',
            show_exact_to_friends BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """))

    # Create indexes only if they don't exist
    for idx_name, col in [
        ('ix_users_id', 'id'),
        ('ix_users_status', 'status'),
        ('ix_users_last_seen_at', 'last_seen_at'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON users ({col})"
        ))
    for idx_name, col, unique in [
        ('ix_users_email', 'email', True),
        ('ix_users_username', 'username', True),
    ]:
        conn.execute(sa.text(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {idx_name} ON users ({col})"
        ))

    # Try PostGIS extension (optional)
    try:
        conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS postgis'))
    except Exception:
        pass

    # Create user_locations table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS user_locations (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            latitude NUMERIC(10, 8) NOT NULL,
            longitude NUMERIC(11, 8) NOT NULL,
            fuzzy_latitude NUMERIC(10, 8),
            fuzzy_longitude NUMERIC(11, 8),
            country_code VARCHAR(2),
            city VARCHAR(100),
            district VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """))

    for idx_name, col in [
        ('ix_user_locations_id', 'id'),
        ('ix_user_locations_user_id', 'user_id'),
        ('ix_user_locations_created_at', 'created_at'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON user_locations ({col})"
        ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_user_locations_user_created "
        "ON user_locations (user_id, created_at)"
    ))

    # Add coordinates columns if they don't exist (PostGIS, optional)
    try:
        conn.execute(sa.text(
            "SELECT coordinates FROM user_locations LIMIT 0"
        ))
    except Exception:
        try:
            conn.execute(sa.text(
                "ALTER TABLE user_locations ADD COLUMN coordinates GEOGRAPHY(POINT, 4326)"
            ))
            conn.execute(sa.text(
                "ALTER TABLE user_locations ADD COLUMN fuzzy_coordinates GEOGRAPHY(POINT, 4326)"
            ))
            conn.execute(sa.text(
                "CREATE INDEX IF NOT EXISTS ix_user_locations_fuzzy_coordinates_gist "
                "ON user_locations USING GIST (fuzzy_coordinates)"
            ))
        except Exception:
            pass

    # Create study_sessions table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS study_sessions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            subject VARCHAR(100) NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMP WITH TIME ZONE,
            duration_minutes INTEGER,
            participants_count INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """))

    for idx_name, col in [
        ('ix_study_sessions_id', 'id'),
        ('ix_study_sessions_user_id', 'user_id'),
        ('ix_study_sessions_started_at', 'started_at'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON study_sessions ({col})"
        ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_study_sessions_active "
        "ON study_sessions (user_id, started_at) WHERE ended_at IS NULL"
    ))

    # Add foreign keys only if they don't exist
    existing_fks = {
        row[0] for row in conn.execute(sa.text(
            "SELECT conname FROM pg_constraint WHERE contype = 'f'"
        ))
    }

    if 'fk_user_locations_user_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE user_locations ADD CONSTRAINT fk_user_locations_user_id "
            "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        ))
    if 'fk_study_sessions_user_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE study_sessions ADD CONSTRAINT fk_study_sessions_user_id "
            "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        ))


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_table('study_sessions')
    op.drop_table('user_locations')
    op.drop_table('users')
    op.execute('DROP TYPE IF EXISTS privacy_mode')
    op.execute('DROP TYPE IF EXISTS user_status')
