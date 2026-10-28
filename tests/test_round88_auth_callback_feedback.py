from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class AuthCallbackFeedbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "pages" / "login.html").read_text(encoding="utf-8")
        cls.i18n = (ROOT / "assets" / "js" / "i18n.js").read_text(encoding="utf-8")

    def test_callback_errors_use_safe_english_message(self):
        self.assertIn("I18N.t('authVerifyFailed')", self.html)
        self.assertIn("authVerifyFailed:'Sign-in verification failed. Please try again. If the problem continues, contact support.", self.i18n)

    def test_callback_does_not_display_raw_backend_error_message(self):
        self.assertNotIn("BTCBOX.toast(msg && msg !== 'NO_AUTH_SESSION' ? msg", self.html)

    def test_expired_email_link_has_specific_guidance(self):
        self.assertIn("I18N.t('emailLinkExpired')", self.html)
        self.assertIn("emailLinkExpired:'This email link could not be verified or has expired. Open the latest email link in the same browser, or request a new one.", self.i18n)

if __name__ == "__main__":
    unittest.main()
