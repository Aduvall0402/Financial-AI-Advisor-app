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
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const supabase_1 = __importDefault(require("./supabase"));
const plaidService = __importStar(require("./plaidService"));
const plaidService_1 = require("./plaidService");
const openaiService = __importStar(require("./openaiService"));
const auth = __importStar(require("./auth"));
const upload = (0, multer_1.default)({ dest: "/tmp/wealthpal-audio/" });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// ============================================
// AUTH MIDDLEWARE
// ============================================
// Verifies the Supabase JWT and attaches user to req.authUser
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required" });
    }
    const token = authHeader.slice(7);
    try {
        const { data: { user }, error } = await supabase_1.default.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
        }
        req.authUser = user;
        next();
    }
    catch {
        return res.status(401).json({ error: "Authentication failed" });
    }
}
// Ensures the authenticated user matches the :userId param (or body.userId)
function selfOnly(req, res, next) {
    const authUser = req.authUser;
    const requestedId = req.params.userId || req.params.uid;
    if (requestedId && authUser.id !== requestedId) {
        return res.status(403).json({ error: "Access denied" });
    }
    next();
}
// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "WealthPal AI Backend" });
});
// ============================================
// AUTH ROUTES
// ============================================
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { email, password, fullName, firstName, lastName } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }
        const fn = firstName || (fullName ? fullName.split(" ")[0] : "");
        const ln = lastName || (fullName ? fullName.split(" ").slice(1).join(" ") : "");
        const { user, session, needsVerification, error } = await auth.signupUser(email, password, fullName || `${fn} ${ln}`.trim());
        if (error) {
            return res.status(400).json({ error: error.message || "Signup failed" });
        }
        if (user) {
            await auth.createUserProfile(user.id, email, fn, ln);
        }
        res.json({ user, session, needs_verification: needsVerification, message: "Signup successful" });
    }
    catch (error) {
        res.status(500).json({ error: "Signup failed" });
    }
});
app.post("/api/auth/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: "Email required" });
        const { error } = await auth.resendVerification(email);
        if (error)
            return res.status(400).json({ error: error.message || "Failed to resend" });
        res.json({ message: "Verification email sent" });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to resend verification" });
    }
});
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
    }
    catch (error) {
        res.status(500).json({ error: "Login failed" });
    }
});
app.post("/api/auth/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken)
            return res.status(400).json({ error: "Refresh token required" });
        const { data, error } = await supabase_1.default.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data.session) {
            return res.status(401).json({ error: "Session expired. Please sign in again." });
        }
        res.json({ session: data.session });
    }
    catch {
        res.status(500).json({ error: "Failed to refresh session" });
    }
});
// ============================================
// PLAID ROUTES
// ============================================
app.post("/api/plaid/create-link-token", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        if (!userId) {
            return res.status(400).json({ error: "User ID required" });
        }
        const linkToken = await plaidService.createLinkToken(userId);
        res.json({ link_token: linkToken });
    }
    catch (error) {
        const plaidError = error?.response?.data || error?.message || error;
        console.error("Error creating link token:", JSON.stringify(plaidError));
        res.status(500).json({ error: "Failed to create link token", detail: plaidError });
    }
});
app.post("/api/plaid/exchange-token", requireAuth, async (req, res) => {
    try {
        const { publicToken } = req.body;
        const userId = req.authUser.id;
        if (!publicToken || !userId) {
            return res.status(400).json({ error: "Public token and user ID required" });
        }
        const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
        // Check if this Plaid item is already connected (avoid duplicate items)
        const { data: existing } = await supabase_1.default.from("accounts").select("id").eq("user_id", userId).eq("plaid_account_id", itemId);
        if (!existing?.length) {
            const { error } = await supabase_1.default
                .from("accounts")
                .insert([{
                    user_id: userId,
                    plaid_account_id: itemId,
                    plaid_access_token: accessToken,
                    account_name: "Connected Account",
                    account_type: "checking",
                    current_balance: 0,
                }]);
            if (error)
                throw error;
        }
        else {
            // Update the access token in case it changed
            await supabase_1.default.from("accounts").update({ plaid_access_token: accessToken }).eq("user_id", userId).eq("plaid_account_id", itemId);
        }
        res.json({ plaid_account_id: itemId, itemId, message: "Account connected" });
    }
    catch (error) {
        const errorMessage = error?.response?.data?.error_message || error?.message || "Failed to exchange token";
        res.status(500).json({ error: errorMessage });
    }
});
app.get("/api/plaid/accounts/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase_1.default
            .from("accounts")
            .select("id, plaid_access_token, plaid_account_id")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error || !data?.length) {
            return res.status(404).json({ error: "No connected account found" });
        }
        // Aggregate accounts from all linked Plaid items, keyed by DB row id
        const allAccounts = [];
        const dbAccounts = [];
        for (const row of data) {
            if (!row.plaid_access_token)
                continue;
            try {
                const accounts = await plaidService.getAccounts(row.plaid_access_token);
                allAccounts.push(...accounts);
                let institutionName = '';
                try {
                    const itemResp = await plaidService_1.plaidClient.itemGet({ access_token: row.plaid_access_token });
                    const institutionId = itemResp.data.item.institution_id;
                    if (institutionId) {
                        const instResp = await plaidService_1.plaidClient.institutionsGetById({ institution_id: institutionId, country_codes: ['US'] });
                        institutionName = instResp.data.institution.name;
                    }
                }
                catch { /* institution name is optional */ }
                dbAccounts.push({ id: row.id, plaid_item_id: row.plaid_account_id, accounts, institutionName });
            }
            catch { /* skip failed items */ }
        }
        if (!allAccounts.length)
            return res.status(404).json({ error: "No connected account found" });
        res.json({ accounts: allAccounts, itemId: data[0].plaid_account_id, dbAccounts });
    }
    catch (error) {
        res.status(500).json({ error: error?.message || "Failed to fetch accounts" });
    }
});
// ============================================
// TRANSACTION ROUTES
// ============================================
app.get("/api/transactions/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase_1.default
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .order("transaction_date", { ascending: false })
            .limit(100);
        if (error)
            throw error;
        res.json({ transactions: data || [] });
    }
    catch (error) {
        res.status(500).json({ error: error?.message || "Failed to fetch transactions" });
    }
});
app.post("/api/transactions/sync/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: accountData, error: accountError } = await supabase_1.default
            .from("accounts")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (accountError || !accountData?.length) {
            return res.status(404).json({ error: "No connected account found" });
        }
        // If the transactions table is empty for this user, reset all cursors so Plaid
        // returns the full history instead of 0 transactions since the last cursor.
        const { count: txCount } = await supabase_1.default
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId);
        if (txCount === 0) {
            await supabase_1.default.from("accounts").update({ plaid_sync_cursor: null }).eq("user_id", userId);
            accountData.forEach((a) => { a.plaid_sync_cursor = null; });
            console.log(`User ${userId} has 0 transactions — reset cursors for full re-pull`);
        }
        let synced = 0;
        let failed = 0;
        let totalTx = 0;
        for (const acct of accountData) {
            if (!acct.plaid_access_token)
                continue;
            try {
                await plaidService.refreshTransactions(acct.plaid_access_token);
                const { transactions, nextCursor } = await plaidService.getTransactions(acct.plaid_access_token, acct.plaid_sync_cursor || undefined);
                totalTx += transactions.length;
                for (const tx of transactions) {
                    // Insert only — never overwrite existing rows (preserves reviewed, category, etc.)
                    const { error, data: inserted } = await supabase_1.default
                        .from("transactions")
                        .insert([{
                            user_id: userId,
                            account_id: acct.id,
                            plaid_transaction_id: tx.transaction_id,
                            merchant_name: tx.merchant_name || tx.name || "Unknown",
                            merchant_category_code: tx.payment_channel || null,
                            amount: Math.abs(tx.amount),
                            currency_code: tx.iso_currency_code || tx.unofficial_currency_code || "USD",
                            category: (tx.personal_finance_category?.primary || tx.category?.[0] || "Other"),
                            category_confidence: null,
                            is_pending: tx.pending ?? false,
                            transaction_date: tx.date,
                            posted_date: tx.authorized_date || null,
                            description: tx.name,
                            reviewed: false,
                        }])
                        .select("id");
                    if (error) {
                        // 23505 = unique_violation (already exists) — not a real error
                        if (error.code !== '23505') {
                            failed++;
                            if (failed <= 3)
                                console.error("Insert error for tx", tx.transaction_id, JSON.stringify(error));
                        }
                    }
                    else if (inserted?.length) {
                        synced++;
                    }
                }
                // Save cursor so next sync only fetches new transactions from Plaid
                if (nextCursor) {
                    await supabase_1.default.from("accounts").update({ plaid_sync_cursor: nextCursor }).eq("id", acct.id);
                }
            }
            catch (itemErr) {
                console.error("Error syncing account item", acct.plaid_account_id, itemErr?.message);
            }
        }
        console.log(`Synced ${synced}/${totalTx} new transactions for user ${userId} (${failed} failed)`);
        res.json({ synced, total: totalTx });
    }
    catch (error) {
        const msg = error?.message || "Failed to sync transactions";
        console.error("Sync error:", msg);
        res.status(500).json({ error: msg });
    }
});
app.post("/api/transactions", requireAuth, async (req, res) => {
    try {
        const user_id = req.authUser.id;
        const { merchant_name, amount, transaction_date, category, description, source } = req.body;
        if (!user_id || !merchant_name || amount == null) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const { data, error } = await supabase_1.default
            .from("transactions")
            .insert([{
                user_id,
                merchant_name,
                amount: Math.abs(parseFloat(amount)),
                transaction_date: transaction_date || new Date().toISOString().split("T")[0],
                category: category || "GENERAL_MERCHANDISE",
                description: description || merchant_name,
                source: source || "manual",
                is_pending: false,
                currency_code: "USD",
            }])
            .select();
        if (error)
            throw error;
        res.json({ transaction: data[0] });
    }
    catch (error) {
        res.status(500).json({ error: error?.message || "Failed to create transaction" });
    }
});
app.patch("/api/transactions/:txId", requireAuth, async (req, res) => {
    try {
        const { txId } = req.params;
        const userId = req.authUser.id;
        const { merchant_name, amount, category, transaction_date, description, reviewed } = req.body;
        const updateFields = { updated_at: new Date().toISOString() };
        if (merchant_name !== undefined)
            updateFields.merchant_name = merchant_name;
        if (amount !== undefined)
            updateFields.amount = amount;
        if (category !== undefined)
            updateFields.category = category;
        if (transaction_date !== undefined)
            updateFields.transaction_date = transaction_date;
        if (description !== undefined)
            updateFields.description = description;
        if (reviewed !== undefined)
            updateFields.reviewed = reviewed;
        const { error } = await supabase_1.default
            .from("transactions")
            .update(updateFields)
            .eq("id", txId)
            .eq("user_id", userId);
        if (error)
            throw error;
        res.json({ message: "Transaction updated" });
    }
    catch (error) {
        res.status(500).json({ error: error?.message || "Failed to update transaction" });
    }
});
// Legacy sync endpoint (kept for compatibility)
app.post("/api/transactions/sync", async (req, res) => {
    try {
        const { userId, accessToken, startDate, endDate } = req.body;
        if (!userId || !accessToken || !startDate || !endDate) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const { transactions } = await plaidService.getTransactions(accessToken);
        let synced = 0;
        for (const tx of transactions) {
            const { error } = await supabase_1.default
                .from("transactions")
                .insert([{
                    user_id: userId,
                    plaid_transaction_id: tx.transaction_id,
                    merchant_name: tx.merchant_name || "Unknown",
                    amount: Math.abs(tx.amount),
                    category: tx.category?.[0] || "Other",
                    transaction_date: tx.date,
                    description: tx.name,
                }]);
            if (!error)
                synced++;
        }
        res.json({ synced });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to sync transactions" });
    }
});
// ============================================
// AI ROUTES
// ============================================
app.get("/api/ai/financial-summary/:userId", requireAuth, selfOnly, async (req, res) => {
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
        const { data: debts } = await supabase_1.default.from("debts").select("*").eq("user_id", userId);
        const debt = (debts || []).map((d) => ({ name: d.debt_name, balance: d.current_balance, interest: d.interest_rate }));
        res.json({ monthly_income: 0, monthly_spending, top_categories, debt });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate summary" });
    }
});
app.post("/api/ai/chat", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { message, history } = req.body;
        if (!userId || !message) {
            return res.status(400).json({ error: "User ID and message required" });
        }
        // Check subscription and rate limit for free users
        const { data: userRow } = await supabase_1.default.from("users").select("is_subscribed").eq("id", userId).single();
        const isSubscribed = userRow?.is_subscribed === true;
        if (!isSubscribed) {
            const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
            const { count } = await supabase_1.default
                .from("ai_usage")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .gte("created_at", windowStart);
            if ((count || 0) >= 6) {
                return res.status(429).json({ error: "Free plan limit reached (6 AI requests per 12 hours). Upgrade to WealthPal Premium for unlimited access.", rate_limited: true });
            }
            try {
                await supabase_1.default.from("ai_usage").insert([{ user_id: userId }]);
            }
            catch { /* best-effort */ }
        }
        const rawToday = req.body.today || "";
        const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(rawToday) ? rawToday : new Date().toISOString().split("T")[0];
        // Categories that are never "spending"
        const NON_SPENDING_CATS = new Set([
            'INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'TRANSFER',
            'INTEREST_EARNED', 'PAYROLL', 'REFUND', 'LOAN_PROCEEDS',
        ]);
        const isSpendingCat = (cat) => !NON_SPENDING_CATS.has((cat || '').toUpperCase());
        // Tool executor — each tool queries Supabase directly for exact data
        const toolExecutor = async (name, args) => {
            switch (name) {
                case 'get_spending_total': {
                    const { data } = await supabase_1.default
                        .from("transactions")
                        .select("amount, category")
                        .eq("user_id", userId)
                        .gte("transaction_date", args.start_date)
                        .lte("transaction_date", args.end_date);
                    let rows = (data || []).filter((t) => isSpendingCat(t.category));
                    if (args.category)
                        rows = rows.filter((t) => t.category?.toUpperCase() === args.category.toUpperCase());
                    const total = rows.reduce((s, t) => s + parseFloat(t.amount), 0);
                    return { total: parseFloat(total.toFixed(2)), transaction_count: rows.length, start_date: args.start_date, end_date: args.end_date };
                }
                case 'get_transactions': {
                    const { data } = await supabase_1.default
                        .from("transactions")
                        .select("merchant_name, amount, category, transaction_date, description")
                        .eq("user_id", userId)
                        .gte("transaction_date", args.start_date)
                        .lte("transaction_date", args.end_date)
                        .order("transaction_date", { ascending: false });
                    let rows = (data || []).filter((t) => isSpendingCat(t.category));
                    if (args.merchant) {
                        const m = args.merchant.toLowerCase();
                        rows = rows.filter((t) => (t.merchant_name || t.description || '').toLowerCase().includes(m));
                    }
                    if (args.category)
                        rows = rows.filter((t) => t.category?.toUpperCase() === args.category.toUpperCase());
                    if (args.order_by_amount)
                        rows.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
                    const limit = Math.min(args.limit || 20, 50);
                    return {
                        transactions: rows.slice(0, limit).map((t) => ({
                            merchant: t.merchant_name || t.description || 'Unknown',
                            amount: parseFloat(t.amount),
                            category: t.category,
                            date: t.transaction_date,
                        })),
                    };
                }
                case 'get_spending_by_category': {
                    const { data } = await supabase_1.default
                        .from("transactions")
                        .select("amount, category")
                        .eq("user_id", userId)
                        .gte("transaction_date", args.start_date)
                        .lte("transaction_date", args.end_date);
                    const catMap = {};
                    (data || []).filter((t) => isSpendingCat(t.category)).forEach((t) => {
                        const cat = t.category || 'Other';
                        catMap[cat] = (catMap[cat] || 0) + parseFloat(t.amount);
                    });
                    return {
                        categories: Object.entries(catMap)
                            .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
                            .sort((a, b) => b.total - a.total),
                    };
                }
                case 'get_top_merchants': {
                    const { data } = await supabase_1.default
                        .from("transactions")
                        .select("merchant_name, description, amount, category")
                        .eq("user_id", userId)
                        .gte("transaction_date", args.start_date)
                        .lte("transaction_date", args.end_date);
                    const merchantMap = {};
                    (data || []).filter((t) => isSpendingCat(t.category)).forEach((t) => {
                        const name = t.merchant_name || t.description || 'Unknown';
                        merchantMap[name] = (merchantMap[name] || 0) + parseFloat(t.amount);
                    });
                    const limit = Math.min(args.limit || 5, 20);
                    return {
                        merchants: Object.entries(merchantMap)
                            .map(([merchant, total]) => ({ merchant, total: parseFloat(total.toFixed(2)) }))
                            .sort((a, b) => b.total - a.total)
                            .slice(0, limit),
                    };
                }
                default:
                    return { error: `Unknown tool: ${name}` };
            }
        };
        // Fetch static context (accounts, goals, budgets, debts)
        let accounts = [];
        try {
            const { data: accountData } = await supabase_1.default
                .from("accounts")
                .select("plaid_access_token")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1);
            if (accountData?.length && accountData[0]?.plaid_access_token) {
                const plaidAccounts = await plaidService.getAccounts(accountData[0].plaid_access_token);
                accounts = plaidAccounts.map((a) => ({
                    name: a.name,
                    type: a.type,
                    subtype: a.subtype,
                    balance: a.balances.current || 0,
                }));
            }
        }
        catch { /* no linked account */ }
        const [debtsRes, goalsRes, budgetsRes] = await Promise.all([
            supabase_1.default.from("debts").select("debt_name,current_balance,interest_rate").eq("user_id", userId),
            supabase_1.default.from("goals").select("type,title,target_amount,current_amount,deadline").eq("user_id", userId),
            supabase_1.default.from("budgets").select("category,monthly_limit,period").eq("user_id", userId),
        ]);
        const debt = (debtsRes.data || []).map((d) => ({ name: d.debt_name, balance: d.current_balance, interest: d.interest_rate }));
        const goals_section = (goalsRes.data || []).map((g) => `  - ${g.type}: "${g.title}" — $${g.current_amount || 0}/$${g.target_amount || 0}${g.deadline ? ' by ' + g.deadline : ''}`).join("\n") || "  - None";
        const budgets_section = (budgetsRes.data || []).map((b) => `  - ${b.category} (${b.period}): limit $${b.monthly_limit}`).join("\n") || "  - None";
        const staticContext = { today: todayStr, accounts, goals_section, budgets_section, debt };
        const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
        const response = await openaiService.chatWithAssistant(message, staticContext, safeHistory, toolExecutor);
        try {
            await supabase_1.default.from("chat_messages").insert([
                { user_id: userId, role: "user", content: message },
                { user_id: userId, role: "assistant", content: response },
            ]);
        }
        catch { /* best-effort log */ }
        res.json({ response });
    }
    catch (error) {
        res.status(500).json({ error: error?.message || "Failed to process chat" });
    }
});
// ============================================
// NOTIFICATION SUMMARY ROUTE
// ============================================
app.get("/api/ai/notification-summary/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const { data: txData } = await supabase_1.default
            .from("transactions")
            .select("merchant_name, amount, category, transaction_date")
            .eq("user_id", userId)
            .gte("transaction_date", cutoff)
            .order("transaction_date", { ascending: false });
        const total = (txData || []).reduce((s, t) => s + parseFloat(t.amount), 0);
        const count = (txData || []).length;
        const catMap = {};
        (txData || []).forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + parseFloat(t.amount); });
        const topCat = Object.entries(catMap).sort(([, a], [, b]) => b - a)[0];
        const prompt = `Generate a single short sentence (under 20 words) for a push notification spending summary. The user spent $${total.toFixed(2)} across ${count} transactions in the last 30 days. Top category: ${topCat ? `${topCat[0]} ($${topCat[1].toFixed(2)})` : "none"}. Be encouraging and specific.`;
        const summary = await openaiService.simpleChat(prompt);
        res.json({ summary });
    }
    catch (error) {
        res.status(500).json({ error: error?.message || "Failed to generate summary" });
    }
});
// ============================================
// SUBSCRIPTION ROUTE
// ============================================
app.get("/api/users/:userId/subscription", requireAuth, selfOnly, async (req, res) => {
    try {
        const { data } = await supabase_1.default.from("users").select("is_subscribed").eq("id", req.params.userId).single();
        res.json({ is_subscribed: data?.is_subscribed === true });
    }
    catch {
        res.json({ is_subscribed: false });
    }
});
// ============================================
// PROFILE ROUTES
// ============================================
app.put("/api/auth/profile/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { firstName, lastName, email } = req.body;
        if (!userId || !firstName) {
            return res.status(400).json({ error: "User ID and first name required" });
        }
        const { error } = await supabase_1.default
            .from("users")
            .upsert([{ id: userId, email: email || "", "First Name": firstName, "Last Name": lastName || null }], { onConflict: "id" });
        if (error)
            return res.status(500).json({ error: error.message });
        res.json({ message: "Profile updated" });
    }
    catch (error) {
        res.status(500).json({ error: error?.message || "Failed to update profile" });
    }
});
// ============================================
// GOALS ROUTES
// ============================================
app.get("/api/goals/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { data, error } = await supabase_1.default.from("goals").select("*").eq("user_id", req.params.userId).order("created_at", { ascending: false });
        if (error)
            throw error;
        res.json({ goals: data || [] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.post("/api/goals", requireAuth, async (req, res) => {
    try {
        const user_id = req.authUser.id;
        const { type, title, target_amount, current_amount, category, deadline, notes } = req.body;
        const { data, error } = await supabase_1.default.from("goals").insert([{ user_id, type, title, target_amount, current_amount: current_amount || 0, category, deadline, notes }]).select();
        if (error)
            throw error;
        res.json({ goal: data[0] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.patch("/api/goals/:goalId", requireAuth, async (req, res) => {
    try {
        const fields = req.body;
        const userId = req.authUser.id;
        const { error } = await supabase_1.default.from("goals").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", req.params.goalId).eq("user_id", userId);
        if (error)
            throw error;
        res.json({ message: "Goal updated" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.delete("/api/goals/:goalId", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { error } = await supabase_1.default.from("goals").delete().eq("id", req.params.goalId).eq("user_id", userId);
        if (error)
            throw error;
        res.json({ message: "Goal deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
// ============================================
// GROUPS ROUTES
// ============================================
app.get("/api/groups/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { data, error } = await supabase_1.default.from("group_members").select("group_id, role, share_transactions, share_accounts, groups(id, name, created_by, created_at)").eq("user_id", req.params.userId);
        if (error)
            throw error;
        res.json({ groups: (data || []).map((r) => ({ ...r.groups, role: r.role, share_transactions: r.share_transactions, share_accounts: r.share_accounts })) });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.post("/api/groups", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { name } = req.body;
        const { data, error } = await supabase_1.default.from("groups").insert([{ name, created_by: userId }]).select();
        if (error)
            throw error;
        const group = data[0];
        await supabase_1.default.from("group_members").insert([{ group_id: group.id, user_id: userId, email: req.body.email || "", role: "admin" }]);
        res.json({ group });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.get("/api/groups/:groupId/detail", requireAuth, async (req, res) => {
    try {
        const [membersRes, goalsRes] = await Promise.all([
            supabase_1.default.from("group_members").select("*").eq("group_id", req.params.groupId),
            supabase_1.default.from("group_goals").select("*").eq("group_id", req.params.groupId),
        ]);
        const members = membersRes.data || [];
        // Fetch Plaid balances for members who share accounts
        const membersWithBalances = await Promise.all(members.map(async (m) => {
            if (!m.share_accounts || !m.user_id)
                return m;
            try {
                const { data: acctData } = await supabase_1.default.from("accounts").select("plaid_access_token").eq("user_id", m.user_id).order("created_at", { ascending: false }).limit(1);
                if (!acctData?.length || !acctData[0]?.plaid_access_token)
                    return m;
                const plaidAccts = await plaidService.getAccounts(acctData[0].plaid_access_token);
                const totalBalance = plaidAccts.reduce((s, a) => s + (a.balances?.current || 0), 0);
                return { ...m, total_balance: totalBalance };
            }
            catch {
                return m;
            }
        }));
        res.json({ members: membersWithBalances, goals: goalsRes.data || [] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.post("/api/groups/:groupId/members", requireAuth, async (req, res) => {
    try {
        const { email, share_transactions, share_accounts } = req.body;
        const { data: user } = await supabase_1.default.from("users").select("id").eq("email", email).single();
        const { error } = await supabase_1.default.from("group_members").upsert([{ group_id: req.params.groupId, user_id: user?.id || null, email, share_transactions: share_transactions ?? false, share_accounts: share_accounts ?? false }]);
        if (error)
            throw error;
        res.json({ message: "Member added" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.patch("/api/groups/:groupId/members/:email", requireAuth, async (req, res) => {
    try {
        const { share_transactions, share_accounts } = req.body;
        const { error } = await supabase_1.default.from("group_members").update({ share_transactions, share_accounts }).eq("group_id", req.params.groupId).eq("email", req.params.email);
        if (error)
            throw error;
        res.json({ message: "Member updated" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.delete("/api/groups/:groupId/members/:email", requireAuth, async (req, res) => {
    try {
        await supabase_1.default.from("group_members").delete().eq("group_id", req.params.groupId).eq("email", req.params.email);
        res.json({ message: "Member removed" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.get("/api/groups/:groupId/shared-transactions", requireAuth, async (req, res) => {
    try {
        const { data: members, error: membersError } = await supabase_1.default
            .from("group_members")
            .select("user_id, email")
            .eq("group_id", req.params.groupId)
            .eq("share_transactions", true);
        if (membersError)
            throw membersError;
        const userIds = (members || []).filter((m) => m.user_id).map((m) => m.user_id);
        if (!userIds.length)
            return res.json({ transactions: [] });
        const { data: txs, error: txError } = await supabase_1.default
            .from("transactions")
            .select("merchant_name, amount, category, transaction_date, user_id")
            .in("user_id", userIds)
            .order("transaction_date", { ascending: false })
            .limit(50);
        if (txError)
            throw txError;
        const emailMap = {};
        (members || []).forEach((m) => { if (m.user_id)
            emailMap[m.user_id] = m.email; });
        const enriched = (txs || []).map((tx) => ({
            merchant_name: tx.merchant_name,
            amount: tx.amount,
            category: tx.category,
            transaction_date: tx.transaction_date,
            member_email: emailMap[tx.user_id] || "Unknown",
        }));
        res.json({ transactions: enriched });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.post("/api/groups/:groupId/goals", requireAuth, async (req, res) => {
    try {
        const { title, target_amount, deadline, created_by } = req.body;
        const { data, error } = await supabase_1.default.from("group_goals").insert([{ group_id: req.params.groupId, title, target_amount, current_amount: 0, deadline, created_by }]).select();
        if (error)
            throw error;
        res.json({ goal: data[0] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.patch("/api/groups/:groupId/goals/:goalId", requireAuth, async (req, res) => {
    try {
        const { error } = await supabase_1.default.from("group_goals").update(req.body).eq("id", req.params.goalId);
        if (error)
            throw error;
        res.json({ message: "Goal updated" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.delete("/api/groups/:groupId", requireAuth, async (req, res) => {
    try {
        await supabase_1.default.from("group_members").delete().eq("group_id", req.params.groupId);
        await supabase_1.default.from("group_goals").delete().eq("group_id", req.params.groupId);
        await supabase_1.default.from("group_budgets").delete().eq("group_id", req.params.groupId);
        const { error } = await supabase_1.default.from("groups").delete().eq("id", req.params.groupId);
        if (error)
            throw error;
        res.json({ message: "Group deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
// ============================================
// GROUP BUDGET ROUTES
// ============================================
app.get("/api/groups/:groupId/budgets", requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase_1.default.from("group_budgets").select("*").eq("group_id", req.params.groupId).order("category");
        if (error)
            throw error;
        res.json({ budgets: data || [] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.post("/api/groups/:groupId/budgets", requireAuth, async (req, res) => {
    try {
        const { category, monthly_limit, period, created_by } = req.body;
        const { data, error } = await supabase_1.default.from("group_budgets").insert([{ group_id: req.params.groupId, category, monthly_limit, period: period || "monthly", created_by }]).select();
        if (error)
            throw error;
        res.json({ budget: data?.[0] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.delete("/api/groups/:groupId/budgets/:budgetId", requireAuth, async (req, res) => {
    try {
        const { error } = await supabase_1.default.from("group_budgets").delete().eq("id", req.params.budgetId);
        if (error)
            throw error;
        res.json({ message: "Budget deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
// ============================================
// BUDGET ROUTES
// ============================================
app.get("/api/budgets/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { data, error } = await supabase_1.default.from("budgets").select("*").eq("user_id", req.params.userId).order("category");
        if (error)
            throw error;
        res.json({ budgets: data || [] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.post("/api/budgets", requireAuth, async (req, res) => {
    try {
        const user_id = req.authUser.id;
        const { category, monthly_limit, period, paycycle_start, paycycle_freq } = req.body;
        if (!category || !monthly_limit)
            return res.status(400).json({ error: "category and monthly_limit required" });
        const { data, error } = await supabase_1.default
            .from("budgets")
            .insert([{ user_id, category, monthly_limit, period: period || "monthly", paycycle_start: paycycle_start || null, paycycle_freq: paycycle_freq || null }])
            .select();
        if (error)
            throw error;
        res.json({ budget: data?.[0] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.patch("/api/budgets/:budgetId", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { monthly_limit, period, paycycle_start, paycycle_freq } = req.body;
        const updates = { monthly_limit };
        if (period)
            updates.period = period;
        if (paycycle_start !== undefined)
            updates.paycycle_start = paycycle_start;
        if (paycycle_freq !== undefined)
            updates.paycycle_freq = paycycle_freq;
        const { error } = await supabase_1.default.from("budgets").update(updates).eq("id", req.params.budgetId).eq("user_id", userId);
        if (error)
            throw error;
        res.json({ message: "Budget updated" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.delete("/api/budgets/:budgetId", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { error } = await supabase_1.default.from("budgets").delete().eq("id", req.params.budgetId).eq("user_id", userId);
        if (error)
            throw error;
        res.json({ message: "Budget deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
// ============================================
// VOICE TRANSCRIPTION (Whisper)
// ============================================
app.post("/api/ai/transcribe", requireAuth, upload.single("audio"), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "No audio file uploaded" });
    try {
        const fileStream = fs_1.default.createReadStream(req.file.path);
        fileStream.name = req.file.originalname || "audio.m4a";
        const text = await openaiService.transcribeAudio(fileStream);
        fs_1.default.unlink(req.file.path, () => { });
        res.json({ text });
    }
    catch (e) {
        fs_1.default.unlink(req.file.path, () => { });
        res.status(500).json({ error: e?.message || "Transcription failed" });
    }
});
// ============================================
// RECEIPT SCAN (OpenAI Vision)
// ============================================
app.post("/api/ai/scan-receipt", requireAuth, async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64)
            return res.status(400).json({ error: "imageBase64 required" });
        const { OpenAI } = await Promise.resolve().then(() => __importStar(require("openai")));
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze this receipt image and extract transaction details. Return ONLY a JSON object with these fields: {"merchant_name": string, "amount": number (total amount paid, positive), "transaction_date": string (YYYY-MM-DD format, use today if unclear), "category": string (one of: GROCERY, DINING, GENERAL_MERCHANDISE, TRANSPORTATION, TRAVEL, ENTERTAINMENT, PERSONAL_CARE, MEDICAL, RENT_AND_UTILITIES, HOME_IMPROVEMENT, GENERAL_SERVICES, LOAN_PAYMENTS, BANK_FEES, OTHER), "description": string (brief description of purchase)}. If you cannot read the receipt clearly, still return your best guess. Return ONLY the JSON, no markdown.`,
                        },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
                    ],
                }],
            max_tokens: 300,
        });
        const content = response.choices[0]?.message?.content?.trim() || "{}";
        const cleaned = content.replace(/```json|```/g, "").trim();
        const result = JSON.parse(cleaned);
        res.json({ transaction: result });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || "Receipt scan failed" });
    }
});
// ============================================
// RECURRING TRANSACTIONS ROUTES
// ============================================
app.get("/api/recurring/:userId", requireAuth, selfOnly, async (req, res) => {
    try {
        const { data, error } = await supabase_1.default
            .from("recurring_transactions")
            .select("*")
            .eq("user_id", req.params.userId)
            .order("created_at", { ascending: false });
        if (error)
            throw error;
        res.json({ recurring: data || [] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.post("/api/recurring", requireAuth, async (req, res) => {
    try {
        const user_id = req.authUser.id;
        const { name, amount, category, frequency, day_of_month, interval_days, start_date } = req.body;
        const { data, error } = await supabase_1.default
            .from("recurring_transactions")
            .insert([{ user_id, name, amount, category: category || "OTHER", frequency: frequency || "monthly", day_of_month: day_of_month || 1, interval_days: interval_days || 30, start_date }])
            .select();
        if (error)
            throw error;
        res.json({ recurring: data?.[0] });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.patch("/api/recurring/:id", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { error } = await supabase_1.default
            .from("recurring_transactions")
            .update({ ...req.body, updated_at: new Date().toISOString() })
            .eq("id", req.params.id)
            .eq("user_id", userId);
        if (error)
            throw error;
        res.json({ message: "Updated" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
app.delete("/api/recurring/:id", requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.id;
        const { error } = await supabase_1.default.from("recurring_transactions").delete().eq("id", req.params.id).eq("user_id", userId);
        if (error)
            throw error;
        res.json({ message: "Deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e?.message });
    }
});
// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`WealthPal AI Backend running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map