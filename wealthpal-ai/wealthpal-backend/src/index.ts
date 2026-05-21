import dotenv from "dotenv";
dotenv.config();

import express, { Express, Request, Response } from "express";
import cors from "cors";
import supabase from "./supabase";
import * as plaidService from "./plaidService";
import * as openaiService from "./openaiService";
import * as auth from "./auth";

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "WealthPal AI Backend" });
});

// ============================================
// AUTH ROUTES
// ============================================

app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, firstName, lastName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const fn = firstName || (fullName ? fullName.split(" ")[0] : "");
    const ln = lastName || (fullName ? fullName.split(" ").slice(1).join(" ") : "");
    const { user, error } = await auth.signupUser(email, password, fullName || `${fn} ${ln}`.trim());
    if (error) {
      return res.status(400).json({ error: (error as any).message || "Signup failed" });
    }
    if (user) {
      await auth.createUserProfile(user.id, email, fn, ln);
    }
    res.json({ user, message: "Signup successful" });
  } catch (error) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const { session, error } = await auth.loginUser(email, password);
    if (error) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    let firstName = null, lastName = null;
    if (session?.user?.id) {
      const { profile } = await auth.getUserProfile(session.user.id);
      firstName = profile?.["First Name"] || null;
      lastName = profile?.["Last Name"] || null;
    }
    // Fallback to user_metadata if DB columns are empty
    if (!firstName) {
      const meta = session?.user?.user_metadata?.full_name || "";
      firstName = meta.split(" ")[0] || null;
      lastName = meta.split(" ").slice(1).join(" ") || null;
    }
    res.json({ session, first_name: firstName, last_name: lastName, message: "Login successful" });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// ============================================
// PLAID ROUTES
// ============================================

app.post("/api/plaid/create-link-token", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }
    const linkToken = await plaidService.createLinkToken(userId);
    res.json({ link_token: linkToken });
  } catch (error: any) {
    const plaidError = error?.response?.data || error?.message || error;
    console.error("Error creating link token:", JSON.stringify(plaidError));
    res.status(500).json({ error: "Failed to create link token", detail: plaidError });
  }
});

app.post("/api/plaid/exchange-token", async (req: Request, res: Response) => {
  try {
    const { publicToken, userId } = req.body;
    if (!publicToken || !userId) {
      return res.status(400).json({ error: "Public token and user ID required" });
    }
    const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
    // Remove any existing account rows for this user before inserting new one
    await supabase.from("accounts").delete().eq("user_id", userId);
    const { error } = await supabase
      .from("accounts")
      .insert([{
        user_id: userId,
        plaid_account_id: itemId,
        plaid_access_token: accessToken,
        account_name: "Connected Account",
        account_type: "checking",
        current_balance: 0,
      }]);
    if (error) throw error;
    res.json({ plaid_account_id: itemId, itemId, message: "Account connected" });
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error_message || error?.message || "Failed to exchange token";
    res.status(500).json({ error: errorMessage });
  }
});

app.get("/api/plaid/accounts/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from("accounts")
      .select("plaid_access_token, plaid_account_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data?.length || !data[0]?.plaid_access_token) {
      return res.status(404).json({ error: "No connected account found" });
    }
    const accounts = await plaidService.getAccounts(data[0].plaid_access_token);
    res.json({ accounts, itemId: data[0].plaid_account_id });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch accounts" });
  }
});

// ============================================
// TRANSACTION ROUTES
// ============================================

app.get("/api/transactions/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ transactions: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch transactions" });
  }
});

app.post("/api/transactions/sync/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select("id, plaid_access_token")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (accountError || !accountData?.length || !accountData[0]?.plaid_access_token) {
      return res.status(404).json({ error: "No connected account found" });
    }
    const accessToken = accountData[0].plaid_access_token;
    const accountId = accountData[0].id;
    // Ask Plaid to pull latest data for this item before syncing
    await plaidService.refreshTransactions(accessToken);
    const transactions = await plaidService.getTransactions(accessToken);
    // Clear existing transactions for this user before inserting fresh data
    await supabase.from("transactions").delete().eq("user_id", userId);
    let synced = 0;
    let failed = 0;
    for (const tx of transactions) {
      const { error } = await supabase
        .from("transactions")
        .insert([{
          user_id: userId,
          account_id: accountId,
          plaid_transaction_id: tx.transaction_id,
          merchant_name: tx.merchant_name || tx.name || "Unknown",
          merchant_category_code: tx.payment_channel || null,
          amount: Math.abs(tx.amount),
          currency_code: tx.iso_currency_code || tx.unofficial_currency_code || "USD",
          category: (tx.personal_finance_category?.primary || (tx.category as any)?.[0] || "Other"),
          category_confidence: tx.personal_finance_category_icon_url ? null : null,
          is_pending: tx.pending ?? false,
          transaction_date: tx.date,
          posted_date: tx.authorized_date || null,
          description: tx.name,
        }]);
      if (error) {
        failed++;
        if (failed <= 3) console.error("Insert error for tx", tx.transaction_id, JSON.stringify(error));
      } else {
        synced++;
      }
    }
    console.log(`Synced ${synced}/${transactions.length} transactions for user ${userId} (${failed} failed)`);
    res.json({ synced, total: transactions.length });
  } catch (error: any) {
    const msg = error?.message || "Failed to sync transactions";
    console.error("Sync error:", msg);
    res.status(500).json({ error: msg });
  }
});

