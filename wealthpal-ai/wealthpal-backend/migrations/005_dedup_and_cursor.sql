-- Remove duplicate Plaid transactions for each user, keeping the row with the lowest id
DELETE FROM transactions
WHERE id NOT IN (
  SELECT MIN(id)
  FROM transactions
  WHERE plaid_transaction_id IS NOT NULL
  GROUP BY user_id, plaid_transaction_id
) AND plaid_transaction_id IS NOT NULL;

-- Add cursor column to accounts table for incremental Plaid sync
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plaid_sync_cursor TEXT DEFAULT NULL;
