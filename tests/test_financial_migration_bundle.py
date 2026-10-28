import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.financial_migration_bundle import build_bundle

class MigrationBundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'data-backup.json'
        self.data = {'users': {'7': {
            'uid': 7, 'email': 'private@example.test', 'password_hash': 'never-export',
            'balances': {'USDT': '12.5000'}, 'frozen': {'USDT': '3'},
            'withdrawals': [{'id': 4, 'coin': 'USDT', 'amount': '2', 'fee': '1', 'address': 'T123456789', 'network': 'TRC20', 'status': 'pending'}],
            'deposits': [{'id': 5, 'coin': 'USDT', 'amount': '8', 'status': 'pending'}],
            'orders': [{'id': 6, 'symbol': 'BTC/USDT', 'side': 'buy', 'qty': '0.1', 'price': '60000', 'total': '6000', 'status': 'filled', 'source': 'simulated'}],
            'earn_records': [{'id': 7, 'asset': 'USDT', 'principal': '10', 'status': 'active'}]
        }}}
        self.source.write_text(json.dumps(self.data), encoding='utf-8')
        self.digest = hashlib.sha256(self.source.read_bytes()).hexdigest()

    def test_exports_minimized_deterministic_bundle(self):
        out = self.root / 'bundle'
        manifest = build_bundle(self.source, out, self.digest)
        self.assertFalse(manifest['database_import_performed'])
        self.assertEqual(manifest['output_files']['account_snapshots.jsonl'], 1)
        account = json.loads((out / 'account_snapshots.jsonl').read_text().strip())
        self.assertEqual(account['available'], '12.5')
        self.assertEqual(account['frozen'], '3')
        text = ''.join(p.read_text() for p in out.iterdir())
        self.assertNotIn('private@example.test', text)
        self.assertNotIn('never-export', text)
        self.assertIn('T123456789', (out / 'withdrawals.jsonl').read_text())
        self.assertEqual((out / 'withdrawals.jsonl').stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError):
            build_bundle(self.source, out, self.digest)

    def test_rejects_wrong_checksum_before_output(self):
        out = self.root / 'bundle'
        with self.assertRaisesRegex(ValueError, 'does not match'):
            build_bundle(self.source, out, '0' * 64)
        self.assertFalse(out.exists())

    def test_rejects_negative_balances(self):
        self.data['users']['7']['balances']['USDT'] = -1
        self.source.write_text(json.dumps(self.data), encoding='utf-8')
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, 'negative_balance'):
            build_bundle(self.source, self.root / 'bundle', digest)

if __name__ == '__main__': unittest.main()
