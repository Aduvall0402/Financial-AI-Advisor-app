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

const openai = new OpenAI({ apiKey: openaiKey });

// Transcribe audio using Whisper
export async function transcribeAudio(audioStream: any): Promise<string> {
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioStream,
    language: "en",
  });
  return response.text || "";
}

// Categorize transactions using AI
export async function categorizeTransactions(
  transactions: Array<{ merchant: string; amount: number; description?: string }>
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
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1000"),
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");
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
Top Spending Categories: ${financialSummary.top_categories.map((c) => `${c.name}: $${c.amount}`).join(", ")}
Debts: ${financialSummary.debt.map((d) => `${d.name}: $${d.balance} at ${d.interest}% interest`).join(", ")}

Provide insights that are specific, actionable, and honest.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1000"),
    });
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating insight:", error);
    throw error;
  }
}

// Tool definitions — the AI calls these to query real data
const CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_spending_total",
      description: "Get the exact total amount spent between two dates (income and transfers excluded automatically). Use this for any 'how much did I spend' question.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date YYYY-MM-DD inclusive" },
          end_date: { type: "string", description: "End date YYYY-MM-DD inclusive" },
          category: { type: "string", description: "Optional: filter by a specific category key (e.g. FOOD_AND_DRINK, TRANSPORTATION)" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transactions",
      description: "Fetch a list of transactions. Use for questions about specific merchants, dates, or to find the largest purchase.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date YYYY-MM-DD" },
          end_date: { type: "string", description: "End date YYYY-MM-DD" },
          merchant: { type: "string", description: "Optional partial merchant name filter (case-insensitive)" },
          category: { type: "string", description: "Optional category filter" },
          limit: { type: "number", description: "Max results to return (default 20, max 50)" },
          order_by_amount: { type: "boolean", description: "If true, sort by amount descending (for largest purchase queries)" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_spending_by_category",
      description: "Get spending broken down by category for a date range. Use for 'what did I spend the most on' or category comparison questions.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date YYYY-MM-DD" },
          end_date: { type: "string", description: "End date YYYY-MM-DD" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_merchants",
      description: "Get the merchants where the most money was spent in a date range.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" },
          limit: { type: "number", description: "Number of top merchants to return (default 5)" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
];

// Simple one-shot completion (no tools, no history)
export async function simpleChat(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "500"),
  });
  return response.choices[0].message.content || "";
}

// Chat with AI finance assistant — uses tool calling for accurate live data
export async function chatWithAssistant(
  userMessage: string,
  staticContext: {
    today: string;
    accounts: Array<{ name: string; type: string; subtype: string; balance: number }>;
    goals_section: string;
    budgets_section: string;
    debt: Array<{ name: string; balance: number; interest: number }>;
  },
  history: Array<{ role: "user" | "assistant"; content: string }>,
  toolExecutor: (name: string, args: any) => Promise<any>
): Promise<string> {
  const accountsSection = staticContext.accounts.length
    ? staticContext.accounts.map(a => `  - ${a.name} (${a.subtype}): $${a.balance.toFixed(2)}`).join("\n")
    : "  - No linked accounts";

  const systemPrompt = `You are WealthPal AI, a sharp and honest personal finance assistant. You have LIVE database access via tools — use them to get exact data before answering any spending question.

TODAY: ${staticContext.today}

LINKED ACCOUNTS:
${accountsSection}

GOALS:
${staticContext.goals_section || "  - None set"}

ACTIVE BUDGETS:
${staticContext.budgets_section || "  - None set"}

DEBTS: ${staticContext.debt.length > 0 ? staticContext.debt.map(d => `${d.name} ($${d.balance} @ ${d.interest}%)`).join(", ") : "None"}

RULES:
1. For ANY spending question ("how much", "did I spend", "what did I buy", "largest purchase"), call a tool FIRST — never guess or estimate.
2. Be brutally concise: 1-3 sentences max unless detail is explicitly requested.
3. Yes/no questions: answer yes or no FIRST, then one sentence of context.
4. Use exact dollar amounts from tool results — never round or say "around."
5. Do not use filler phrases like "Great question!", "Absolutely!", or "I'd be happy to."
6. If something looks financially unwise, say so directly.
7. Reference specific merchant names, dates, and amounts from tool results.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(history.map(m => ({ role: m.role, content: m.content })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
    { role: "user", content: userMessage },
  ];

  // Agentic loop — let AI call tools until it has the data it needs
  for (let i = 0; i < 5; i++) {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      tools: CHAT_TOOLS,
      tool_choice: "auto",
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1000"),
    });

    const choice = response.choices[0];
    messages.push(choice.message as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    if (choice.finish_reason === "stop") {
      return choice.message.content || "";
    }

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        let result: any;
        try {
          const args = JSON.parse(toolCall.function.arguments);
          result = await toolExecutor(toolCall.function.name, args);
        } catch (e: any) {
          result = { error: e.message };
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      // Unexpected finish reason
      return choice.message.content || "";
    }
  }

  return "I ran into an issue fetching your data. Please try again.";
}
