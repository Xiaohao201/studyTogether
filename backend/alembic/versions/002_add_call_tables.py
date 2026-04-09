"""Add call rooms and call participants tables.

Revision ID: 002
Revises: 001
Create Date: 2026-04-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
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

    if 'call_type' not in existing_enums:
        conn.execute(sa.text(
            "CREATE TYPE call_type AS ENUM ('voice', 'video')"
        ))
    if 'call_status' not in existing_enums:
        conn.execute(sa.text(
            "CREATE TYPE call_status AS ENUM ('initiated', 'ongoing', 'ended', 'rejected')"
        ))

    # Create call_rooms table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS call_rooms (
            id UUID PRIMARY KEY,
            room_code VARCHAR(20) NOT NULL,
            host_id UUID NOT NULL,
            call_type call_type NOT NULL,
            call_status call_status NOT NULL DEFAULT 'initiated',
            study_session_id UUID,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMP WITH TIME ZONE,
            duration_seconds INTEGER
        )
    """))

    for idx_name, col in [
        ('ix_call_rooms_id', 'id'),
        ('ix_call_rooms_host_id', 'host_id'),
        ('ix_call_rooms_status', 'call_status'),
        ('ix_call_rooms_started_at', 'started_at'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON call_rooms ({col})"
        ))
    conn.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_call_rooms_room_code ON call_rooms (room_code)"
    ))

    # Create call_participants table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS call_participants (
            id UUID PRIMARY KEY,
            call_room_id UUID NOT NULL,
            user_id UUID NOT NULL,
            joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            left_at TIMESTAMP WITH TIME ZONE,
            has_video BOOLEAN NOT NULL DEFAULT true,
            has_audio BOOLEAN NOT NULL DEFAULT true
        )
    """))

    for idx_name, col in [
        ('ix_call_participants_id', 'id'),
        ('ix_call_participants_call_room_id', 'call_room_id'),
        ('ix_call_participants_user_id', 'user_id'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON call_participants ({col})"
        ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_call_participants_call_user "
        "ON call_participants (call_room_id, user_id)"
    ))

    # Add foreign keys only if they don't exist
    existing_fks = {
        row[0] for row in conn.execute(sa.text(
            "SELECT conname FROM pg_constraint WHERE contype = 'f'"
        ))
    }

    if 'fk_call_rooms_host_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE call_rooms ADD CONSTRAINT fk_call_rooms_host_id "
            "FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE"
        ))
    if 'fk_call_rooms_study_session_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE call_rooms ADD CONSTRAINT fk_call_rooms_study_session_id "
            "FOREIGN KEY (study_session_id) REFERENCES study_sessions(id) ON DELETE SET NULL"
        ))
    if 'fk_call_participants_call_room_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE call_participants ADD CONSTRAINT fk_call_participants_call_room_id "
            "FOREIGN KEY (call_room_id) REFERENCES call_rooms(id) ON DELETE CASCADE"
        ))
    if 'fk_call_participants_user_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE call_participants ADD CONSTRAINT fk_call_participants_user_id "
            "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        ))


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_table('call_participants')
    op.drop_table('call_rooms')
    op.execute('DROP TYPE IF EXISTS call_status')
    op.execute('DROP TYPE IF EXISTS call_type')
