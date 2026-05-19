import { supabase } from "./supabase";

export async function signupUser(email: string, password: string, fullName?: string) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    });

    if (error) throw error;
    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error };
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

export async function createUserProfile(userId: string, email: string, fullName?: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .insert([{ id: userId, email, full_name: fullName || null }])
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
      .select("full_name, email")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return { profile: data, error: null };
  } catch (error) {
    return { profile: null, error: error };
  }
}
