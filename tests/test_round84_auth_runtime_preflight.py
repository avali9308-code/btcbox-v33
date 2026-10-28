import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'netlify/functions/api.js').read_text(encoding='utf-8')
DOC = (ROOT / 'SUPABASE-GOOGLE-OAUTH.md').read_text(encoding='utf-8')

class Round84AuthRuntimePreflightTests(unittest.TestCase):
    def test_auth_health_route_runs_before_database_load(self):
        route = API[API.index("if (path === 'auth-health'"):API.index('  let db;', API.index("if (path === 'auth-health'"))]
        self.assertIn('auth_environment_configured', route)
        self.assertIn('auth_project_matches_expected', route)
        self.assertIn('provider_enabled: null', route)
        self.assertNotIn('loadDB()', route)

    def test_health_route_never_returns_auth_key(self):
        route = API[API.index("if (path === 'auth-health'"):API.index('  let db;', API.index("if (path === 'auth-health'"))]
        self.assertNotIn('authKey,', route)
        self.assertNotIn('SUPABASE_AUTH_PUBLISHABLE_KEY:', route)
        self.assertIn('live_oauth_tested: false', route)

    def test_deployment_check_documented(self):
        self.assertIn('/api/auth-health', DOC)
        self.assertIn('provider_enabled', DOC)

if __name__ == '__main__':
    unittest.main()
