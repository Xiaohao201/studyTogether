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
    """Upgrade database schema."""

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(100), nullable=True),
        sa.Column('status', sa.Enum('studying', 'break', 'offline', name='user_status'), nullable=False),
        sa.Column('study_duration_minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('privacy_mode', sa.Enum('exact', 'fuzzy', 'invisible', name='privacy_mode'), nullable=False),
        sa.Column('show_exact_to_friends', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_status', 'users', ['status'])
    op.create_index('ix_users_last_seen_at', 'users', ['last_seen_at'])

    # Create user_locations table with PostGIS support
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')

    op.create_table(
        'user_locations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('latitude', sa.Numeric(10, 8), nullable=False),
        sa.Column('longitude', sa.Numeric(11, 8), nullable=False),
        sa.Column('fuzzy_latitude', sa.Numeric(10, 8), nullable=True),
        sa.Column('fuzzy_longitude', sa.Numeric(11, 8), nullable=True),
        sa.Column('coordinates', postgresql.GEOGRAPHY('POINT', srid=4326, spatial_index=False), nullable=True),
        sa.Column('fuzzy_coordinates', postgresql.GEOGRAPHY('POINT', srid=4326), nullable=True),
        sa.Column('country_code', sa.String(2), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('district', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_user_locations_id', 'user_locations', ['id'])
    op.create_index('ix_user_locations_user_id', 'user_locations', ['user_id'])
    op.create_index('ix_user_locations_created_at', 'user_locations', ['created_at'])
    op.create_index('ix_user_locations_user_created', 'user_locations', ['user_id', 'created_at'])

    # Create GiST index for fuzzy_coordinates (PostGIS spatial index)
    op.execute('CREATE INDEX ix_user_locations_fuzzy_coordinates_gist ON user_locations USING GIST (fuzzy_coordinates)')

    # Create study_sessions table
    op.create_table(
        'study_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subject', sa.String(100), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('participants_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_study_sessions_id', 'study_sessions', ['id'])
    op.create_index('ix_study_sessions_user_id', 'study_sessions', ['user_id'])
    op.create_index('ix_study_sessions_started_at', 'study_sessions', ['started_at'])
    op.create_index('ix_study_sessions_active', 'study_sessions', ['user_id', 'started_at'], postgresql_where=sa.text('ended_at IS NULL'))

    # Create foreign key constraints
    op.create_foreign_key(
        'fk_user_locations_user_id',
        'user_locations', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_study_sessions_user_id',
        'study_sessions', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Downgrade database schema."""

    # Drop tables
    op.drop_table('study_sessions')
    op.drop_table('user_locations')
    op.drop_table('users')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS privacy_mode')
    op.execute('DROP TYPE IF EXISTS user_status')
