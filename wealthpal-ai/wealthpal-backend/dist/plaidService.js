"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plaidClient = void 0;
exports.createLinkToken = createLinkToken;
exports.exchangePublicToken = exchangePublicToken;
exports.refreshTransactions = refreshTransactions;
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
// Refresh transactions — triggers Plaid to pull latest data for the item
async function refreshTransactions(accessToken) {
    try {
        await exports.plaidClient.transactionsRefresh({ access_token: accessToken });
        console.log("transactionsRefresh called successfully");
    }
    catch (error) {
        // Not fatal — log and continue
        const detail = error?.response?.data || error?.message;
        console.log("transactionsRefresh skipped:", JSON.stringify(detail));
    }
}
// Fetch all transactions via transactionsSync (cursor-based, works without webhook init)
async function getTransactions(accessToken) {
    try {
        let cursor = undefined;
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
        console.log(`transactionsSync: ${added.length} transactions across ${pages} page(s)`);
        return added;
    }
    catch (error) {
        const detail = error?.response?.data || error?.message || error;
        console.error("getTransactions error:", JSON.stringify(detail));
        // Re-throw with the full Plaid error message
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