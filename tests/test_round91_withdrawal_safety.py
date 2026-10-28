import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class Round91WithdrawalSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'pages' / 'withdraw.html').read_text(encoding='utf-8')

    def test_coin_switch_resets_balance_before_fetch(self):
        reset = self.html.index("avail = 0;", self.html.index('// Reset immediately'))
        fetch = self.html.index("fetch('/api/account'", reset)
        self.assertLess(reset, fetch)
        self.assertIn("document.getElementById('wdAvail').textContent = '0';", self.html[reset:fetch])

    def test_stale_balance_response_is_ignored_after_coin_switch(self):
        self.assertIn('var requestedCoin = curCoin;', self.html)
        self.assertIn('if(requestedCoin !== curCoin) return;', self.html)
        self.assertIn('j.balances[requestedCoin]', self.html)

    def test_html_escape_helper_covers_html_metacharacters(self):
        self.assertIn('function escapeHtml(value)', self.html)
        for token in ['&amp;', '&lt;', '&gt;', '&quot;', '&#39;']:
            self.assertIn(token, self.html)

    def test_saved_address_labels_are_escaped_before_html_insertion(self):
        self.assertIn("escapeHtml(a.note||a.coin+' '+a.network)", self.html)
        self.assertIn('escapeHtml(maskSaved(a.address))', self.html)

    def test_withdrawal_record_fields_are_escaped(self):
        for field in ['w.reject_reason', 'w.coin', 'w.network', 'w.amount', 'w.fee', 'w.time']:
            self.assertIn('escapeHtml('+field, self.html)
        self.assertIn("escapeHtml(String(w.address).slice(0,10)+'...'+String(w.address).slice(-6))", self.html)

if __name__ == '__main__':
    unittest.main()
