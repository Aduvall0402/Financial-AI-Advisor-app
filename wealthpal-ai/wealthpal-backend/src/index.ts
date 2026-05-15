import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import supabase from "./supabase";
import * as plaidService from "./plaidService";
import * as openaiService from "./openaiService";
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(cors());

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "WealthPal AI Backend" });
});

// ============================================
// PLAID ROUTES
// ============================================

// Create Plaid Link Token
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

// Exchange Public Token
app.post("/api/plaid/exchange-token", async (req: Request, res: Response) => {
  try {
    const { publicToken, userId } = req.body;

    if (!publicToken || !userId) {
      return res
        .status(400)
        .json({ error: "Public token and user ID required" });
    }

    const { accessToken, itemId } =
      await plaidService.exchangePublicToken(publicToken);

    // Store access token in Supabase (encrypted would be better in production)
    // For now, we'll just return it to the client
    res.json({ accessToken, itemId });
  } catch (error) {
    console.error("Error exchanging token:", error);
    res.status(500).json({ error: "Failed to exchange token" });
  }
});

// Sync Transactions
app.post("/api/transactions/sync", async (req: Request, res: Response) => {
  try {
    const { userId, accessToken, startDate, endDate } = req.body;

    if (!userId || !accessToken || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get transactions from Plaid
    const transactions = await plaidService.getTransactions(
      accessToken,
      startDate,
      endDate
    );

    // Categorize with AI
    const transactionsToCategories = transactions.map((t) => ({
      merchant: t.merchant_name || "Unknown",
      amount: t.amount,
      description: t.name,
    }));

    const categories =
      await openaiService.categorizeTransactions(transactionsToCategories);

    // Save to Supabase
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

// Generate Financial Summary
app.get("/api/ai/financial-summary/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get user's transactions
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("transaction_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (txError) throw txError;

    // Calculate summary
    const monthly_spending = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

    // Group by category
    const categoryMap: { [key: string]: number } = {};
    transactions?.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });

    const top_categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Get debts
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
      monthly_income: 0, // Would need to calculate from income transactions
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

// Chat Endpoint
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: "User ID and message required" });
    }

    // Get financial summary
    const summaryRes = await fetch(
      `http://localhost:${PORT}/api/ai/financial-summary/${userId}`
    );
    const summary = await summaryRes.json();

    // Chat with AI
    const response = await openaiService.chatWithAssistant(message, summary as any);

    // Save message to database
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
