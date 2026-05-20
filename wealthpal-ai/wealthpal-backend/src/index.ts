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
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const { user, error } = await auth.signupUser(email, password, fullName);
    if (error) {
      return res.status(400).json({ error: (error as any).message || "Signup failed" });
    }
    if (user) {
      await auth.createUserProfile(user.id, email, fullName);
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
    // Fetch full_name from users table and attach to response
    let fullName = session?.user?.user_metadata?.full_name || null;
    if (!fullName && session?.user?.id) {
      const { profile } = await auth.getUserProfile(session.user.id);
      fullName = profile?.full_name || null;
    }
    res.json({ session, full_name: fullName, message: "Login successful" });
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

    // Fetch all transactions for spending summary
    const { data: txData } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("transaction_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

    const monthly_spending = txData?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const categoryMap: { [key: string]: number } = {};
    txData?.forEach((t) => { categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount; });
    const top_categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Fetch recent transactions for AI context (last 20)
    const { data: recentTx } = await supabase
      .from("transactions")
      .select("merchant_name, amount, category, transaction_date")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })
      .limit(20);

    const recent_transactions = (recentTx || []).map(t => ({
      merchant: t.merchant_name || "Unknown",
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
    } catch { /* no linked account, continue without */ }

    // Fetch debts
    const { data: debts } = await supabase.from("debts").select("*").eq("user_id", userId);
    const debt = (debts || []).map((d) => ({ name: d.debt_name, balance: d.current_balance, interest: d.interest_rate }));

    const summary = { monthly_income: 0, monthly_spending, top_categories, debt, accounts, recent_transactions };
    const response = await openaiService.chatWithAssistant(message, summary);

    await supabase.from("chat_messages").insert([
      { user_id: userId, role: "user", content: message },
      { user_id: userId, role: "assistant", content: response },
    ]);
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
    const { fullName, email } = req.body;
    if (!userId || !fullName) {
      return res.status(400).json({ error: "User ID and name required" });
    }
    // First try UPDATE (row already exists)
    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({ full_name: fullName })
      .eq("id", userId)
      .select();
    if (updateError) throw updateError;
    // If no rows were updated (row doesn't exist yet), insert it
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("users")
        .insert([{ id: userId, email: email || "", full_name: fullName }]);
      if (insertError) throw insertError;
    }
    res.json({ message: "Profile updated" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update profile" });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`WealthPal AI Backend running on port ${PORT}`);
});