app.patch("/api/transactions/:txId", async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    const { merchant_name, amount, category, transaction_date, description } = req.body;
    const { error } = await supabase
      .from("transactions")
      .update({ merchant_name, amount, category, transaction_date, description, updated_at: new Date().toISOString() })
      .eq("id", txId);
    if (error) throw error;
    res.json({ message: "Transaction updated" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update transaction" });
  }
});

// Legacy sync endpoint (kept for compatibility)
app.post("/api/transactions/sync", async (req: Request, res: Response) => {
  try {
    const { userId, accessToken, startDate, endDate } = req.body;
    if (!userId || !accessToken || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const transactions = await plaidService.getTransactions(accessToken);
    let synced = 0;
    for (const tx of transactions) {
      const { error } = await supabase
        .from("transactions")
        .insert([{
          user_id: userId,
          plaid_transaction_id: tx.transaction_id,
          merchant_name: tx.merchant_name || "Unknown",
          amount: Math.abs(tx.amount),
          category: (tx.category as any)?.[0] || "Other",
          transaction_date: tx.date,
          description: tx.name,
        }]);
      if (!error) synced++;
    }
    res.json({ synced });
  } catch (error) {
    res.status(500).json({ error: "Failed to sync transactions" });
  }
});

// ============================================
// AI ROUTES
// ============================================

app.get("/api/ai/financial-summary/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("transaction_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    if (txError) throw txError;
    const monthly_spending = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const categoryMap: { [key: string]: number } = {};
    transactions?.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });
    const top_categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const { data: debts } = await supabase.from("debts").select("*").eq("user_id", userId);
    const debt = (debts || []).map((d) => ({ name: d.debt_name, balance: d.current_balance, interest: d.interest_rate }));
    res.json({ monthly_income: 0, monthly_spending, top_categories, debt });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "User ID and message required" });
    }

    // Use the client's local date if sent; fall back to UTC server date
    const todayStr: string = req.body.today || new Date().toISOString().split("T")[0];
    const todayDate = new Date(todayStr + "T00:00:00Z"); // treat as UTC midnight for arithmetic

    // Fetch ALL transactions for this user — no date cutoff
    const { data: allTx } = await supabase
      .from("transactions")
      .select("merchant_name, amount, category, transaction_date, description")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    const txList = allTx || [];

    // Pre-compute spending windows — use (days-1) so "last N days" includes today as day 1
    const windowSpend = (days: number) => {
      const cutoff = new Date(todayDate.getTime() - (days - 1) * 86400000).toISOString().split("T")[0];
      return txList.filter(t => t.transaction_date >= cutoff).reduce((s, t) => s + parseFloat(t.amount), 0);
    };

    const spending_7d  = windowSpend(7);
    const spending_9d  = windowSpend(9);
    const spending_14d = windowSpend(14);
    const spending_30d = windowSpend(30);
    const spending_60d = windowSpend(60);
    const spending_90d = windowSpend(90);

    // Category breakdown for 30d
    const categoryMap: { [key: string]: number } = {};
    txList.filter(t => t.transaction_date >= new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0])
      .forEach(t => { categoryMap[t.category] = (categoryMap[t.category] || 0) + parseFloat(t.amount); });
    const top_categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // Most recent 150 transactions for AI reference
    const recent_transactions = txList.slice(0, 150).map(t => ({
      merchant: t.merchant_name || t.description || "Unknown",
      amount: parseFloat(t.amount),
      category: t.category || "Other",
      date: t.transaction_date,
    }));

    // Fetch account balances from Plaid
    let accounts: Array<{ name: string; type: string; subtype: string; balance: number }> = [];
    try {
      const { data: accountData } = await supabase
        .from("accounts")
        .select("plaid_access_token")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (accountData?.length && accountData[0]?.plaid_access_token) {
        const plaidAccounts = await plaidService.getAccounts(accountData[0].plaid_access_token);
        accounts = plaidAccounts.map(a => ({
          name: a.name,
          type: a.type as string,
          subtype: a.subtype as string,
          balance: a.balances.current || 0,
        }));
      }
    } catch { /* no linked account */ }

    // Fetch debts, goals, budgets for full context
    const { data: debts } = await supabase.from("debts").select("*").eq("user_id", userId);
    const debt = (debts || []).map((d: any) => ({ name: d.debt_name, balance: d.current_balance, interest: d.interest_rate }));

    const { data: goalsData } = await supabase.from("goals").select("type,title,target_amount,current_amount,deadline").eq("user_id", userId);
    const { data: budgetsData } = await supabase.from("budgets").select("category,monthly_limit,period").eq("user_id", userId);

    const goalsSection = (goalsData || []).map((g: any) => `  - ${g.type}: "${g.title}" — $${g.current_amount || 0}/$${g.target_amount || 0}${g.deadline ? ' by ' + g.deadline : ''}`).join("\n") || "  - None";
    const budgetsSection = (budgetsData || []).map((b: any) => `  - ${b.category} (${b.period}): limit $${b.monthly_limit}`).join("\n") || "  - None";

    const summary = {
      monthly_income: 0,
      monthly_spending: spending_30d,
      weekly_spending: spending_7d,
      spending_windows: { "7d": spending_7d, "9d": spending_9d, "14d": spending_14d, "30d": spending_30d, "60d": spending_60d, "90d": spending_90d },
      top_categories,
      debt,
      accounts,
      recent_transactions,
      goals_section: goalsSection,
      budgets_section: budgetsSection,
      total_transactions: txList.length,
      today: todayStr,
    };

    const response = await openaiService.chatWithAssistant(message, summary as any);

    try {
      await supabase.from("chat_messages").insert([
        { user_id: userId, role: "user", content: message },
        { user_id: userId, role: "assistant", content: response },
      ]);
    } catch { /* best-effort log, don't fail chat */ }
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to process chat" });
  }
});

