# BTCBOX Language Consistency Audit — v36

## Scope
- Public UI is intended to remain English-only (`lang="en"`, fixed English locale).
- Existing runtime translation covers known legacy page copy and replaces unknown CJK text in rendered text nodes and accessibility attributes with English fallbacks.
- API response serialization now normalizes fixed `msg` fields containing CJK characters to reviewed English messages where available and a safe English fallback otherwise. User-authored content and non-message data fields are not rewritten.
- The audit covers public pages, runtime JavaScript, API status messages, and regression tests.

## Verification
- `npm test`: 201 tests passed after the Round 173 batch repair.
- `npm run build`: passed after the Round 173 batch repair.
- These checks are code-level verification, not a real-browser screenshot audit. Mobile and desktop visual QA still requires a deployed preview.

## Seconds-contract result control
- The real-money settlement path continues to use server-fetched external reference prices and the atomic financial RPC.
- This revision does not add an outcome override that can alter real-money customer settlement. A separate simulation-only implementation must use isolated simulated balances and positions before preset outcomes can be enabled safely.
