#!/usr/bin/env python3
"""Safe static preflight for BTCBOX Supabase Google OAuth configuration.
Does not print environment values, tokens, or customer data; does not contact services.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
LOGIN = (ROOT / "pages/login.html").read_text(encoding="utf-8")
API = (ROOT / "netlify/functions/api.js").read_text(encoding="utf-8")
DOC = (ROOT / "SUPABASE-GOOGLE-OAUTH.md").read_text(encoding="utf-8")

checks = []
def check(name, ok, detail):
    checks.append((name, bool(ok), detail))

url_match = re.search(r"var SUPABASE_URL = '(https://[^']+)'", LOGIN)
publishable_match = re.search(r"var SUPABASE_PUBLISHABLE_KEY = '([^']+)'", LOGIN)
project_url = url_match.group(1) if url_match else ""
key = publishable_match.group(1) if publishable_match else ""
project_ref = re.sub(r"^https://|\.supabase\.co/?$", "", project_url)

check("frontend Supabase project URL exists", bool(project_url and project_ref), "URL constant found")
check("frontend uses publishable/anon key, not secret", bool(key and (key.startswith("sb_publishable_") or not key.startswith("sb_secret_"))) and not re.search(r"service_role|sb_secret_", LOGIN, re.I), "No service-role/secret key marker in login page")
check("production OAuth redirect is the login page callback", "window.location.origin + '/pages/login.html?auth_callback=1'" in LOGIN, "Redirect URL matches documented production callback")
check("backend validates Supabase session server-side", "SUPABASE_AUTH_URL" in API and "SUPABASE_AUTH_PUBLISHABLE_KEY" in API and "'/auth/v1/user'" in API and "Authorization': 'Bearer ' + accessToken" in API, "Backend calls Supabase Auth user endpoint with bearer token")
check("Google OAuth flow remains enabled", "signInWithOAuth({" in LOGIN and "provider:'google'" in LOGIN, "Google provider call exists")
check("email magic-link flow remains enabled", "signInWithOtp({" in LOGIN and "auth_method=email" in DOC, "Email OTP flow and callback documentation exist")
check("Supabase callback documented", bool(project_ref and f"https://{project_ref}.supabase.co/auth/v1/callback" in DOC), "Google Cloud provider callback matches the frontend project ref")
check("Netlify auth env names documented", "SUPABASE_AUTH_URL" in DOC and "SUPABASE_AUTH_PUBLISHABLE_KEY" in DOC, "Server-side auth environment variables are documented")
check("auth and financial storage configuration remain separately named", "SUPABASE_AUTH_URL" in API and "SUPABASE_URL" in API, "Auth verification and financial/storage adapter use separate env names")

for name, ok, detail in checks:
    print(("PASS" if ok else "FAIL") + " | " + name + " | " + detail)
failed = [x for x in checks if not x[1]]
print(f"\nResult: {len(checks)-len(failed)}/{len(checks)} checks passed")
sys.exit(1 if failed else 0)
