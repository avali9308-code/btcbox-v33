"""Fail-closed guard for BTCBOX's not-yet-completed financial storage migration.

The current server still mutates balances in local JSON. Selecting a database mode
before every financial path is migrated would create split-brain accounting. This
guard intentionally supports only legacy_json until a separately reviewed cutover.
"""
import os

SUPPORTED_MODE = "legacy_json"


class FinancialStorageModeError(RuntimeError):
    """Raised when deployment requests a storage mode this server cannot safely run."""


def validate_financial_storage_mode(mode=None):
    raw = os.environ.get("FINANCIAL_STORAGE_MODE", SUPPORTED_MODE) if mode is None else mode
    selected = str(raw).strip().lower()
    if selected != SUPPORTED_MODE:
        raise FinancialStorageModeError(
            "Unsafe FINANCIAL_STORAGE_MODE. This build still has JSON-backed financial "
            "paths; only 'legacy_json' is permitted until all balance reads/writes are "
            "migrated and staging reconciliation, concurrency, rollback, and restore "
            "tests are approved. No database fallback is performed."
        )
    return selected
