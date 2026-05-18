import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const configuration = new Configuration({
  basePath:
    process.env.PLAID_ENV === "sandbox"
      ? PlaidEnvironments.Sandbox   
      : PlaidEnvironments.Production,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Create Link Token for Plaid Link UI
export async function createLinkToken(userId: string) {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "WealthPal AI",
      language: "en",
      products: ["transactions"] as any,
      country_codes: ["US"] as any,
    });

    return response.data.link_token;
  } catch (error) {
    console.error("Error creating link token:", error);
    throw error;
  }
}

// Exchange public token for access token
export async function exchangePublicToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    };
  } catch (error) {
    console.error("Error exchanging public token:", error);
    throw error;
  }
}

// Get transactions from account
export async function getTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
) {
  try {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    });

    return response.data.transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
}

// Get accounts from item
export async function getAccounts(accessToken: string) {
  try {
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    return response.data.accounts;
  } catch (error) {
    console.error("Error fetching accounts:", error);
    throw error;
  }
}
