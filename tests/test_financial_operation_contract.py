import unittest
from decimal import Decimal
from financial_operation_contract import (
    FinancialContractError, amount_to_db_text, normalize_asset, parse_amount,
    request_fingerprint, validate_idempotency_key, validate_transition,
    require_unique_references,
)

class FinancialOperationContractTests(unittest.TestCase):
    def test_decimal_string_exact(self):
        self.assertEqual(parse_amount("0.123400"), Decimal("0.123400"))

    def test_rejects_float(self):
        with self.assertRaises(FinancialContractError): parse_amount(0.1)

    def test_rejects_bool_and_nonfinite(self):
        for value in (True, "NaN", "Infinity", "-Infinity", None):
            with self.subTest(value=value), self.assertRaises(FinancialContractError): parse_amount(value)

    def test_rejects_negative_zero_and_excess_precision(self):
        with self.assertRaises(FinancialContractError): parse_amount("-1")
        with self.assertRaises(FinancialContractError): parse_amount("0")
        with self.assertRaises(FinancialContractError): parse_amount("1.123456", max_scale=4)

    def test_allow_zero_is_explicit(self):
        self.assertEqual(parse_amount("0", allow_zero=True), Decimal(0))

    def test_fixed_point_format(self):
        self.assertEqual(amount_to_db_text(Decimal("1.23"), scale=4), "1.2300")

    def test_fixed_point_rejects_rounding(self):
        with self.assertRaises(FinancialContractError): amount_to_db_text(Decimal("1.23456"), scale=4)

    def test_asset_normalization(self):
        self.assertEqual(normalize_asset(" usdc "), "USDC")
        with self.assertRaises(FinancialContractError): normalize_asset("USD/USDC")

    def test_idempotency_key(self):
        self.assertEqual(validate_idempotency_key("req-12345678"), "req-12345678")
        for value in ("short", "", None, "bad key 123"):
            with self.subTest(value=value), self.assertRaises(FinancialContractError): validate_idempotency_key(value)

    def test_fingerprint_stable_and_asset_normalized(self):
        kwargs = dict(operation="withdrawal", actor_id="u1", asset="usdc", amount=Decimal("1.00"), business_ref="w-1")
        self.assertEqual(request_fingerprint(**kwargs), request_fingerprint(**{**kwargs, "asset": "USDC", "amount": Decimal("1.0")}))
        self.assertEqual(len(request_fingerprint(**kwargs)), 64)

    def test_business_reference_required_for_sensitive_actions(self):
        with self.assertRaises(FinancialContractError):
            request_fingerprint(operation="deposit_confirm", actor_id="admin", asset="USDC", amount=Decimal("2"))

    def test_valid_withdrawal_transitions(self):
        validate_transition("withdrawal", "pending", "approved")
        validate_transition("withdrawal", "pending", "rejected")

    def test_rejects_terminal_and_skipped_transitions(self):
        for args in (("withdrawal", "confirmed", "approved"), ("deposit", "pending", "confirmed"), ("earn", "redeemed", "redeemed")):
            with self.subTest(args=args), self.assertRaises(FinancialContractError): validate_transition(*args)

    def test_unknown_entity_type(self):
        with self.assertRaises(FinancialContractError): validate_transition("bonus", "pending", "paid")

    def test_duplicate_business_refs(self):
        require_unique_references(["a", "b"])
        with self.assertRaises(FinancialContractError): require_unique_references(["a", "a"])

if __name__ == "__main__": unittest.main()
