import uuid
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services import inventory_service


def _locked_query(first_result):
    query = Mock()
    query.filter.return_value = query
    query.with_for_update.return_value = query
    query.first.return_value = first_result
    return query


def test_adjustment_creates_missing_product_colour_size_variant(monkeypatch):
    product_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    product = SimpleNamespace(id=product_id)
    product_query = _locked_query(product)
    variant_query = _locked_query(None)
    db = Mock()
    db.query.side_effect = [product_query, variant_query]
    created = []
    db.add.side_effect = created.append
    db.flush.side_effect = lambda: setattr(created[0], "id", uuid.uuid4())
    monkeypatch.setattr(inventory_service.audit_service, "log_event", Mock())

    variant = inventory_service.adjust_product_variant_stock(
        db,
        product_id=product_id,
        colour="Black",
        size="38",
        adjustment=2,
        reason="Correction",
        actor_id=actor_id,
    )

    assert variant is created[0]
    assert (variant.product_id, variant.colour, variant.size, variant.stock_quantity) == (
        product_id,
        "Black",
        "38",
        2,
    )
    db.commit.assert_called_once()


def test_adjustment_cannot_create_negative_stock_variant():
    product_id = uuid.uuid4()
    db = Mock()
    db.query.side_effect = [_locked_query(SimpleNamespace(id=product_id)), _locked_query(None)]
    db.add.side_effect = lambda variant: setattr(variant, "id", uuid.uuid4())

    with pytest.raises(inventory_service.NegativeStockAdjustmentError):
        inventory_service.adjust_product_variant_stock(
            db,
            product_id=product_id,
            colour="Black",
            size="38",
            adjustment=-1,
            reason="Correction",
            actor_id=uuid.uuid4(),
        )

    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_adjustment_cannot_create_variant_with_unsupported_colour():
    product_id = uuid.uuid4()
    db = Mock()
    db.query.side_effect = [_locked_query(SimpleNamespace(id=product_id)), _locked_query(None)]

    with pytest.raises(inventory_service.UnsupportedVariantColourError):
        inventory_service.adjust_product_variant_stock(
            db,
            product_id=product_id,
            colour="Green",
            size="38",
            adjustment=1,
            reason="Correction",
            actor_id=uuid.uuid4(),
        )

    db.commit.assert_not_called()
