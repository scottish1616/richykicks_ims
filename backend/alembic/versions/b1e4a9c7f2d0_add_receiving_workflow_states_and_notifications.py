"""add receiving workflow states and notifications

Revision ID: b1e4a9c7f2d0
Revises: 967cf441f847
Create Date: 2026-09-14 20:41:13.677896

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1e4a9c7f2d0'
down_revision = '967cf441f847'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres requires ADD VALUE on a native enum type to run outside
    # a transaction block, and the new value can't be referenced in the
    # same transaction it was added in - autocommit_block() handles
    # both by committing immediately after each ALTER TYPE.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE receivingsessionstatus ADD VALUE IF NOT EXISTS 'STAFF_COMPLETED'")
        op.execute("ALTER TYPE receivingsessionstatus ADD VALUE IF NOT EXISTS 'CLOSED'")

    op.add_column(
        'stock_receiving_sessions', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'stock_receiving_sessions', sa.Column('completed_by', sa.UUID(), nullable=True)
    )
    op.add_column(
        'stock_receiving_sessions', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'stock_receiving_sessions', sa.Column('rejection_reason', sa.String(length=500), nullable=True)
    )
    op.add_column(
        'stock_receiving_sessions', sa.Column('reopened_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'stock_receiving_sessions', sa.Column('reopened_by', sa.UUID(), nullable=True)
    )
    op.add_column(
        'stock_receiving_sessions', sa.Column('reopen_reason', sa.String(length=500), nullable=True)
    )
    op.create_foreign_key(
        'fk_receiving_sessions_completed_by', 'stock_receiving_sessions', 'users', ['completed_by'], ['id']
    )
    op.create_foreign_key(
        'fk_receiving_sessions_reopened_by', 'stock_receiving_sessions', 'users', ['reopened_by'], ['id']
    )

    # Any session that was mid-flight under the old 4-state workflow
    # (staff had already submitted, awaiting admin action) maps onto
    # the new CLOSED state - the closest equivalent of "ready for admin
    # verification". Nothing here touches inventory.
    op.execute("UPDATE stock_receiving_sessions SET status = 'CLOSED' WHERE status = 'PENDING'")

    # Do NOT pre-create this enum type separately - passing it directly
    # in the column list below is enough; create_table() creates any
    # enum type that doesn't exist yet exactly once. Creating it twice
    # (once here, once implicitly) is what caused the DuplicateObject
    # error.
    notification_type = sa.Enum(
        'RECEIVING_COMPLETED', 'RECEIVING_APPROVED', 'RECEIVING_REJECTED', name='notificationtype'
    )

    op.create_table(
        'notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('type', notification_type, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.String(length=1000), nullable=False),
        sa.Column('receiving_session_id', sa.UUID(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id']),
        sa.ForeignKeyConstraint(['receiving_session_id'], ['stock_receiving_sessions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_recipient_id'), 'notifications', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_recipient_id'), table_name='notifications')
    op.drop_table('notifications')
    sa.Enum(name='notificationtype').drop(op.get_bind())

    op.drop_constraint('fk_receiving_sessions_reopened_by', 'stock_receiving_sessions', type_='foreignkey')
    op.drop_constraint('fk_receiving_sessions_completed_by', 'stock_receiving_sessions', type_='foreignkey')
    op.drop_column('stock_receiving_sessions', 'reopen_reason')
    op.drop_column('stock_receiving_sessions', 'reopened_by')
    op.drop_column('stock_receiving_sessions', 'reopened_at')
    op.drop_column('stock_receiving_sessions', 'rejection_reason')
    op.drop_column('stock_receiving_sessions', 'verified_at')
    op.drop_column('stock_receiving_sessions', 'completed_by')
    op.drop_column('stock_receiving_sessions', 'completed_at')

    # Postgres cannot drop enum values. Any session left in
    # STAFF_COMPLETED/CLOSED at downgrade time is remapped back to
    # PENDING so the column stays valid under the old 4-state model;
    # the STAFF_COMPLETED/CLOSED labels themselves remain defined on
    # the type going forward (harmless if unused).
    op.execute(
        "UPDATE stock_receiving_sessions SET status = 'PENDING' "
        "WHERE status IN ('STAFF_COMPLETED', 'CLOSED')"
    )
