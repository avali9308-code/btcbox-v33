import unittest
from decimal import Decimal
from earn_policy import (
    EarnPolicyError, money, calculate_fixed_interest,
    calculate_demand_interest, early_redemption_penalty,
)


class Round71EarnDecimalPolicyTests(unittest.TestCase):
    def test_money_rejects_nonfinite_negative_and_excess_precision(self):
        for value in ('NaN', 'Infinity', '-Infinity', '-0.0001', '1.00001', True, None):
            with self.subTest(value=value), self.assertRaises(EarnPolicyError):
                money(value, positive=True)

    def test_money_rejects_values_over_configured_limit(self):
        with self.assertRaises(EarnPolicyError):
            money('1000000000000.0001', positive=True)

    def test_fixed_interest_uses_decimal_and_half_up_rounding(self):
        self.assertEqual(calculate_fixed_interest('1000.0000', '8.0', 30), Decimal('6.5753'))
        self.assertEqual(calculate_fixed_interest('0.0100', '1', 1), Decimal('0.0000'))

    def test_demand_interest_tracks_elapsed_time_not_one_day_flat_fee(self):
        principal = Decimal('1000.0000')
        self.assertEqual(calculate_demand_interest(principal, '3', 0), Decimal('0.0000'))
        self.assertEqual(calculate_demand_interest(principal, '3', 86400), Decimal('0.0822'))
        self.assertEqual(calculate_demand_interest(principal, '3', 31536000), Decimal('30.0000'))

    def test_demand_interest_never_accepts_invalid_rate(self):
        with self.assertRaises(EarnPolicyError):
            calculate_demand_interest('10', '-1', 3600)

    def test_early_fee_is_decimal_and_bounded(self):
        self.assertEqual(early_redemption_penalty('100.1234', '0.02'), Decimal('2.0025'))
        for rate in ('-0.01', '1.01', 'NaN'):
            with self.subTest(rate=rate), self.assertRaises(EarnPolicyError):
                early_redemption_penalty('100', rate)


if __name__ == '__main__':
    unittest.main()
