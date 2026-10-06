import pytest
from pydantic import ValidationError

from app.schemas.product import ProductVariantAdjustmentRequest, StockAdjustmentRequest


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


def test_product_variant_adjustment_accepts_supported_colour_and_no_colour():
    payload = ProductVariantAdjustmentRequest(
        colour="black", size="38", adjustment=2, reason="Correction"
    )
    no_colour = ProductVariantAdjustmentRequest(
        colour=None, size=None, adjustment=1, reason="Standard stock correction"
    )

    assert payload.colour == "black"
    assert payload.size == "38"
    assert no_colour.colour is None


def test_product_variant_adjustment_accepts_existing_legacy_colour_labels():
    payload = ProductVariantAdjustmentRequest(
        colour="Legacy Colour", size="38", adjustment=1, reason="Correction"
    )

    assert payload.colour == "Legacy Colour"
