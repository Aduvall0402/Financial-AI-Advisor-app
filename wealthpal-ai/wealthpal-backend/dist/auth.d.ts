export declare function signupUser(email: string, password: string, fullName?: string): Promise<{
    user: import("@supabase/supabase-js").AuthUser | null;
    session: import("@supabase/supabase-js").AuthSession | null;
    needsVerification: boolean;
    error: null;
} | {
    user: null;
    session: null;
    needsVerification: boolean;
    error: unknown;
}>;
export declare function resendVerification(email: string): Promise<{
    error: unknown;
}>;
export declare function loginUser(email: string, password: string): Promise<{
    session: import("@supabase/supabase-js").AuthSession;
    error: null;
} | {
    session: null;
    error: unknown;
}>;
export declare function createUserProfile(userId: string, email: string, firstName?: string, lastName?: string): Promise<{
    profile: any;
    error: null;
} | {
    profile: null;
    error: unknown;
}>;
export declare function getUserProfile(userId: string): Promise<{
    profile: {
        "First Name": any;
        "Last Name": any;
        email: any;
    };
    error: null;
} | {
    profile: null;
    error: unknown;
}>;
//# sourceMappingURL=auth.d.ts.map