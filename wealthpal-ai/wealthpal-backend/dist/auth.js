"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupUser = signupUser;
exports.resendVerification = resendVerification;
exports.loginUser = loginUser;
exports.createUserProfile = createUserProfile;
exports.getUserProfile = getUserProfile;
const supabase_js_1 = require("@supabase/supabase-js");
const supabase_1 = require("./supabase");
// Anon client for auth flows that send emails (signUp, OTP)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://nlizziqpifjnzzlsytwk.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabaseAnon = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});
async function signupUser(email, password, fullName) {
    try {
        // Use anon client so Supabase sends the real confirmation email
        const { data, error } = await supabaseAnon.auth.signUp({
            email,
            password,
            options: { data: fullName ? { full_name: fullName } : {} },
        });
        if (error)
            throw error;
        const needsVerification = !data.session;
        return { user: data.user, session: data.session, needsVerification, error: null };
    }
    catch (error) {
        return { user: null, session: null, needsVerification: false, error };
    }
}
async function resendVerification(email) {
    try {
        const { error } = await supabaseAnon.auth.resend({ type: 'signup', email });
        if (error)
            throw error;
        return { error: null };
    }
    catch (error) {
        return { error };
    }
}
async function loginUser(email, password) {
    try {
        const { data, error } = await supabase_1.supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error)
            throw error;
        return { session: data.session, error: null };
    }
    catch (error) {
        return { session: null, error: error };
    }
}
async function createUserProfile(userId, email, firstName, lastName) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("users")
            .insert([{ id: userId, email, "First Name": firstName || null, "Last Name": lastName || null }])
            .select();
        if (error)
            throw error;
        return { profile: data[0], error: null };
    }
    catch (error) {
        return { profile: null, error: error };
    }
}
async function getUserProfile(userId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("users")
            .select('"First Name", "Last Name", email')
            .eq("id", userId)
            .single();
        if (error)
            throw error;
        return { profile: data, error: null };
    }
    catch (error) {
        return { profile: null, error: error };
    }
}
//# sourceMappingURL=auth.js.map