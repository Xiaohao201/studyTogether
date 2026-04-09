"""Add study room tables.

Revision ID: 003
Revises: 002
Create Date: 2026-04-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema — idempotent."""

    conn = op.get_bind()

    # Create study_rooms table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS study_rooms (
            id UUID PRIMARY KEY,
            room_code VARCHAR(20) NOT NULL,
            host_id UUID NOT NULL,
            subject VARCHAR(100),
            room_status VARCHAR(20) NOT NULL DEFAULT 'waiting',
            focus_duration INTEGER NOT NULL DEFAULT 25,
            break_duration INTEGER NOT NULL DEFAULT 5,
            started_at TIMESTAMP WITH TIME ZONE,
            ended_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """))

    for idx_name, col in [
        ('ix_study_rooms_id', 'id'),
        ('ix_study_rooms_host_id', 'host_id'),
        ('ix_study_rooms_status', 'room_status'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON study_rooms ({col})"
        ))
    conn.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_study_rooms_room_code ON study_rooms (room_code)"
    ))

    # Create study_room_participants table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS study_room_participants (
            id UUID PRIMARY KEY,
            study_room_id UUID NOT NULL,
            user_id UUID NOT NULL,
            joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            left_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT uq_study_room_participant UNIQUE (study_room_id, user_id)
        )
    """))

    for idx_name, col in [
        ('ix_study_room_participants_id', 'id'),
        ('ix_study_room_participants_room_id', 'study_room_id'),
        ('ix_study_room_participants_user_id', 'user_id'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON study_room_participants ({col})"
        ))

    # Create study_room_messages table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS study_room_messages (
            id UUID PRIMARY KEY,
            study_room_id UUID NOT NULL,
            user_id UUID NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """))

    for idx_name, col in [
        ('ix_study_room_messages_id', 'id'),
        ('ix_study_room_messages_room_id', 'study_room_id'),
        ('ix_study_room_messages_user_id', 'user_id'),
        ('ix_study_room_messages_created_at', 'created_at'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON study_room_messages ({col})"
        ))

    # Add foreign keys only if they don't exist
    existing_fks = {
        row[0] for row in conn.execute(sa.text(
            "SELECT conname FROM pg_constraint WHERE contype = 'f'"
        ))
    }

    if 'fk_study_rooms_host_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE study_rooms ADD CONSTRAINT fk_study_rooms_host_id "
            "FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE"
        ))
    if 'fk_study_room_participants_room_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE study_room_participants ADD CONSTRAINT fk_study_room_participants_room_id "
            "FOREIGN KEY (study_room_id) REFERENCES study_rooms(id) ON DELETE CASCADE"
        ))
    if 'fk_study_room_participants_user_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE study_room_participants ADD CONSTRAINT fk_study_room_participants_user_id "
            "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        ))
    if 'fk_study_room_messages_room_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE study_room_messages ADD CONSTRAINT fk_study_room_messages_room_id "
            "FOREIGN KEY (study_room_id) REFERENCES study_rooms(id) ON DELETE CASCADE"
        ))
    if 'fk_study_room_messages_user_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE study_room_messages ADD CONSTRAINT fk_study_room_messages_user_id "
            "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        ))


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_table('study_room_messages')
    op.drop_table('study_room_participants')
    op.drop_table('study_rooms')
