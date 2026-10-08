"""Canonical percentage calculation shared by generation and validation."""

from decimal import Decimal, ROUND_HALF_UP, localcontext


HUNDRED = Decimal("100")
TWO_DECIMAL_PLACES = Decimal("0.01")


def percentage(numerator: int, denominator: int) -> Decimal:
    if denominator == 0:
        raise ValueError("percentage denominator must not be zero")

    with localcontext() as context:
        context.prec = 50
        value = Decimal(numerator) * HUNDRED / Decimal(denominator)
        return value.quantize(TWO_DECIMAL_PLACES, rounding=ROUND_HALF_UP)
