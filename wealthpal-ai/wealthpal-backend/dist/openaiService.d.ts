export declare function transcribeAudio(audioStream: any): Promise<string>;
export declare function categorizeTransactions(transactions: Array<{
    merchant: string;
    amount: number;
    description?: string;
}>): Promise<any>;
export declare function generateFinancialInsight(financialSummary: {
    monthly_income: number;
    monthly_spending: number;
    top_categories: Array<{
        name: string;
        amount: number;
    }>;
    debt: Array<{
        name: string;
        balance: number;
        interest: number;
    }>;
}): Promise<string>;
export declare function simpleChat(prompt: string): Promise<string>;
export declare function chatWithAssistant(userMessage: string, staticContext: {
    today: string;
    accounts: Array<{
        name: string;
        type: string;
        subtype: string;
        balance: number;
    }>;
    goals_section: string;
    budgets_section: string;
    debt: Array<{
        name: string;
        balance: number;
        interest: number;
    }>;
}, history: Array<{
    role: "user" | "assistant";
    content: string;
}>, toolExecutor: (name: string, args: any) => Promise<any>): Promise<string>;
//# sourceMappingURL=openaiService.d.ts.map