// ============================================
// NOTIFICATION SUMMARY ROUTE
// ============================================

app.get("/api/ai/notification-summary/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: txData } = await supabase
      .from("transactions")
      .select("merchant_name, amount, category, transaction_date")
      .eq("user_id", userId)
      .gte("transaction_date", cutoff)
      .order("transaction_date", { ascending: false });

    const total = (txData || []).reduce((s, t) => s + parseFloat(t.amount), 0);
    const count = (txData || []).length;
    const catMap: { [k: string]: number } = {};
    (txData || []).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + parseFloat(t.amount); });
    const topCat = Object.entries(catMap).sort(([, a], [, b]) => b - a)[0];

    const prompt = `Generate a single short sentence (under 20 words) for a push notification spending summary. The user spent $${total.toFixed(2)} across ${count} transactions in the last 30 days. Top category: ${topCat ? `${topCat[0]} ($${topCat[1].toFixed(2)})` : "none"}. Be encouraging and specific.`;
    const summary = await openaiService.chatWithAssistant(prompt, { monthly_income: 0, monthly_spending: total, top_categories: [], debt: [] });
    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to generate summary" });
  }
});

// ============================================
// PROFILE ROUTES
// ============================================

app.put("/api/auth/profile/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email } = req.body;
    if (!userId || !firstName) {
      return res.status(400).json({ error: "User ID and first name required" });
    }
    const { error } = await supabase
      .from("users")
      .upsert([{ id: userId, email: email || "", "First Name": firstName, "Last Name": lastName || null }], { onConflict: "id" });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Profile updated" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update profile" });
  }
});

// ============================================
// GOALS ROUTES
// ============================================

