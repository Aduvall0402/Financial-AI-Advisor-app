"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupUser = signupUser;
exports.loginUser = loginUser;
exports.createUserProfile = createUserProfile;
const supabase_1 = require("./supabase");
async function signupUser(email, password) {
    try {
        const { data, error } = await supabase_1.supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (error)
            throw error;
        return { user: data.user, error: null };
    }
    catch (error) {
        return { user: null, error: error };
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
async function createUserProfile(userId, email) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("users")
            .insert([{ id: userId, email }])
            .select();
        if (error)
            throw error;
        return { profile: data[0], error: null };
    }
    catch (error) {
        return { profile: null, error: error };
    }
}
//# sourceMappingURL=auth.js.map