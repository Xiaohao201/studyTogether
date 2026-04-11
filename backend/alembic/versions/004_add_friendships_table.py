"""Add friendships table.

Revision ID: 004
Revises: 003
Create Date: 2026-04-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema — idempotent."""

    conn = op.get_bind()

    # Create friendships table if not exists
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS friendships (
            id UUID PRIMARY KEY,
            requester_id UUID NOT NULL,
            addressee_id UUID NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """))

    # Add unique constraint if not exists
    existing_constraints = {
        row[0] for row in conn.execute(sa.text(
            "SELECT conname FROM pg_constraint WHERE contype = 'u'"
        ))
    }
    if 'uq_friendship_pair' not in existing_constraints:
        conn.execute(sa.text(
            "ALTER TABLE friendships ADD CONSTRAINT uq_friendship_pair "
            "UNIQUE (requester_id, addressee_id)"
        ))

    # Add foreign keys only if they don't exist
    existing_fks = {
        row[0] for row in conn.execute(sa.text(
            "SELECT conname FROM pg_constraint WHERE contype = 'f'"
        ))
    }

    if 'fk_friendships_requester_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE friendships ADD CONSTRAINT fk_friendships_requester_id "
            "FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE"
        ))
    if 'fk_friendships_addressee_id' not in existing_fks:
        conn.execute(sa.text(
            "ALTER TABLE friendships ADD CONSTRAINT fk_friendships_addressee_id "
            "FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE"
        ))

    # Add indexes if not exist
    for idx_name, col in [
        ('ix_friendships_id', 'id'),
        ('ix_friendships_requester_id', 'requester_id'),
        ('ix_friendships_addressee_id', 'addressee_id'),
        ('ix_friendships_status', 'status'),
    ]:
        conn.execute(sa.text(
            f"CREATE INDEX IF NOT EXISTS {idx_name} ON friendships ({col})"
        ))

    # Partial index for pending requests
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_friendships_pending "
        "ON friendships (addressee_id) WHERE status = 'pending'"
    ))


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_table('friendships')
