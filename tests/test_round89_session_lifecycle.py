from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class SessionLifecycleAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'pages' / 'login.html').read_text(encoding='utf-8')
        cls.api = (ROOT / 'netlify' / 'functions' / 'api.js').read_text(encoding='utf-8')
        cls.app = (ROOT / 'assets' / 'js' / 'app.js').read_text(encoding='utf-8')

    def test_oauth_and_email_share_verified_server_session_exchange(self):
        self.assertIn("fetch('/api/supabase-login'", self.html)
        self.assertIn("supabase_access_token:session.access_token", self.html)
        self.assertIn("fetch(supabaseUrl + '/auth/v1/user'", self.api)
        self.assertIn("'Authorization': 'Bearer ' + accessToken", self.api)
        self.assertIn('db.sessions[token] = { uid: user.uid, email: email, created_at: Date.now() }', self.api)

    def test_server_session_cookie_is_http_only_and_same_site(self):
        self.assertRegex(self.api, r"'Set-Cookie':\s*SESSION_COOKIE\s*\+\s*'='\s*\+\s*token\s*\+\s*'; Path=/; HttpOnly; SameSite=Lax'")
        self.assertIn("'; Max-Age=' + (maxAge || 86400 * 7)", self.api)

    def test_logout_revokes_server_session_and_clears_cookie(self):
        logout_block = self.api.split("if (path === 'logout' && method === 'POST')", 1)[1].split('// ----------', 1)[0]
        self.assertIn('delete db.sessions[token]', logout_block)
        self.assertIn('clearCookieHeader()', logout_block)
        self.assertIn("fetch('/api/logout', {method:'POST', credentials:'include'})", self.app)

    def test_callback_redirect_rejects_external_origin(self):
        self.assertIn("if(safeTarget.origin === window.location.origin) target = safeTarget.pathname + safeTarget.search + safeTarget.hash", self.html)

    def test_callback_url_scrubs_oauth_codes_and_errors(self):
        self.assertIn("['auth_callback','auth_method','code','error','error_code','error_description','type'].forEach", self.html)
        self.assertIn('clean.hash = \'\'', self.html)

    def test_provider_secrets_are_not_in_frontend_auth_config(self):
        self.assertNotIn('client_secret', self.html.lower())
        self.assertNotIn('SUPABASE_SERVICE_ROLE_KEY', self.html)
        self.assertNotIn('SUPABASE_SECRET_KEY', self.html)

if __name__ == '__main__':
    unittest.main()
