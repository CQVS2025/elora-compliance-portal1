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

    console.log(`Edge function ${functionName} response:`, { data, error });

    // First, check if data contains an error (even if no error object was returned)
    if (data && data.error) {
      console.error(`Edge function ${functionName} returned error in data:`, data.error);
      throw new Error(data.error);
    }

    // If Supabase client returns an error, try to extract error message from response
    if (error) {
      console.error(`Edge function ${functionName} received error object:`, error);
      console.error(`Error context:`, error.context);
      
      // When Supabase functions.invoke gets a non-2xx status (like 409), 
      // the response body is in error.context (it's a Response object)
      let errorResponse = null;
      let errorMessage = null;
      
      // Check if error.context is a Response object (fetch API Response)
      if (error.context && error.context instanceof Response) {
        console.log('Error context is a Response object, reading body...');
        try {
          // Read the response body
          const responseText = await error.context.text();
          console.log('Response body text:', responseText);
          
          // Try to parse as JSON
          try {
            errorResponse = JSON.parse(responseText);
            console.log('Parsed JSON error response:', errorResponse);
          } catch (jsonError) {
            // If not JSON, use as string
            errorResponse = { error: responseText };
          }
        } catch (readError) {
          console.error('Failed to read response body:', readError);
        }
      }
      
      // Try other locations if we haven't found the error yet
      // 1. Check error.context.body
      if (!errorResponse && error.context?.body) {
        console.log('Found error in context.body:', error.context.body);
        try {
          // Check if body is a ReadableStream
          if (error.context.body instanceof ReadableStream) {
            const reader = error.context.body.getReader();
            const chunks = [];
            let done = false;
            
            while (!done) {
              const { value, done: streamDone } = await reader.read();
              if (value) chunks.push(value);
              done = streamDone;
            }
            
            const bodyText = new TextDecoder().decode(new Uint8Array(chunks.flat()));
            console.log('Read from stream:', bodyText);
            
            try {
              errorResponse = JSON.parse(bodyText);
            } catch {
              errorResponse = { error: bodyText };
            }
          } else if (typeof error.context.body === 'string') {
            errorResponse = JSON.parse(error.context.body);
          } else {
            errorResponse = error.context.body;
          }
        } catch (parseError) {
          console.error('Failed to parse context.body:', parseError);
          errorResponse = { error: error.context.body };
        }
      }
      
      // 2. Check error.context.response
      if (!errorResponse && error.context?.response) {
        console.log('Found error in context.response:', error.context.response);
        try {
          errorResponse = typeof error.context.response === 'string'
            ? JSON.parse(error.context.response)
            : error.context.response;
        } catch (parseError) {
          errorResponse = { error: error.context.response };
        }
      }
      
      // 3. Check error.context.data
      if (!errorResponse && error.context?.data) {
        console.log('Found error in context.data:', error.context.data);
        errorResponse = error.context.data;
      }
      
      // Extract error message from the response
      if (errorResponse) {
        console.log('Parsed error response:', errorResponse);
        if (typeof errorResponse === 'string') {
          errorMessage = errorResponse;
        } else if (errorResponse.error) {
          errorMessage = errorResponse.error;
        } else if (errorResponse.message) {
          errorMessage = errorResponse.message;
        }
      }
      
      // If we found an error message, throw it
      if (errorMessage) {
        console.log('Throwing error message:', errorMessage);
        throw new Error(errorMessage);
      }
      
      // If error has a message, use it
      if (error.message) {
        console.log('Using error.message:', error.message);
        throw new Error(error.message);
      }
      
      // Last resort: log the full error for debugging
      console.error(`Edge function ${functionName} invoke error (full):`, JSON.stringify(error, null, 2));
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`Edge function ${functionName} caught error:`, error);
    
    // If it's already an Error object with a message, throw it as-is
    if (error instanceof Error && error.message) {
      throw error;
    }
    
    // Otherwise, wrap it in an Error
    throw new Error(error?.message || `Failed to send a request to the Edge Function: ${functionName}`);
  }
}
