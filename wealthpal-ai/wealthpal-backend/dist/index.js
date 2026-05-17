"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const supabase_1 = __importDefault(require("./supabase"));
const plaidService = __importStar(require("./plaidService"));
const openaiService = __importStar(require("./openaiService"));
const auth = __importStar(require("./auth"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "WealthPal AI Backend" });
});
// ============================================
// AUTH ROUTES
// ============================================
// Signup
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }
        const { user, error } = await auth.signupUser(email, password);
        if (error) {
            return res.status(400).json({ error: error.message || 'Error' });
        }
        if (user) {
            await auth.createUserProfile(user.id, email);
        }
        res.json({ user, message: "Signup successful" });
    }
    catch (error) {
        console.error("Error signing up:", error);
        res.status(500).json({ error: "Signup failed" });
    }
});
// Login
app.post("/api/auth/login", async (req, res) => {
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
    }
    catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ error: "Login failed" });
    }
});
// ============================================
// PLAID ROUTES
// ============================================
app.post("/api/plaid/create-link-token", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "User ID required" });
        }
        const linkToken = await plaidService.createLinkToken(userId);
        res.json({ link_token: linkToken });
    }
    catch (error) {
        console.error("Error creating link token:", error);
        res.status(500).json({ error: "Failed to create link token" });
    }
});
app.post("/api/plaid/exchange-token", async (req, res) => {
    try {
        const { publicToken, userId } = req.body;
        if (!publicToken || !userId) {
            return res.status(400).json({ error: "Public token and user ID required" });
        }
        const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
        // Store in database
        const { error } = await supabase_1.default
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
        if (error)
            throw error;
        res.json({ accessToken, itemId, message: "Account connected" });
    }
    catch (error) {
        console.error("Error exchanging token:", error);
        res.status(500).json({ error: "Failed to exchange token" });
    }
});
app.post("/api/transactions/sync", async (req, res) => {
    try {
        const { userId, accessToken, startDate, endDate } = req.body;
        if (!userId || !accessToken || !startDate || !endDate) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const transactions = await plaidService.getTransactions(accessToken, startDate, endDate);
        const transactionsToCategories = transactions.map((t) => ({
            merchant: t.merchant_name || "Unknown",
            amount: t.amount,
            description: t.name,
        }));
        const categories = await openaiService.categorizeTransactions(transactionsToCategories);
        const savedTransactions = [];
        for (const transaction of transactions) {
            const merchant = transaction.merchant_name || "Unknown";
            const category = categories[merchant] || "Other";
            const { data, error } = await supabase_1.default
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
    }
    catch (error) {
        console.error("Error syncing transactions:", error);
        res.status(500).json({ error: "Failed to sync transactions" });
    }
});
// ============================================
// AI ROUTES
// ============================================
app.get("/api/ai/financial-summary/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: transactions, error: txError } = await supabase_1.default
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .gte("transaction_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
        if (txError)
            throw txError;
        const monthly_spending = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
        const categoryMap = {};
        transactions?.forEach((t) => {
            categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
        });
        const top_categories = Object.entries(categoryMap)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
        const { data: debts, error: debtsError } = await supabase_1.default
            .from("debts")
            .select("*")
            .eq("user_id", userId);
        if (debtsError)
            throw debtsError;
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
    }
    catch (error) {
        console.error("Error generating summary:", error);
        res.status(500).json({ error: "Failed to generate summary" });
    }
});
app.post("/api/ai/chat", async (req, res) => {
    try {
        console.log("[/api/ai/chat] Request received:", req.body);
        const { userId, message } = req.body;
        if (!userId || !message) {
            console.warn("[/api/ai/chat] Missing userId or message");
            return res.status(400).json({ error: "User ID and message required" });
        }
        console.log(`[/api/ai/chat] Fetching transactions for userId: ${userId}`);
        const { data: summaryData, error: txError } = await supabase_1.default
            .from("transactions")
            .select("*")
            .eq("user_id", userId);
        if (txError) {
            console.error("[/api/ai/chat] Transaction fetch error:", txError);
        }
        const monthly_spending = summaryData?.reduce((sum, t) => sum + t.amount, 0) || 0;
        const categoryMap = {};
        summaryData?.forEach((t) => {
            categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
        });
        const top_categories = Object.entries(categoryMap)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
        console.log(`[/api/ai/chat] Fetching debts for userId: ${userId}`);
        const { data: debts, error: debtError } = await supabase_1.default
            .from("debts")
            .select("*")
            .eq("user_id", userId);
        if (debtError) {
            console.error("[/api/ai/chat] Debt fetch error:", debtError);
        }
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
        console.log(`[/api/ai/chat] Calling OpenAI service with message: "${message.substring(0, 50)}..."`);
        const response = await openaiService.chatWithAssistant(message, summary);
        console.log(`[/api/ai/chat] OpenAI response received: "${response.substring(0, 50)}..."`);
        console.log("[/api/ai/chat] Saving chat messages to database");
        await supabase_1.default.from("chat_messages").insert([
            { user_id: userId, role: "user", content: message },
            { user_id: userId, role: "assistant", content: response },
        ]);
        res.json({ response });
    }
    catch (error) {
        const errorName = error?.name || "Unknown";
        const errorMessage = error?.message || JSON.stringify(error) || "Failed to process chat";
        const errorType = error?.code || "UNKNOWN";
        const detailedError = `[${errorName}] ${errorMessage} (Code: ${errorType})`;
        console.error("[/api/ai/chat] Error in chat:", detailedError);
        console.error("[/api/ai/chat] Full error:", error);
        res.status(500).json({
            error: detailedError,
            reason: errorMessage,
            type: errorName,
            timestamp: new Date().toISOString()
        });
    }
});
// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`WealthPal AI Backend running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map