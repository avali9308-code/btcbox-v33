import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.financial_migration_bundle import build_bundle
from scripts.generate_financial_opening_sql import generate_sql, load_accounts, sql_literal

class OpeningSqlGeneratorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'backup.json'
        data = {'users': {
            'u1': {'uid': 'u1', 'balances': {'USDT': '12.5'}, 'frozen': {'USDT': '3'}},
            "u'2": {'uid': "u'2", 'balances': {'BTC': '0'}, 'frozen': {}}
        }}
        self.source.write_text(json.dumps(data), encoding='utf-8')
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.bundle = self.root / 'bundle'
        build_bundle(self.source, self.bundle, digest)

    def test_generates_idempotent_transaction_and_opening_ledger(self):
        out = self.root / 'staging.sql'
        result = generate_sql(str(self.bundle), str(out))
        sql = out.read_text()
        self.assertEqual(result['accounts'], 2)
        self.assertFalse(result['database_connection_used'])
        self.assertIn('BEGIN;', sql)
        self.assertIn('COMMIT;', sql)
        self.assertIn('ON CONFLICT (idempotency_key) DO NOTHING', sql)
        self.assertIn("'migration_opening_balance'", sql)
        self.assertIn('INSERT INTO public.financial_ledger', sql)
        self.assertIn('existing account balance conflicts', sql)
        self.assertIn("'u''2'", sql)  # SQL literal escaping
        self.assertEqual(out.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError):
            generate_sql(str(self.bundle), str(out))

    def test_rejects_manifest_count_mismatch(self):
        manifest_path = self.bundle / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['output_files']['account_snapshots.jsonl'] += 1
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'count does not match'):
            load_accounts(str(self.bundle))

    def test_rejects_negative_or_malformed_balance(self):
        path = self.bundle / 'account_snapshots.jsonl'
        rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        rows[0]['available'] = '-0.01'
        path.write_text(''.join(json.dumps(row) + '\n' for row in rows))
        manifest_path = self.bundle / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['output_sha256']['account_snapshots.jsonl'] = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'out-of-range'):
            load_accounts(str(self.bundle))

    def test_rejects_tampered_account_file_hash(self):
        path = self.bundle / 'account_snapshots.jsonl'
        path.write_text(path.read_text() + '\n')
        with self.assertRaisesRegex(ValueError, 'SHA-256 does not match'):
            load_accounts(str(self.bundle))

    def test_sql_literal_rejects_nul(self):
        with self.assertRaisesRegex(ValueError, 'NUL'):
            sql_literal('abc\x00def')

if __name__ == '__main__':
    unittest.main()
