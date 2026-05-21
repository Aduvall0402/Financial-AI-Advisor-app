import { OpenAI } from "openai";

const rawOpenaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
const openaiKey = rawOpenaiKey.replace(/\s+/g, "");
if (!openaiKey) {
  throw new Error('OPENAI_API_KEY is required. Set it in your environment variables.');
}
if (rawOpenaiKey !== openaiKey) {
  console.log("OpenAI key whitespace sanitized from environment variable.");
}
console.log(`OpenAI key loaded: ${openaiKey.slice(0, 10)}...${openaiKey.slice(-4)}`);

const openai = new OpenAI({
  apiKey: openaiKey,
});

// Categorize transactions using AI
export async function categorizeTransactions(
  transactions: Array<{
    merchant: string;
    amount: number;
    description?: string;
  }>
) {
  const transactionList = transactions
    .map((t) => `${t.merchant || t.description} - $${t.amount}`)
    .join("\n");

  const prompt = `Categorize these transactions into appropriate financial categories (e.g., Groceries, Gas, Entertainment, Utilities, Subscriptions, Healthcare, etc.).

Transactions:
${transactionList}

Return ONLY a JSON object with merchant/description as key and category as value. Example:
{
  "Walmart - $45.50": "Groceries",
  "Shell Gas - $60.00": "Gas"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1000"),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not extract JSON from response");

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error categorizing transactions:", error);
    throw error;
  }
}

// Generate financial insights using AI
export async function generateFinancialInsight(financialSummary: {
  monthly_income: number;
  monthly_spending: number;
  top_categories: Array<{ name: string; amount: number }>;
  debt: Array<{ name: string; balance: number; interest: number }>;
}) {
  const prompt = `You are a financial advisor. Based on this financial data, provide 2-3 key insights and actionable recommendations:

Monthly Income: $${financialSummary.monthly_income}
Monthly Spending: $${financialSummary.monthly_spending}
Top Spending Categories: ${financialSummary.top_categories
    .map((c) => `${c.name}: $${c.amount}`)
    .join(", ")}
Debts: ${financialSummary.debt
    .map(
      (d) => `${d.name}: $${d.balance} at ${d.interest}% interest`
    )
    .join(", ")}

Provide insights that are:
- Specific to their situation
- Actionable
- Encouraging but honest`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1000"),
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating insight:", error);
    throw error;
  }
}

// Chat with AI finance assistant
export async function chatWithAssistant(
  userMessage: string,
  financialSummary: {
    monthly_income: number;
    monthly_spending: number;
    weekly_spending?: number;
    spending_windows?: { [key: string]: number };
    top_categories: Array<{ name: string; amount: number }>;
    debt: Array<{ name: string; balance: number; interest: number }>;
    accounts?: Array<{ name: string; type: string; subtype: string; balance: number }>;
    recent_transactions?: Array<{ merchant: string; amount: number; category: string; date: string }>;
    goals_section?: string;
    budgets_section?: string;
    total_transactions?: number;
    today?: string;
  }
) {
  const accountsSection = financialSummary.accounts?.length
    ? financialSummary.accounts.map(a => `  - ${a.name} (${a.subtype}): $${a.balance.toFixed(2)}`).join("\n")
    : "  - No linked accounts";

  const recentTxSection = financialSummary.recent_transactions?.length
    ? financialSummary.recent_transactions.map(t => `  - ${t.date}: ${t.merchant} — $${t.amount.toFixed(2)} (${t.category})`).join("\n")
    : "  - No recent transactions";

  const today = financialSummary.today || new Date().toISOString().split("T")[0];
  const sw = financialSummary.spending_windows || {};

  const spendingWindowsSection = Object.keys(sw).length > 0
    ? Object.entries(sw).map(([window, amt]) => `  - Last ${window}: $${(amt as number).toFixed(2)}`).join("\n")
    : `  - Last 7 days: $${(financialSummary.weekly_spending || 0).toFixed(2)}\n  - Last 30 days: $${financialSummary.monthly_spending.toFixed(2)}`;

  const systemPrompt = `You are WealthPal AI, a friendly and knowledgeable personal finance assistant. You have FULL ACCESS to this user's complete financial data pulled directly from their bank via Plaid. Answer any question about their finances with precise numbers from this data.

TODAY: ${today}

PRE-COMPUTED SPENDING BY TIME WINDOW (use these exact numbers when asked about any time period):
${spendingWindowsSection}

TOP SPENDING CATEGORIES (last 30 days):
${financialSummary.top_categories.map(c => `  - ${c.name}: $${c.amount.toFixed(2)}`).join("\n") || "  - None yet"}

LINKED BANK ACCOUNTS:
${accountsSection}

GOALS:
${financialSummary.goals_section || "  - None set"}

ACTIVE BUDGETS:
${financialSummary.budgets_section || "  - None set"}

DEBTS: ${financialSummary.debt.length > 0 ? financialSummary.debt.map(d => `${d.name} ($${d.balance} @ ${d.interest}%)`).join(", ") : "None"}

ALL TRANSACTIONS (${financialSummary.total_transactions || 0} total, up to 150 shown newest first):
${recentTxSection}

CRITICAL INSTRUCTIONS:
- You have the COMPLETE transaction history above — ALWAYS use exact numbers from the data
- For any time period question (9 days, 2 weeks, etc.), filter the transaction list by date and sum — do NOT say you lack data
- The pre-computed spending windows above give you quick answers for 7, 9, 14, 30, 60, 90 day totals
- Reference specific merchant names, amounts, and dates from the data when relevant
- Be conversational, concise, and encouraging
- Give actionable advice tailored to their real spending patterns
- If asked about the future (budgets, projections), base it on their actual historical patterns`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1000"),
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    const err = error as any;
    const parts = [err?.message || 'Unknown OpenAI error'];
    if (err?.response?.status) {
      parts.push(`status=${err.response.status}`);
    }
    if (err?.response?.data) {
      parts.push(JSON.stringify(err.response.data));
    }
    const message = parts.join(' | ');
    console.error("Error in chat:", message);
    throw new Error(message);
  }
}
