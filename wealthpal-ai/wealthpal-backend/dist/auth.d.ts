export declare function signupUser(email: string, password: string): Promise<{
    user: import("@supabase/auth-js").User;
    error: null;
} | {
    user: null;
    error: unknown;
}>;
export declare function loginUser(email: string, password: string): Promise<{
    session: import("@supabase/auth-js").Session;
    error: null;
} | {
    session: null;
    error: unknown;
}>;
export declare function createUserProfile(userId: string, email: string): Promise<{
    profile: any;
    error: null;
} | {
    profile: null;
    error: unknown;
}>;
//# sourceMappingURL=auth.d.ts.map