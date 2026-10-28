import hashlib, json, tempfile, unittest
from pathlib import Path
from scripts.financial_migration_reconciliation import build_report

class ReconciliationReportTests(unittest.TestCase):
    def make_bundle(self, root, mutate=None):
        rows = {
            'account_snapshots.jsonl': [
                {'user_id':'secret-user-1','asset':'BTC','available':'1.25','frozen':'0.5','source':'legacy_json_snapshot'},
                {'user_id':'secret-user-2','asset':'BTC','available':'2','frozen':'0','source':'legacy_json_snapshot'},
            ],
            'withdrawals.jsonl': [
                {'user_id':'secret-user-1','asset':'BTC','amount':'0.1','fee':'0.001','legacy_status':'pending','destination':'do-not-leak'}
            ],
            'deposits.jsonl': [
                {'user_id':'secret-user-2','asset':'BTC','amount':'0.2','legacy_status':'confirmed','txid':'do-not-leak-tx'}
            ],
            'orders.jsonl': [{'user_id':'secret-user-1','legacy_status':'filled','symbol':'BTC/USDT'}],
            'earn_records.jsonl': [{'user_id':'secret-user-2','legacy_status':'active','principal':'4'}],
        }
        if mutate: mutate(rows)
        counts, hashes = {}, {}
        for name, items in rows.items():
            raw = ''.join(json.dumps(x, sort_keys=True, separators=(',',':'))+'\n' for x in items).encode()
            (root/name).write_bytes(raw); counts[name] = len(items); hashes[name] = hashlib.sha256(raw).hexdigest()
        manifest = {'manifest_version':1,'database_import_performed':False,'source':{'sha256':'a'*64,'size_bytes':123},'output_files':counts,'output_sha256':hashes}
        (root/'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')

    def test_totals_counts_and_pii_minimized_report(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); self.make_bundle(root)
            report=build_report(d)
            self.assertTrue(report['pre_import_reconciliation_passed'])
            self.assertEqual(report['account_totals_by_asset']['BTC']['available_total'],'3.25')
            self.assertEqual(report['account_totals_by_asset']['BTC']['frozen_total'],'0.5')
            self.assertEqual(report['amount_totals_by_asset']['withdrawal']['BTC']['amount_total'],'0.1')
            self.assertEqual(report['collections']['orders.jsonl']['status_counts'], {'filled':1})
            serialized=json.dumps(report)
            self.assertNotIn('secret-user', serialized)
            self.assertNotIn('do-not-leak', serialized)
            self.assertFalse(report['database_connection_used'])

    def test_manifest_hash_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); self.make_bundle(root)
            (root/'orders.jsonl').write_text('{}\n', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                build_report(d)

    def test_negative_account_balance_is_blocking(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            self.make_bundle(root, lambda rows: rows['account_snapshots.jsonl'][0].update({'available':'-1'}))
            report=build_report(d)
            self.assertFalse(report['pre_import_reconciliation_passed'])
            self.assertIn('negative_account_balance', report['blocking_findings'])

    def test_duplicate_user_asset_is_blocking(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            def duplicate(rows): rows['account_snapshots.jsonl'].append(dict(rows['account_snapshots.jsonl'][0]))
            self.make_bundle(root, duplicate)
            report=build_report(d)
            self.assertFalse(report['pre_import_reconciliation_passed'])
            self.assertIn('duplicate_user_asset_snapshot', report['blocking_findings'])

if __name__ == '__main__': unittest.main()
