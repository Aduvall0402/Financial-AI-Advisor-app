"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plaidClient = void 0;
exports.createLinkToken = createLinkToken;
exports.exchangePublicToken = exchangePublicToken;
exports.getTransactions = getTransactions;
exports.getAccounts = getAccounts;
const plaid_1 = require("plaid");
const configuration = new plaid_1.Configuration({
    basePath: process.env.PLAID_ENV === "sandbox"
        ? "https://sandbox.plaid.com"
        : "https://production.plaid.com",
    baseOptions: {
        headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
        },
    },
});
exports.plaidClient = new plaid_1.PlaidApi(configuration);
async function createLinkToken(userId) {
    try {
        const response = await exports.plaidClient.linkTokenCreate({
            user: { client_user_id: userId },
            client_name: "WealthPal AI",
            language: "en",
            products: ["transactions"],
            country_codes: ["US"],
        });
        return response.data.link_token;
    }
    catch (error) {
        console.error("Error creating link token:", error);
        throw error;
    }
}
async function exchangePublicToken(publicToken) {
    try {
        const response = await exports.plaidClient.itemPublicTokenExchange({
            public_token: publicToken,
        });
        return {
            accessToken: response.data.access_token,
            itemId: response.data.item_id,
        };
    }
    catch (error) {
        console.error("Error exchanging public token:", error);
        throw error;
    }
}
// refreshTransactions removed — requires transactions_refresh product not available on this account
// Fetch transactions via transactionsSync (cursor-based).
// Pass initialCursor to fetch only transactions added since that cursor (incremental).
// Omit initialCursor to fetch all historical transactions (full sync).
async function getTransactions(accessToken, initialCursor) {
    try {
        let cursor = initialCursor;
        let added = [];
        let hasMore = true;
        let pages = 0;
        while (hasMore && pages < 10) {
            const params = { access_token: accessToken, count: 500 };
            if (cursor)
                params.cursor = cursor;
            const response = await exports.plaidClient.transactionsSync(params);
            const data = response.data;
            added = added.concat(data.added || []);
            cursor = data.next_cursor || undefined;
            hasMore = !!data.has_more && !!cursor;
            pages++;
        }
        console.log(`transactionsSync: ${added.length} new transactions across ${pages} page(s) (cursor: ${initialCursor ? 'incremental' : 'full'})`);
        return { transactions: added, nextCursor: cursor };
    }
    catch (error) {
        const detail = error?.response?.data || error?.message || error;
        console.error("getTransactions error:", JSON.stringify(detail));
        const msg = error?.response?.data?.error_message || error?.response?.data?.error_code || error?.message || "Failed to fetch transactions";
        throw new Error(msg);
    }
}
async function getAccounts(accessToken) {
    try {
        const response = await exports.plaidClient.accountsGet({
            access_token: accessToken,
        });
        return response.data.accounts;
    }
    catch (error) {
        console.error("Error fetching accounts:", error);
        throw error;
    }
}
//# sourceMappingURL=plaidService.js.map