"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizeTransactions = categorizeTransactions;
exports.generateFinancialInsight = generateFinancialInsight;
exports.chatWithAssistant = chatWithAssistant;
const openai_1 = require("openai");
const rawOpenaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
const openaiKey = rawOpenaiKey.replace(/\s+/g, "");
if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is required. Set it in your environment variables.');
}
if (rawOpenaiKey !== openaiKey) {
    console.log("OpenAI key whitespace sanitized from environment variable.");
}
console.log(`OpenAI key loaded: ${openaiKey.slice(0, 10)}...${openaiKey.slice(-4)}`);
const openai = new openai_1.OpenAI({
    apiKey: openaiKey,
});
// Categorize transactions using AI
async function categorizeTransactions(transactions) {
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
        if (!content)
            throw new Error("Empty response from OpenAI");
        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error("Could not extract JSON from response");
        return JSON.parse(jsonMatch[0]);
    }
    catch (error) {
        console.error("Error categorizing transactions:", error);
        throw error;
    }
}
// Generate financial insights using AI
async function generateFinancialInsight(financialSummary) {
    const prompt = `You are a financial advisor. Based on this financial data, provide 2-3 key insights and actionable recommendations:

Monthly Income: $${financialSummary.monthly_income}
Monthly Spending: $${financialSummary.monthly_spending}
Top Spending Categories: ${financialSummary.top_categories
        .map((c) => `${c.name}: $${c.amount}`)
        .join(", ")}
Debts: ${financialSummary.debt
        .map((d) => `${d.name}: $${d.balance} at ${d.interest}% interest`)
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
    }
    catch (error) {
        console.error("Error generating insight:", error);
        throw error;
    }
}
// Chat with AI finance assistant
async function chatWithAssistant(userMessage, financialSummary) {
    const systemPrompt = `You are WealthPal AI, a friendly and knowledgeable financial assistant. You help users understand their spending, make better financial decisions, and achieve their financial goals.

User's Current Financial Situation:
- Monthly Income: $${financialSummary.monthly_income}
- Monthly Spending: $${financialSummary.monthly_spending}
- Savings Rate: ${(((financialSummary.monthly_income - financialSummary.monthly_spending) / financialSummary.monthly_income) * 100).toFixed(1)}%
- Top Spending Categories: ${financialSummary.top_categories
        .map((c) => `${c.name} ($${c.amount})`)
        .join(", ")}
- Debts: ${financialSummary.debt.length > 0
        ? financialSummary.debt
            .map((d) => `${d.name} ($${d.balance} @ ${d.interest}%)`)
            .join(", ")
        : "None"}

Be conversational, helpful, and provide specific advice based on their situation. Ask clarifying questions when needed.`;
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
    }
    catch (error) {
        const err = error;
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
//# sourceMappingURL=openaiService.js.map