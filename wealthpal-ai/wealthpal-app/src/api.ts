import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export const plaidAPI = {
  createLinkToken: async (userId: string) => {
    const response = await api.post("/api/plaid/create-link-token", { userId });
    return response.data.link_token;
  },

  exchangeToken: async (publicToken: string, userId: string) => {
    const response = await api.post("/api/plaid/exchange-token", {
      publicToken,
      userId,
    });
    return response.data;
  },
};

export const transactionsAPI = {
  syncTransactions: async (
    userId: string,
    accessToken: string,
    startDate: string,
    endDate: string
  ) => {
    const response = await api.post("/api/transactions/sync", {
      userId,
      accessToken,
      startDate,
      endDate,
    });
    return response.data;
  },
};

export const aiAPI = {
  getFinancialSummary: async (userId: string) => {
    const response = await api.get(`/api/ai/financial-summary/${userId}`);
    return response.data;
  },

  chat: async (userId: string, message: string) => {
    const response = await api.post("/api/ai/chat", { userId, message });
    return response.data.response;
  },
};

export default api;
