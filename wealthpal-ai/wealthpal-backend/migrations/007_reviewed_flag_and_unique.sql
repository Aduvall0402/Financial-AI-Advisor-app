-- ============================================================
-- Migration 007: reviewed flag + unique constraint on transactions
-- Run this in the Supabase SQL Editor
--
-- Fixes: transactions showing up for review every sync because
--   (a) reviewed column may not exist
--   (b) unique constraint on (user_id, plaid_transaction_id) may not exist,
--       causing upsert to INSERT duplicates instead of ignoring them
-- ============================================================

-- 1. Add reviewed column (no-op if already exists)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Back-fill: any existing rows with NULL get set to false
UPDATE transactions SET reviewed = FALSE WHERE reviewed IS NULL;

-- 3. Add the unique constraint the upsert relies on
--    (without this, ignoreDuplicates: true inserts fresh rows every sync)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_plaid_id
  ON transactions (user_id, plaid_transaction_id)
  WHERE plaid_transaction_id IS NOT NULL;

-- 4. Deduplicate any rows that snuck in before the constraint existed,
--    keeping the one with reviewed=true if present, otherwise the oldest row.
DELETE FROM transactions t1
USING transactions t2
WHERE t1.plaid_transaction_id IS NOT NULL
  AND t1.user_id = t2.user_id
  AND t1.plaid_transaction_id = t2.plaid_transaction_id
  AND t1.id > t2.id
  AND t2.reviewed = FALSE;

DELETE FROM transactions t1
USING transactions t2
WHERE t1.plaid_transaction_id IS NOT NULL
  AND t1.user_id = t2.user_id
  AND t1.plaid_transaction_id = t2.plaid_transaction_id
  AND t1.id > t2.id;