app.get("/api/goals/:userId", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from("goals").select("*").eq("user_id", req.params.userId).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ goals: data || [] });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.post("/api/goals", async (req: Request, res: Response) => {
  try {
    const { user_id, type, title, target_amount, current_amount, category, deadline, notes } = req.body;
    const { data, error } = await supabase.from("goals").insert([{ user_id, type, title, target_amount, current_amount: current_amount || 0, category, deadline, notes }]).select();
    if (error) throw error;
    res.json({ goal: data[0] });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.patch("/api/goals/:goalId", async (req: Request, res: Response) => {
  try {
    const fields = req.body;
    const { error } = await supabase.from("goals").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", req.params.goalId);
    if (error) throw error;
    res.json({ message: "Goal updated" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.delete("/api/goals/:goalId", async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.from("goals").delete().eq("id", req.params.goalId);
    if (error) throw error;
    res.json({ message: "Goal deleted" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

// ============================================
// GROUPS ROUTES
// ============================================

app.get("/api/groups/:userId", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from("group_members").select("group_id, role, share_transactions, share_accounts, groups(id, name, created_by, created_at)").eq("user_id", req.params.userId);
    if (error) throw error;
    res.json({ groups: (data || []).map((r: any) => ({ ...r.groups, role: r.role, share_transactions: r.share_transactions, share_accounts: r.share_accounts })) });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.post("/api/groups", async (req: Request, res: Response) => {
  try {
    const { name, userId } = req.body;
    const { data, error } = await supabase.from("groups").insert([{ name, created_by: userId }]).select();
    if (error) throw error;
    const group = data[0];
    await supabase.from("group_members").insert([{ group_id: group.id, user_id: userId, email: req.body.email || "", role: "admin" }]);
    res.json({ group });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.get("/api/groups/:groupId/detail", async (req: Request, res: Response) => {
  try {
    const [membersRes, goalsRes] = await Promise.all([
      supabase.from("group_members").select("*").eq("group_id", req.params.groupId),
      supabase.from("group_goals").select("*").eq("group_id", req.params.groupId),
    ]);
    res.json({ members: membersRes.data || [], goals: goalsRes.data || [] });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.post("/api/groups/:groupId/members", async (req: Request, res: Response) => {
  try {
    const { email, share_transactions, share_accounts } = req.body;
    const { data: user } = await supabase.from("users").select("id").eq("email", email).single();
    const { error } = await supabase.from("group_members").upsert([{ group_id: req.params.groupId, user_id: user?.id || null, email, share_transactions: share_transactions ?? false, share_accounts: share_accounts ?? false }]);
    if (error) throw error;
    res.json({ message: "Member added" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.patch("/api/groups/:groupId/members/:email", async (req: Request, res: Response) => {
  try {
    const { share_transactions, share_accounts } = req.body;
    const { error } = await supabase.from("group_members").update({ share_transactions, share_accounts }).eq("group_id", req.params.groupId).eq("email", req.params.email);
    if (error) throw error;
    res.json({ message: "Member updated" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.delete("/api/groups/:groupId/members/:email", async (req: Request, res: Response) => {
  try {
    await supabase.from("group_members").delete().eq("group_id", req.params.groupId).eq("email", req.params.email);
    res.json({ message: "Member removed" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.get("/api/groups/:groupId/shared-transactions", async (req: Request, res: Response) => {
  try {
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("user_id, email")
      .eq("group_id", req.params.groupId)
      .eq("share_transactions", true);
    if (membersError) throw membersError;
    const userIds = (members || []).filter((m: any) => m.user_id).map((m: any) => m.user_id);
    if (!userIds.length) return res.json({ transactions: [] });
    const { data: txs, error: txError } = await supabase
      .from("transactions")
      .select("merchant_name, amount, category, transaction_date, user_id")
      .in("user_id", userIds)
      .order("transaction_date", { ascending: false })
      .limit(50);
    if (txError) throw txError;
    const emailMap: Record<string, string> = {};
    (members || []).forEach((m: any) => { if (m.user_id) emailMap[m.user_id] = m.email; });
    const enriched = (txs || []).map((tx: any) => ({
      merchant_name: tx.merchant_name,
      amount: tx.amount,
      category: tx.category,
      transaction_date: tx.transaction_date,
      member_email: emailMap[tx.user_id] || "Unknown",
    }));
    res.json({ transactions: enriched });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.post("/api/groups/:groupId/goals", async (req: Request, res: Response) => {
  try {
    const { title, target_amount, deadline, created_by } = req.body;
    const { data, error } = await supabase.from("group_goals").insert([{ group_id: req.params.groupId, title, target_amount, current_amount: 0, deadline, created_by }]).select();
    if (error) throw error;
    res.json({ goal: data[0] });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.patch("/api/groups/:groupId/goals/:goalId", async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.from("group_goals").update(req.body).eq("id", req.params.goalId);
    if (error) throw error;
    res.json({ message: "Goal updated" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

// ============================================
// BUDGET ROUTES
// ============================================

app.get("/api/budgets/:userId", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from("budgets").select("*").eq("user_id", req.params.userId).order("category");
    if (error) throw error;
    res.json({ budgets: data || [] });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.post("/api/budgets", async (req: Request, res: Response) => {
  try {
    const { user_id, category, monthly_limit, period } = req.body;
    const { data, error } = await supabase.from("budgets").upsert([{ user_id, category, monthly_limit, period: period || "monthly" }], { onConflict: "user_id,category" }).select();
    if (error) throw error;
    res.json({ budget: data?.[0] });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.patch("/api/budgets/:budgetId", async (req: Request, res: Response) => {
  try {
    const { monthly_limit, period } = req.body;
    const updates: any = { monthly_limit };
    if (period) updates.period = period;
    const { error } = await supabase.from("budgets").update(updates).eq("id", req.params.budgetId);
    if (error) throw error;
    res.json({ message: "Budget updated" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

app.delete("/api/budgets/:budgetId", async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.from("budgets").delete().eq("id", req.params.budgetId);
    if (error) throw error;
    res.json({ message: "Budget deleted" });
  } catch (e: any) { res.status(500).json({ error: e?.message }); }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`WealthPal AI Backend running on port ${PORT}`);
});
