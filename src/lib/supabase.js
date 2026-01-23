import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Create a singleton Supabase client to avoid multiple instances during HMR
let supabaseInstance = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Use localStorage for session persistence across page refreshes
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'elora-auth-token',
      },
    });
  }
  return supabaseInstance;
}

// Export the singleton instance
export const supabase = getSupabaseClient();

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

    // If Supabase client returns an error, try to extract error message from response
    if (error) {
      console.error(`Edge function ${functionName} invoke error:`, error);
      
      // Supabase functions.invoke returns error with context when status is non-2xx
      // The response body is usually in error.context.response
      if (error.context?.response) {
        try {
          // Try to parse the response as JSON
          const errorResponse = typeof error.context.response === 'string'
            ? JSON.parse(error.context.response)
            : error.context.response;
          
          // Extract error message from the response
          if (errorResponse?.error) {
            throw new Error(errorResponse.error);
          } else if (errorResponse?.message) {
            throw new Error(errorResponse.message);
          }
        } catch (parseError) {
          // If parsing fails, continue with original error handling
        }
      }
      
      // If error has a message, use it
      if (error.message) {
        throw new Error(error.message);
      }
      
      throw error;
    }

    // Check if the edge function returned an error in the response body
    if (data && data.error) {
      console.error(`Edge function ${functionName} returned error:`, data.error);
      throw new Error(data.error);
    }

    return data;
  } catch (error) {
    console.error(`Edge function ${functionName} error:`, error);
    
    // If it's already an Error object with a message, throw it as-is
    if (error instanceof Error && error.message) {
      throw error;
    }
    
    // Otherwise, wrap it in an Error
    throw new Error(error?.message || `Failed to send a request to the Edge Function: ${functionName}`);
  }
}
