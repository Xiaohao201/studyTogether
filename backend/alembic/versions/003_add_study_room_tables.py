"""Add study room tables.

Revision ID: 003
Revises: 002
Create Date: 2026-04-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""

    # Create study_rooms table
    op.create_table(
        'study_rooms',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('room_code', sa.String(20), nullable=False, unique=True),
        sa.Column('host_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subject', sa.String(100), nullable=True),
        sa.Column('room_status', sa.String(20), nullable=False, server_default='waiting'),
        sa.Column('focus_duration', sa.Integer(), nullable=False, server_default='25'),
        sa.Column('break_duration', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_study_rooms_id', 'study_rooms', ['id'])
    op.create_index('ix_study_rooms_room_code', 'study_rooms', ['room_code'], unique=True)
    op.create_index('ix_study_rooms_host_id', 'study_rooms', ['host_id'])
    op.create_index('ix_study_rooms_status', 'study_rooms', ['room_status'])

    # Create study_room_participants table
    op.create_table(
        'study_room_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('study_room_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('study_room_id', 'user_id', name='uq_study_room_participant'),
    )
    op.create_index('ix_study_room_participants_id', 'study_room_participants', ['id'])
    op.create_index('ix_study_room_participants_room_id', 'study_room_participants', ['study_room_id'])
    op.create_index('ix_study_room_participants_user_id', 'study_room_participants', ['user_id'])

    # Create study_room_messages table
    op.create_table(
        'study_room_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('study_room_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_study_room_messages_id', 'study_room_messages', ['id'])
    op.create_index('ix_study_room_messages_room_id', 'study_room_messages', ['study_room_id'])
    op.create_index('ix_study_room_messages_user_id', 'study_room_messages', ['user_id'])
    op.create_index('ix_study_room_messages_created_at', 'study_room_messages', ['created_at'])

    # Create foreign key constraints
    op.create_foreign_key(
        'fk_study_rooms_host_id',
        'study_rooms', 'users',
        ['host_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_study_room_participants_room_id',
        'study_room_participants', 'study_rooms',
        ['study_room_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_study_room_participants_user_id',
        'study_room_participants', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_study_room_messages_room_id',
        'study_room_messages', 'study_rooms',
        ['study_room_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_study_room_messages_user_id',
        'study_room_messages', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Downgrade database schema."""

    op.drop_table('study_room_messages')
    op.drop_table('study_room_participants')
    op.drop_table('study_rooms')
