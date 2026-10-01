import uuid
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.stock_receiving import DirectReceiveBatchRequest, ReceivingBatchCreate


def test_receiving_batch_requires_at_least_one_line():
    with pytest.raises(ValidationError):
        ReceivingBatchCreate(items=[])


def test_receiving_batch_rejects_non_positive_quantity():
    with pytest.raises(ValidationError):
        ReceivingBatchCreate(
            items=[
                {
                    "product_id": str(uuid.uuid4()),
                    "quantity_submitted": 0,
                    "price_submitted": "10.00",
                }
            ]
        )


def test_direct_receive_batch_accepts_variant_lines():
    product_id = uuid.uuid4()
    request = DirectReceiveBatchRequest(
        items=[
            {
                "product_id": product_id,
                "colour": "Black",
                "size": "40",
                "quantity": 2,
                "price": "1500.00",
            },
            {
                "product_id": product_id,
                "colour": "Black",
                "size": "41",
                "quantity": 3,
                "price": "1500.00",
            },
        ]
    )

    assert len(request.items) == 2
    assert request.items[0].product_id == product_id
    assert request.items[0].price == Decimal("1500.00")


def test_direct_receive_batch_rejects_empty_payload():
    with pytest.raises(ValidationError):
        DirectReceiveBatchRequest(items=[])
