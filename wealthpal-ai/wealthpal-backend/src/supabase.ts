import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nlizziqpifjnzzlsytwk.supabase.co";
const supabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5saXp6aXFwaWZqbnp6bHN5dHdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgzMjk3MywiZXhwIjoyMDk0NDA4OTczfQ.mUTsWAG0EeGi2bZxwLhuEDrGNZ1TLPfGQ_JCi22vf6I";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase credentials");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;