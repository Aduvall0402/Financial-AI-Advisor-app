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
export declare function chatWithAssistant(userMessage: string, financialSummary: {
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
//# sourceMappingURL=openaiService.d.ts.map