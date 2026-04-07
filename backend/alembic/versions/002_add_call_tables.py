"""Add call rooms and call participants tables.

Revision ID: 002
Revises: 001
Create Date: 2026-04-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""

    # Create call_rooms table
    op.create_table(
        'call_rooms',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('room_code', sa.String(20), nullable=False, unique=True),
        sa.Column('host_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('call_type', sa.Enum('voice', 'video', name='call_type'), nullable=False),
        sa.Column('call_status', sa.Enum('initiated', 'ongoing', 'ended', 'rejected', name='call_status'), nullable=False, server_default='initiated'),
        sa.Column('study_session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
    )
    op.create_index('ix_call_rooms_id', 'call_rooms', ['id'])
    op.create_index('ix_call_rooms_room_code', 'call_rooms', ['room_code'], unique=True)
    op.create_index('ix_call_rooms_host_id', 'call_rooms', ['host_id'])
    op.create_index('ix_call_rooms_status', 'call_rooms', ['call_status'])
    op.create_index('ix_call_rooms_started_at', 'call_rooms', ['started_at'])

    # Create call_participants table
    op.create_table(
        'call_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('call_room_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('has_video', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('has_audio', sa.Boolean(), nullable=False, server_default='true'),
    )
    op.create_index('ix_call_participants_id', 'call_participants', ['id'])
    op.create_index('ix_call_participants_call_room_id', 'call_participants', ['call_room_id'])
    op.create_index('ix_call_participants_user_id', 'call_participants', ['user_id'])
    op.create_index('ix_call_participants_call_user', 'call_participants', ['call_room_id', 'user_id'])

    # Create foreign key constraints
    op.create_foreign_key(
        'fk_call_rooms_host_id',
        'call_rooms', 'users',
        ['host_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_call_rooms_study_session_id',
        'call_rooms', 'study_sessions',
        ['study_session_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_call_participants_call_room_id',
        'call_participants', 'call_rooms',
        ['call_room_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_call_participants_user_id',
        'call_participants', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Downgrade database schema."""

    # Drop tables
    op.drop_table('call_participants')
    op.drop_table('call_rooms')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS call_status')
    op.execute('DROP TYPE IF EXISTS call_type')
