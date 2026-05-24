import { PlaidApi } from "plaid";
export declare const plaidClient: PlaidApi;
export declare function createLinkToken(userId: string): Promise<string>;
export declare function exchangePublicToken(publicToken: string): Promise<{
    accessToken: string;
    itemId: string;
}>;
export declare function refreshTransactions(accessToken: string): Promise<void>;
export declare function getTransactions(accessToken: string): Promise<any[]>;
export declare function getAccounts(accessToken: string): Promise<import("plaid").AccountBase[]>;
//# sourceMappingURL=plaidService.d.ts.map