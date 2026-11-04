"""Deterministic decimal arithmetic for the legacy JSON earn endpoint.

This is compatibility hardening, not a substitute for the authoritative database
transaction. Monetary values are USDT and follow the endpoint's 4-decimal precision.
"""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

MONEY_QUANTUM = Decimal("0.0001")
MAX_PRINCIPAL = Decimal("1000000000000")
SECONDS_PER_YEAR = Decimal("31536000")


class EarnPolicyError(ValueError):
    pass


def money(value, *, positive=False, max_value=MAX_PRINCIPAL):
    """Parse a finite USDT amount, reject excess precision, and quantize exactly."""
    if isinstance(value, bool) or value is None:
        raise EarnPolicyError("金额格式错误")
    try:
        result = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, AttributeError):
        raise EarnPolicyError("金额格式错误") from None
    if not result.is_finite():
        raise EarnPolicyError("金额必须是有限数值")
    if result <= 0 and positive:
        raise EarnPolicyError("金额必须大于 0")
    if result < 0:
        raise EarnPolicyError("金额不能为负数")
    if result > max_value:
        raise EarnPolicyError("金额超过系统上限")
    try:
        quantized = result.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        raise EarnPolicyError("金额精度超出系统支持范围") from None
    if result != quantized:
        raise EarnPolicyError("USDT 金额最多支持 4 位小数")
    return quantized


def calculate_fixed_interest(principal, apy_percent, days):
    p = money(principal, positive=True)
    apy = Decimal(str(apy_percent))
    day_count = Decimal(str(days))
    if not apy.is_finite() or apy < 0 or not day_count.is_finite() or day_count < 0:
        raise EarnPolicyError("理财收益参数无效")
    return (p * apy / Decimal("100") * day_count / Decimal("365")).quantize(
        MONEY_QUANTUM, rounding=ROUND_HALF_UP
    )


def calculate_demand_interest(principal, apy_percent, elapsed_seconds):
    """Simple APY accrual prorated by actual elapsed seconds, rounded to 4 decimals."""
    p = money(principal, positive=True)
    apy = Decimal(str(apy_percent))
    elapsed = Decimal(str(max(0, elapsed_seconds)))
    if not apy.is_finite() or apy < 0 or not elapsed.is_finite():
        raise EarnPolicyError("理财收益参数无效")
    return (p * apy / Decimal("100") * elapsed / SECONDS_PER_YEAR).quantize(
        MONEY_QUANTUM, rounding=ROUND_HALF_UP
    )


def early_redemption_penalty(principal, fee_percent):
    p = money(principal, positive=True)
    fee = Decimal(str(fee_percent))
    if not fee.is_finite() or fee < 0 or fee > 1:
        raise EarnPolicyError("提前赎回费率无效")
    return (p * fee).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def decimal_to_storage(value):
    """Keep compatibility with the current JSON data schema (numeric JSON values)."""
    return float(Decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP))
