-- ============================================================
-- Migration 006: Enable Row Level Security on all tables
-- Run this in the Supabase SQL Editor
--
-- NOTE: The backend uses the service_role key which bypasses
-- RLS. These policies protect against direct anon/user-key
-- access and provide defense-in-depth.
-- ============================================================

-- ── Enable RLS ──────────────────────────────────────────────

ALTER TABLE IF EXISTS users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS debts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_usage              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS groups                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_budgets         ENABLE ROW LEVEL SECURITY;

-- ── Drop existing policies (idempotent re-run) ───────────────

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('users','accounts','transactions','budgets','goals','debts',
                      'recurring_transactions','chat_messages','ai_usage',
                      'groups','group_members','group_goals','group_budgets')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── users ────────────────────────────────────────────────────
CREATE POLICY "own profile" ON users
  FOR ALL USING (auth.uid() = id);

-- ── accounts ────────────────────────────────────────────────
CREATE POLICY "own accounts" ON accounts
  FOR ALL USING (auth.uid() = user_id);

-- ── transactions ─────────────────────────────────────────────
CREATE POLICY "own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

-- ── budgets ──────────────────────────────────────────────────
CREATE POLICY "own budgets" ON budgets
  FOR ALL USING (auth.uid() = user_id);

-- ── goals ────────────────────────────────────────────────────
CREATE POLICY "own goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

-- ── debts ────────────────────────────────────────────────────
CREATE POLICY "own debts" ON debts
  FOR ALL USING (auth.uid() = user_id);

-- ── recurring_transactions ───────────────────────────────────
CREATE POLICY "own recurring" ON recurring_transactions
  FOR ALL USING (auth.uid() = user_id);

-- ── chat_messages ────────────────────────────────────────────
CREATE POLICY "own messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- ── ai_usage ─────────────────────────────────────────────────
CREATE POLICY "own usage" ON ai_usage
  FOR ALL USING (auth.uid() = user_id);

-- ── groups ───────────────────────────────────────────────────
-- Users can see groups they are a member of
CREATE POLICY "member groups read" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
    )
  );
-- Only the creator can modify or delete a group
CREATE POLICY "creator groups write" ON groups
  FOR ALL USING (auth.uid() = created_by);

-- ── group_members ─────────────────────────────────────────────
-- Any member of a group can see who else is in it
CREATE POLICY "group member read" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id = auth.uid()
    )
  );
-- Users can only insert/update/delete their own membership row
CREATE POLICY "own membership write" ON group_members
  FOR ALL USING (auth.uid() = user_id);

-- ── group_goals ───────────────────────────────────────────────
CREATE POLICY "group members see goals" ON group_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_goals.group_id
        AND group_members.user_id = auth.uid()
    )
  );

-- ── group_budgets ─────────────────────────────────────────────
CREATE POLICY "group members see budgets" ON group_budgets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_budgets.group_id
        AND group_members.user_id = auth.uid()
    )
  );
