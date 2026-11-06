-- 0022_withdrawal_admin_review_status_v1.sql
--
-- Compatibility checkpoint retained at its historical sequence position.
--
-- The original imported copy attempted to create a second, incompatible
-- create_withdrawal_atomic overload against public.withdrawals and introduced
-- pending_admin_review. That contract does not belong to this application:
-- 0002/0003 define public.withdrawal_requests, and every withdrawal already
-- enters the single admin-review queue with status='pending'. The API calls
-- the canonical nine-argument create_withdrawal_atomic from 0003.
--
-- Do not create a parallel withdrawals table, overload the RPC, or add a
-- second review state. This guard verifies the canonical lifecycle migration
-- ran before continuing to 0023 (manual payout completion).

DO $$
BEGIN
  IF to_regclass('public.withdrawal_requests') IS NULL THEN
    RAISE EXCEPTION 'canonical public.withdrawal_requests table is missing; apply 0002/0003 before 0022';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'withdrawal_requests'
      AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'canonical withdrawal_requests.status column is missing';
  END IF;
END
$$;
