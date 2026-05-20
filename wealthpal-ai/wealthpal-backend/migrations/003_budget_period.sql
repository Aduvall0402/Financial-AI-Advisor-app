-- Run this in Supabase SQL Editor

-- Add period to budgets table (weekly, biweekly, monthly)
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS period TEXT DEFAULT 'monthly'
    CHECK (period IN ('weekly', 'biweekly', 'monthly'));
