from decimal import Decimal

from data.percentage import percentage


def test_percentage_uses_postgresql_numeric_rounding() -> None:
    assert percentage(29, 32) == Decimal("90.63")
    assert percentage(1, 8) == Decimal("12.50")
