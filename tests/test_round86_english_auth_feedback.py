from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class EnglishAuthFeedbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'pages' / 'login.html').read_text(encoding='utf-8')
        cls.i18n = (ROOT / 'assets' / 'js' / 'i18n.js').read_text(encoding='utf-8')

    def test_magic_link_feedback_is_english(self):
        expected = [
            'Send Email Sign-in Link',
            'Please enter a valid email address above.',
            'Sending email link…',
            'Check your inbox and spam folder.',
            'Unable to send the sign-in link. Please try again later.',
            'The sign-in service could not load. Check your connection and refresh the page.',
        ]
        for message in expected:
            with self.subTest(message=message):
                self.assertIn(message, self.html + self.i18n)

    def test_google_feedback_is_english(self):
        for message in [
            'Continue with Google',
            'Google sign-in successful',
            'Unable to start Google sign-in. Check your connection or OAuth configuration.',
        ]:
            with self.subTest(message=message):
                self.assertIn(message, self.html + self.i18n)

    def test_email_otp_pkce_and_redirect_preserved(self):
        self.assertIn('client.auth.signInWithOtp', self.html)
        self.assertIn("flowType:'pkce'", self.html)
        self.assertIn("shouldCreateUser: mode === 'register'", self.html)
        self.assertIn("auth_method=email", self.html)
        self.assertIn("/api/supabase-login", self.html)

if __name__ == '__main__':
    unittest.main()
