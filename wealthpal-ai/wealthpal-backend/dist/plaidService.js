"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plaidClient = void 0;
exports.createLinkToken = createLinkToken;
exports.exchangePublicToken = exchangePublicToken;
exports.getTransactions = getTransactions;
exports.getAccounts = getAccounts;
const plaid_1 = require("plaid");
const configuration = new plaid_1.Configuration({
    basePath: process.env.PLAID_ENV === "production"
        ? plaid_1.PlaidEnvironments.Production
        : plaid_1.PlaidEnvironments.Sandbox,
    baseOptions: {
        headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
        },
    },
});
exports.plaidClient = new plaid_1.PlaidApi(configuration);
// Create Link Token for Plaid Link UI
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
// Exchange public token for access token
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
// Get transactions from account
async function getTransactions(accessToken, startDate, endDate) {
    try {
        const response = await exports.plaidClient.transactionsGet({
            access_token: accessToken,
            start_date: startDate,
            end_date: endDate,
        });
        return response.data.transactions;
    }
    catch (error) {
        console.error("Error fetching transactions:", error);
        throw error;
    }
}
// Get accounts from item
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