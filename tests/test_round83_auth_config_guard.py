import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Round83AuthConfigGuardTests(unittest.TestCase):
    def test_supabase_auth_preflight_passes(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/check_supabase_auth_config.py')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('9/9 checks passed', result.stdout)

    def test_oauth_callback_and_project_ref_are_not_accidentally_changed(self):
        login = (ROOT / 'pages/login.html').read_text(encoding='utf-8')
        docs = (ROOT / 'SUPABASE-GOOGLE-OAUTH.md').read_text(encoding='utf-8')
        self.assertIn('https://zlozsutefnmgwwzrlipt.supabase.co', login)
        self.assertIn("window.location.origin + '/pages/login.html?auth_callback=1'", login)
        self.assertIn('https://zlozsutefnmgwwzrlipt.supabase.co/auth/v1/callback', docs)

    def test_no_service_role_key_in_client_login_html(self):
        login = (ROOT / 'pages/login.html').read_text(encoding='utf-8').lower()
        self.assertNotIn('service_role', login)
        self.assertNotIn('sb_secret_', login)

if __name__ == '__main__':
    unittest.main()
