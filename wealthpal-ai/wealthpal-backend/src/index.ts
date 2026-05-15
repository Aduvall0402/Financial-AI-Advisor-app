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

// Signup
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { user, error } = await auth.signupUser(email, password);

    if (error) {
      return res.status(400).json({ error: (error as any).message || 'Error' });
    }

    if (user) {
      await auth.createUserProfile(user.id, email);
    }

    res.json({ user, message: "Signup successful" });
  } catch (error) {
    console.error("Error signing up:", error);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
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

    res.json({ session, message: "Login successful" });
  } catch (error) {
    console.error("Error logging in:", error);
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
  } catch (error) {
    console.error("Error creating link token:", error);
    res.status(500).json({ error: "Failed to create link token" });
  }
});

app.post("/api/plaid/exchange-token", async (req: Request, res: Response) => {
  try {
    const { publicToken, userId } = req.body;

    if (!publicToken || !userId) {
      return res.status(400).json({ error: "Public token and user ID required" });
    }

    const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);

    // Store in database
    const { error } = await supabase
      .from("accounts")
      .insert([
        {
          user_id: userId,
          plaid_account_id: itemId,
          plaid_access_token: accessToken,
          account_name: "Connected Account",
          account_type: "checking",
          current_balance: 0,
        },
      ]);

    if (error) throw error;

    res.json({ accessToken, itemId, message: "Account connected" });
  } catch (error) {
    console.error("Error exchanging token:", error);
    res.status(500).json({ error: "Failed to exchange token" });
  }
});

app.post("/api/transactions/sync", async (req: Request, res: Response) => {
  try {
    const { userId, accessToken, startDate, endDate } = req.body;

    if (!userId || !accessToken || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const transactions = await plaidService.getTransactions(
      accessToken,
      startDate,
      endDate
    );

    const transactionsToCategories = transactions.map((t) => ({
      merchant: t.merchant_name || "Unknown",
      amount: t.amount,
      description: t.name,
    }));

    const categories = await openaiService.categorizeTransactions(
      transactionsToCategories
    );

    const savedTransactions = [];
    for (const transaction of transactions) {
      const merchant = transaction.merchant_name || "Unknown";
      const category = categories[merchant] || "Other";

      const { data, error } = await supabase
        .from("transactions")
        .insert([
          {
            user_id: userId,
            plaid_transaction_id: transaction.transaction_id,
            merchant_name: merchant,
            amount: Math.abs(transaction.amount),
            category: category,
            transaction_date: transaction.date,
            posted_date: transaction.date,
            description: transaction.name,
          },
        ])
        .select();

      if (!error && data) {
        savedTransactions.push(data[0]);
      }
    }

    res.json({ synced: savedTransactions.length, transactions: savedTransactions });
  } catch (error) {
    console.error("Error syncing transactions:", error);
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
      .gte(
        "transaction_date",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      );

    if (txError) throw txError;

    const monthly_spending =
      transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

    const categoryMap: { [key: string]: number } = {};
    transactions?.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });

    const top_categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const { data: debts, error: debtsError } = await supabase
      .from("debts")
      .select("*")
      .eq("user_id", userId);

    if (debtsError) throw debtsError;

    const debt = (debts || []).map((d) => ({
      name: d.debt_name,
      balance: d.current_balance,
      interest: d.interest_rate,
    }));

    const summary = {
      monthly_income: 0,
      monthly_spending,
      top_categories,
      debt,
    };

    res.json(summary);
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: "User ID and message required" });
    }

    const { data: summaryData } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId);

    const monthly_spending = summaryData?.reduce((sum, t) => sum + t.amount, 0) || 0;

    const categoryMap: { [key: string]: number } = {};
    summaryData?.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });

    const top_categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const { data: debts } = await supabase
      .from("debts")
      .select("*")
      .eq("user_id", userId);

    const debt = (debts || []).map((d) => ({
      name: d.debt_name,
      balance: d.current_balance,
      interest: d.interest_rate,
    }));

    const summary = {
      monthly_income: 0,
      monthly_spending,
      top_categories,
      debt,
    };

    const response = await openaiService.chatWithAssistant(message, summary as any);

    await supabase.from("chat_messages").insert([
      { user_id: userId, role: "user", content: message },
      { user_id: userId, role: "assistant", content: response },
    ]);

    res.json({ response });
  } catch (error) {
    console.error("Error in chat:", error);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`WealthPal AI Backend running on port ${PORT}`);
});
