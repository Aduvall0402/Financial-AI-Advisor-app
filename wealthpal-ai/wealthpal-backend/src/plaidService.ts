import { Configuration, PlaidApi } from "plaid";

const configuration = new Configuration({
  basePath:
    process.env.PLAID_ENV === "sandbox"
      ? "https://sandbox.plaid.com"
      : "https://production.plaid.com",
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

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

// Refresh transactions — triggers Plaid to pull latest data for the item
export async function refreshTransactions(accessToken: string) {
  try {
    await plaidClient.transactionsRefresh({ access_token: accessToken });
    console.log("transactionsRefresh called successfully");
  } catch (error: any) {
    // Not fatal — log and continue
    const detail = error?.response?.data || error?.message;
    console.log("transactionsRefresh skipped:", JSON.stringify(detail));
  }
}

// Fetch all transactions via transactionsSync (cursor-based, works without webhook init)
export async function getTransactions(accessToken: string) {
  try {
    let cursor: string | undefined = undefined;
    let added: any[] = [];
    let hasMore = true;
    let pages = 0;

    while (hasMore && pages < 10) {
      const params: any = { access_token: accessToken, count: 500 };
      if (cursor) params.cursor = cursor;

      const response = await plaidClient.transactionsSync(params);
      const data = response.data;

      added = added.concat(data.added || []);
      cursor = data.next_cursor || undefined;
      hasMore = !!data.has_more && !!cursor;
      pages++;
    }

    console.log(`transactionsSync: ${added.length} transactions across ${pages} page(s)`);
    return added;
  } catch (error: any) {
    const detail = error?.response?.data || error?.message || error;
    console.error("getTransactions error:", JSON.stringify(detail));
    // Re-throw with the full Plaid error message
    const msg = error?.response?.data?.error_message || error?.response?.data?.error_code || error?.message || "Failed to fetch transactions";
    throw new Error(msg);
  }
}

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
