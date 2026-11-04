"""Shared validation primitives for future database-backed financial operations.

These helpers are deliberately not wired into JSON-backed routes yet: doing so for
only some routes would create inconsistent validation and an unsafe partial cutover.
They define the contract that each DB RPC and route must implement before enabling it.
"""
from __future__ import annotations

import hashlib
import re
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from typing import Iterable

_IDEMPOTENCY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$")
_ASSET_RE = re.compile(r"^[A-Z0-9]{2,16}$")
_MAX_AMOUNT = Decimal("1e30")


class FinancialContractError(ValueError):
    """A request violates the shared financial-operation contract."""


def parse_amount(value, *, field="amount", allow_zero=False, max_scale=18) -> Decimal:
    """Parse an exact decimal amount; reject bool, float NaN/Inf, negatives and excess scale."""
    if isinstance(value, bool) or value is None:
        raise FinancialContractError(f"invalid_{field}")
    # Accept decimal strings and integers only. Floats are rejected because their
    # binary representation may already have lost the caller's intended precision.
    if not isinstance(value, (str, int, Decimal)):
        raise FinancialContractError(f"invalid_{field}")
    raw = str(value).strip()
    if not raw or len(raw) > 128:
        raise FinancialContractError(f"invalid_{field}")
    try:
        amount = Decimal(raw)
    except (InvalidOperation, ValueError):
        raise FinancialContractError(f"invalid_{field}") from None
    if not amount.is_finite() or abs(amount) > _MAX_AMOUNT:
        raise FinancialContractError(f"invalid_{field}")
    if amount < 0 or (amount == 0 and not allow_zero):
        raise FinancialContractError(f"invalid_{field}")
    exponent = amount.as_tuple().exponent
    scale = max(0, -exponent)
    if scale > max_scale:
        raise FinancialContractError(f"excess_precision_{field}")
    return amount


def amount_to_db_text(amount: Decimal, *, scale: int = 18) -> str:
    """Render a Decimal to fixed-point text without scientific notation or rounding up."""
    if not isinstance(amount, Decimal) or not amount.is_finite():
        raise FinancialContractError("invalid_amount")
    quantum = Decimal(1).scaleb(-scale)
    quantized = amount.quantize(quantum, rounding=ROUND_DOWN)
    if quantized != amount:
        raise FinancialContractError("excess_precision_amount")
    return format(quantized, "f")


def normalize_asset(asset) -> str:
    if not isinstance(asset, str):
        raise FinancialContractError("invalid_asset")
    normalized = asset.strip().upper()
    if not _ASSET_RE.fullmatch(normalized):
        raise FinancialContractError("invalid_asset")
    return normalized


def validate_idempotency_key(key) -> str:
    if not isinstance(key, str):
        raise FinancialContractError("idempotency_key_required")
    normalized = key.strip()
    if not _IDEMPOTENCY_RE.fullmatch(normalized):
        raise FinancialContractError("invalid_idempotency_key")
    return normalized


def request_fingerprint(*, operation: str, actor_id: str, asset: str,
                        amount: Decimal, business_ref: str = "") -> str:
    """Hash canonical request fields; do not include secrets or free-form PII."""
    if not operation or not actor_id or not business_ref and operation in {"withdrawal_review", "deposit_confirm", "earn_redeem"}:
        raise FinancialContractError("missing_business_reference")
    if not isinstance(amount, Decimal) or not amount.is_finite() or amount < 0:
        raise FinancialContractError("invalid_amount")
    canonical = "\n".join((operation.strip().lower(), actor_id.strip(),
                           normalize_asset(asset), format(amount.normalize(), "f"),
                           business_ref.strip()))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# Allowed lifecycle transitions are intentionally conservative. Historical legacy
# statuses must be mapped explicitly before these transitions are used in production.
STATUS_TRANSITIONS = {
    "withdrawal": {
        "pending": frozenset({"approved", "rejected"}),
        "approved": frozenset({"broadcast", "failed"}),
        "broadcast": frozenset({"confirmed", "failed"}),
        "rejected": frozenset(), "confirmed": frozenset(), "failed": frozenset(),
    },
    "deposit": {
        "pending": frozenset({"confirming", "rejected"}),
        "confirming": frozenset({"confirmed", "rejected"}),
        "confirmed": frozenset(), "rejected": frozenset(),
    },
    "earn": {
        "active": frozenset({"redeemed", "matured"}),
        "matured": frozenset({"redeemed"}), "redeemed": frozenset(),
    },
    "order": {
        "pending": frozenset({"open", "cancelled", "rejected"}),
        "open": frozenset({"partially_filled", "filled", "cancelled"}),
        "partially_filled": frozenset({"partially_filled", "filled", "cancelled"}),
        "filled": frozenset(), "cancelled": frozenset(), "rejected": frozenset(),
    },
}


def validate_transition(entity_type: str, current: str, target: str) -> None:
    transitions = STATUS_TRANSITIONS.get(str(entity_type).lower())
    if transitions is None:
        raise FinancialContractError("unknown_entity_type")
    current, target = str(current).lower(), str(target).lower()
    if current not in transitions or target not in transitions[current]:
        raise FinancialContractError("invalid_status_transition")


def require_unique_references(references: Iterable[str]) -> None:
    seen = set()
    for ref in references:
        normalized = str(ref)
        if normalized in seen:
            raise FinancialContractError("duplicate_business_reference")
        seen.add(normalized)
