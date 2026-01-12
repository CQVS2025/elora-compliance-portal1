import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper function to get user's company_id from their profile
export async function getUserCompanyId() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  return profile?.company_id;
}

// Helper function to call Supabase Edge Functions
export async function callEdgeFunction(functionName, body = {}) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Edge function ${functionName} error:`, error);
    throw error;
  }
}
