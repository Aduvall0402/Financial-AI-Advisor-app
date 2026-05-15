import { create } from "zustand";

interface User {
  id: string;
  email: string;
  full_name?: string;
}

interface Account {
  id: string;
  account_name: string;
  current_balance: number;
  account_type: string;
}

interface Transaction {
  id: string;
  merchant_name: string;
  amount: number;
  category: string;
  transaction_date: string;
}

interface Debt {
  id: string;
  debt_name: string;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number;
}

interface AppStore {
  // User
  user: User | null;
  setUser: (user: User | null) => void;

  // Accounts
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;

  // Transactions
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;

  // Debts
  debts: Debt[];
  setDebts: (debts: Debt[]) => void;

  // UI
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Summary
  monthlySpending: number;
  setMonthlySpending: (amount: number) => void;

  // Clear all
  reset: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  accounts: [],
  setAccounts: (accounts) => set({ accounts }),
  addAccount: (account) =>
    set((state) => ({ accounts: [...state.accounts, account] })),

  transactions: [],
  setTransactions: (transactions) => set({ transactions }),

  debts: [],
  setDebts: (debts) => set({ debts }),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  monthlySpending: 0,
  setMonthlySpending: (monthlySpending) => set({ monthlySpending }),

  reset: () =>
    set({
      user: null,
      accounts: [],
      transactions: [],
      debts: [],
      isLoading: false,
      monthlySpending: 0,
    }),
}));
