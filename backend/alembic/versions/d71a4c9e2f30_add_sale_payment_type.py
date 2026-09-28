"""add payment type to sales

Revision ID: d71a4c9e2f30
Revises: c4d8f61a9e2b
Create Date: 2026-09-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d71a4c9e2f30"
down_revision = "c4d8f61a9e2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales",
        sa.Column("payment_type", sa.String(length=10), server_default="cash", nullable=False),
    )
    op.create_check_constraint(
        "ck_sales_payment_type_valid",
        "sales",
        "payment_type IN ('cash', 'mpesa')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_sales_payment_type_valid", "sales", type_="check")
    op.drop_column("sales", "payment_type")