import hashlib, json, tempfile, unittest
from pathlib import Path
from scripts.financial_migration_bundle import build_bundle
from scripts.generate_financial_staging_sql import generate_sql, load_bundle

class StagingSqlGeneratorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        data = {"users": {"u'1": {
            "uid": "u'1", "balances": {"USDT": "10"}, "frozen": {"USDT": "2"},
            "withdrawals": [{"id": "w1", "coin": "USDT", "amount": "1", "fee": "0.1", "status": "pending", "address": "dest"}],
            "deposits": [{"id": "d1", "coin": "USDT", "amount": "3", "status": "confirmed", "txid": "tx"}],
            "orders": [{"id": "o1", "symbol": "BTCUSDT", "side": "buy", "price": "2", "qty": "1", "status": "filled"}],
            "earn_records": [{"id": "e1", "coin": "USDT", "principal": "4", "status": "active"}],
        }}}
        self.source = self.root / "backup.json"; self.source.write_text(json.dumps(data), encoding="utf-8")
        self.bundle = self.root / "bundle"
        build_bundle(self.source, self.bundle, hashlib.sha256(self.source.read_bytes()).hexdigest())

    def test_generates_quarantine_import_for_all_financial_collections(self):
        out = self.root / "staging.sql"
        result = generate_sql(str(self.bundle), str(out)); sql = out.read_text()
        self.assertEqual(result["records"], 5)
        self.assertFalse(result["database_connection_used"])
        self.assertFalse(result["operational_tables_modified"])
        self.assertIn("financial_legacy_migration_records", sql)
        self.assertIn("'withdrawal'", sql); self.assertIn("'deposit'", sql)
        self.assertIn("'order'", sql); self.assertIn("'earn_record'", sql)
        self.assertIn("ON CONFLICT (source_sha256,source_collection,migration_id) DO NOTHING", sql)
        self.assertIn("'u''1'", sql)
        self.assertNotIn("INSERT INTO public.withdrawal_requests", sql)
        self.assertEqual(out.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError): generate_sql(str(self.bundle), str(out))

    def test_rejects_tampered_file_hash(self):
        p = self.bundle / "withdrawals.jsonl"; p.write_text(p.read_text() + "\n")
        with self.assertRaisesRegex(ValueError, "SHA-256 does not match"):
            load_bundle(str(self.bundle))

    def test_rejects_count_mismatch(self):
        p = self.bundle / "manifest.json"; m = json.loads(p.read_text())
        m["output_files"]["orders.jsonl"] += 1; p.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError, "count does not match"):
            load_bundle(str(self.bundle))

if __name__ == "__main__": unittest.main()
