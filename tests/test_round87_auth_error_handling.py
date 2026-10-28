from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class AuthErrorHandlingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'pages' / 'login.html').read_text(encoding='utf-8')

    def test_magic_link_errors_are_mapped_to_safe_english_messages(self):
        self.assertIn('function getMagicLinkErrorMessage(err)', self.html)
        self.assertIn('Too many sign-in requests. Please wait a few minutes before trying again.', self.html)
        self.assertIn('Unable to contact the sign-in service. Check your internet connection and try again.', self.html)
        self.assertIn('Please check the email address and try again.', self.html)
        self.assertIn("showMagicStatus(getMagicLinkErrorMessage(err), true)", self.html)

    def test_raw_provider_error_is_not_shown_to_user(self):
        self.assertNotIn("showMagicStatus(err && err.message ? err.message", self.html)

    def test_status_role_updates_for_accessibility(self):
        self.assertIn("magicLinkStatus.setAttribute('role', isError ? 'alert' : 'status')", self.html)

if __name__ == '__main__':
    unittest.main()
