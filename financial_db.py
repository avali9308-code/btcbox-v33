"""Fail-closed Supabase RPC transport for financial lifecycle operations.

This module deliberately does not fall back to local JSON storage. It is transport
infrastructure; do not enable it as the balance authority until every balance-changing
path (including spot orders, admin adjustments, deposits, withdrawals and earn) is migrated.
"""
import hashlib
import json
import os
from decimal import Decimal, InvalidOperation, ROUND_DOWN
import urllib.error
import urllib.request


class FinancialDBError(RuntimeError):
    def __init__(self, message, status=None, detail=None):
        super().__init__(message)
        self.status = status
        self.detail = detail


class SupabaseFinancialRPC:
    def __init__(self, url=None, service_key=None, timeout=8):
        self.url = (url or os.environ.get("SUPABASE_URL", "")).rstrip("/")
        self.service_key = service_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.timeout = timeout
        if not self.url or not self.service_key:
            raise FinancialDBError("Supabase financial database is not configured")
        if not self.url.startswith("https://"):
            raise FinancialDBError("SUPABASE_URL must use HTTPS")

    def rpc(self, function_name, payload):
        if not function_name.replace("_", "").isalnum():
            raise FinancialDBError("Invalid RPC function name")
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        req = urllib.request.Request(
            f"{self.url}/rest/v1/rpc/{function_name}",
            data=body,
            method="POST",
            headers={
                "apikey": self.service_key,
                "Authorization": f"Bearer {self.service_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                raw = response.read(1024 * 1024)
                if response.status < 200 or response.status >= 300:
                    raise FinancialDBError("Financial RPC failed", response.status, raw.decode("utf-8", "replace"))
                try:
                    return json.loads(raw.decode("utf-8")) if raw else None
                except json.JSONDecodeError as exc:
                    raise FinancialDBError("Financial RPC returned invalid JSON") from exc
        except urllib.error.HTTPError as exc:
            detail = exc.read(4096).decode("utf-8", "replace")
            # Never expose credentials or full request payload in exception text.
            raise FinancialDBError("Financial RPC rejected request", exc.code, detail) from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            # Caller must treat timeout as an unknown outcome and retry with same idempotency key.
            raise FinancialDBError("Financial RPC transport failure; outcome may be unknown") from exc

    def execute_spot_trade(self, *, order_id, user_id, base_asset, quote_asset, side, order_type, price, quantity, idempotency_key, request_hash):
        """Atomically debit/credit both assets and persist the filled order.

        The caller must validate market/limit pricing and generate a stable idempotency
        key before the first attempt. On timeout, retry with the exact same arguments.
        """
        return self.rpc("execute_spot_trade_atomic", {
            "p_order_id": str(order_id), "p_user_id": str(user_id),
            "p_base_asset": str(base_asset).upper(), "p_quote_asset": str(quote_asset).upper(),
            "p_side": str(side).lower(), "p_order_type": str(order_type).lower(),
            "p_price": str(price), "p_quantity": str(quantity),
            "p_idempotency_key": str(idempotency_key), "p_request_hash": str(request_hash),
        })

    def create_withdrawal(self, *, withdrawal_id, user_id, asset, network, amount, fee, destination, request_id, request_hash):
        return self.rpc("create_withdrawal_atomic", {
            "p_withdrawal_id": str(withdrawal_id), "p_user_id": str(user_id),
            "p_asset": str(asset).upper(), "p_network": str(network),
            "p_amount": str(amount), "p_fee": str(fee), "p_destination": str(destination),
            "p_request_id": str(request_id), "p_request_hash": str(request_hash),
        })

    def review_withdrawal(self, *, withdrawal_id, admin_id, approve, reason=""):
        return self.rpc("review_withdrawal_atomic", {
            "p_withdrawal_id": str(withdrawal_id), "p_admin_id": str(admin_id),
            "p_approve": bool(approve), "p_reason": str(reason)[:200],
        })

    def confirm_deposit(self, *, deposit_id, admin_id):
        return self.rpc("confirm_deposit_atomic", {
            "p_deposit_id": str(deposit_id), "p_admin_id": str(admin_id),
        })

    def verify_and_credit_deposit(self, *, deposit_id, verifier_id, txid, asset, network, observed_amount, confirmations, required_confirmations, request_id):
        """Credit only a chain observation already verified by a trusted server-side verifier.

        Keep request_id stable across retries. This transport does not itself query a chain;
        the caller must verify transaction inclusion, destination, network, asset and finality.
        """
        try:
            amount = Decimal(str(observed_amount))
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise FinancialDBError("Invalid observed deposit amount") from exc
        if not amount.is_finite() or amount <= 0:
            raise FinancialDBError("Observed deposit amount must be finite and positive")
        if isinstance(confirmations, bool) or isinstance(required_confirmations, bool):
            raise FinancialDBError("Confirmation counts must be integers")
        if not isinstance(confirmations, int) or not isinstance(required_confirmations, int):
            raise FinancialDBError("Confirmation counts must be integers")
        if confirmations < required_confirmations or required_confirmations < 1:
            raise FinancialDBError("Deposit has insufficient confirmations")
        txid_normalized = str(txid).strip().lower()
        asset_normalized = str(asset).strip().upper()
        network_normalized = str(network).strip().lower()
        if len(txid_normalized) < 16 or not request_id or len(str(request_id)) < 16:
            raise FinancialDBError("Invalid transaction id or request id")
        normalized_amount = amount.quantize(Decimal("0.000000000000000001"), rounding=ROUND_DOWN)
        if normalized_amount != amount:
            raise FinancialDBError("Observed amount exceeds supported 18-decimal precision")
        amount_text = format(normalized_amount, "f")
        canonical = "|".join((str(deposit_id), txid_normalized, asset_normalized, network_normalized,
                              amount_text, str(confirmations), str(required_confirmations)))
        request_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return self.rpc("verify_and_credit_deposit_atomic", {
            "p_deposit_id": str(deposit_id), "p_verifier_id": str(verifier_id),
            "p_txid": txid_normalized, "p_asset": asset_normalized, "p_network": network_normalized,
            "p_observed_amount": amount_text, "p_confirmations": confirmations,
            "p_required_confirmations": required_confirmations, "p_request_id": str(request_id),
            "p_request_hash": request_hash,
        })

    def subscribe_earn(self, *, position_id, user_id, product_id, asset, principal, request_id, request_hash):
        return self.rpc("subscribe_earn_atomic", {
            "p_position_id": str(position_id), "p_user_id": str(user_id),
            "p_product_id": str(product_id), "p_asset": str(asset).upper(),
            "p_principal": str(principal), "p_request_id": str(request_id),
            "p_request_hash": str(request_hash),
        })

    def redeem_earn(self, *, position_id, user_id, request_id, request_hash):
        """Redeem using the database-snapshotted product policy; caller cannot set payout."""
        return self.rpc("redeem_earn_atomic", {
            "p_position_id": str(position_id), "p_user_id": str(user_id),
            "p_request_id": str(request_id), "p_request_hash": str(request_hash),
        })
