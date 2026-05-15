import { supabase } from "./supabase";

export async function signupUser(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
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

export async function createUserProfile(userId: string, email: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .insert([{ id: userId, email }])
      .select();

    if (error) throw error;
    return { profile: data[0], error: null };
  } catch (error) {
    return { profile: null, error: error };
  }
}
