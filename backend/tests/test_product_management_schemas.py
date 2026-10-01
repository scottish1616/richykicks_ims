import pytest
from pydantic import ValidationError

from app.schemas.product import StockAdjustmentRequest


def test_stock_adjustment_accepts_signed_nonzero_amount_and_reason():
    payload = StockAdjustmentRequest(adjustment=-2, reason="Physical stock count")

    assert payload.adjustment == -2
    assert payload.reason == "Physical stock count"


def test_stock_adjustment_rejects_zero_amount():
    with pytest.raises(ValidationError):
        StockAdjustmentRequest(adjustment=0, reason="Stock count")


def test_stock_adjustment_requires_reason():
    with pytest.raises(ValidationError):
        StockAdjustmentRequest(adjustment=2, reason=" ")
