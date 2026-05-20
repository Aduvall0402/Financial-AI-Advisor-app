-- Run this in Supabase SQL Editor

-- Add update_mode to goals (manual = user updates manually, auto = scans transactions)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS update_mode TEXT DEFAULT 'manual' CHECK (update_mode IN ('manual', 'auto'));

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  monthly_limit NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);
