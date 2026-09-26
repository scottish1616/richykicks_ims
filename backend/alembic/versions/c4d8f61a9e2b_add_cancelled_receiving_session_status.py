"""add cancelled receiving session status

Revision ID: c4d8f61a9e2b
Revises: b1e4a9c7f2d0
Create Date: 2026-09-25 23:45:43.238516

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'c4d8f61a9e2b'
down_revision = 'b1e4a9c7f2d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Same reasoning as the STAFF_COMPLETED/CLOSED migration: ADD VALUE
    # on a native Postgres enum must run outside a transaction block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE receivingsessionstatus ADD VALUE IF NOT EXISTS 'CANCELLED'")


def downgrade() -> None:
    # Postgres cannot drop enum values. Any session left CANCELLED at
    # downgrade time is remapped to OPEN (the state it would have been
    # in before cancellation was possible) so the column stays valid
    # under the prior model; the CANCELLED label itself remains
    # defined on the type going forward (harmless if unused).
    op.execute("UPDATE stock_receiving_sessions SET status = 'OPEN' WHERE status = 'CANCELLED'")
