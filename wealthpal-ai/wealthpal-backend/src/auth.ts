import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Anon client for auth flows that send emails (signUp, OTP)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL || "https://nlizziqpifjnzzlsytwk.supabase.co",
  process.env.SUPABASE_ANON_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function signupUser(email: string, password: string, fullName?: string) {
  try {
    // Use anon client so Supabase sends the real confirmation email
    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: fullName ? { full_name: fullName } : {} },
    });
    if (error) throw error;
    const needsVerification = !data.session;
    return { user: data.user, session: data.session, needsVerification, error: null };
  } catch (error) {
    return { user: null, session: null, needsVerification: false, error };
  }
}

export async function resendVerification(email: string) {
  try {
    const { error } = await supabaseAnon.auth.resend({ type: 'signup', email });
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function loginUser(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { session: data.session, error: null };
  } catch (error) {
    return { session: null, error: error };
  }
}

export async function createUserProfile(userId: string, email: string, firstName?: string, lastName?: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .insert([{ id: userId, email, "First Name": firstName || null, "Last Name": lastName || null }])
      .select();

    if (error) throw error;
    return { profile: data[0], error: null };
  } catch (error) {
    return { profile: null, error: error };
  }
}

export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select('"First Name", "Last Name", email')
      .eq("id", userId)
      .single();
    if (error) throw error;
    return { profile: data, error: null };
  } catch (error) {
    return { profile: null, error: error };
  }
}
