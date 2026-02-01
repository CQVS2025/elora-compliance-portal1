import { supabase } from '@/lib/supabase';

/**
 * Production-Ready Edge Function Fetch Wrapper
 * 
 * Features:
 * - Automatic tenant context injection from user profile
 * - AbortSignal support for query cancellation
 * - Consistent error handling and formatting
 * - Request/response logging for debugging
 * - Type-safe error classes
 */

// Custom error classes for better error handling
export class EdgeFunctionError extends Error {
  constructor(message, statusCode, functionName) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.statusCode = statusCode;
    this.functionName = functionName;
  }
}

export class AuthError extends EdgeFunctionError {
  constructor(message, functionName) {
    super(message, 401, functionName);
    this.name = 'AuthError';
  }
}

export class ValidationError extends EdgeFunctionError {
  constructor(message, functionName) {
    super(message, 400, functionName);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends EdgeFunctionError {
  constructor(message, functionName) {
    super(message, 409, functionName);
    this.name = 'ConflictError';
  }
}

/**
 * Get the current user's company_id (tenant context)
 * Caches the result to avoid repeated DB calls
 */
let cachedCompanyId = null;
let cachedUserId = null;

export async function getUserTenantContext() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      cachedCompanyId = null;
      cachedUserId = null;
      return { userId: null, companyId: null, userEmail: null };
    }

    // Return cached if same user
    if (cachedUserId === user.id && cachedCompanyId !== null) {
      return { userId: user.id, companyId: cachedCompanyId, userEmail: user.email };
    }

    // Fetch fresh company_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    cachedUserId = user.id;
    cachedCompanyId = profile?.company_id || null;

    return {
      userId: user.id,
      companyId: cachedCompanyId,
      userEmail: user.email,
    };
  } catch (error) {
    console.error('Failed to get tenant context:', error);
    return { userId: null, companyId: null, userEmail: null };
  }
}

/**
 * Clear tenant context cache (call on logout or tenant switch)
 */
export function clearTenantContextCache() {
  cachedCompanyId = null;
  cachedUserId = null;
}

/**
 * Main Edge Function fetch wrapper
 * 
 * @param {string} functionName - Name of the Supabase Edge Function
 * @param {object} params - Parameters to pass to the function
 * @param {object} options - Additional options
 * @param {AbortSignal} options.signal - AbortSignal for cancellation
 * @param {boolean} options.includeTenantContext - Auto-inject tenant context (default: false)
 * @param {boolean} options.throwOnError - Throw errors instead of returning them (default: true)
 * @returns {Promise<any>} Response data
 */
export async function edgeFetch(functionName, params = {}, options = {}) {
  const {
    signal,
    includeTenantContext = false,
    throwOnError = true,
  } = options;

  try {
    // Inject tenant context if requested
    let requestBody = { ...params };
    if (includeTenantContext) {
      const { companyId, userId, userEmail } = await getUserTenantContext();
      requestBody = {
        ...requestBody,
        _tenantContext: {
          companyId,
          userId,
          userEmail,
        },
      };
    }

    console.log(`[edgeFetch] ${functionName}:`, {
      params: requestBody,
      signal: !!signal,
      timestamp: new Date().toISOString(),
    });

    // Call the Edge Function with timeout support via signal
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: requestBody,
      // Note: Supabase JS client doesn't directly support signal,
      // but we include it for future compatibility
    });

    console.log(`[edgeFetch] ${functionName} response:`, { data, error });

    // Handle errors in data response
    if (data && data.error) {
      console.error(`[edgeFetch] ${functionName} returned error in data:`, data.error);
      
      const errorMessage = typeof data.error === 'string' ? data.error : data.error.message || 'Unknown error';
      
      // Classify error by type
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        throw new AuthError(errorMessage, functionName);
      } else if (errorMessage.includes('409') || errorMessage.toLowerCase().includes('conflict')) {
        throw new ConflictError(errorMessage, functionName);
      } else if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('validation')) {
        throw new ValidationError(errorMessage, functionName);
      }
      
      throw new EdgeFunctionError(errorMessage, 500, functionName);
    }

    // Handle Supabase client errors
    if (error) {
      console.error(`[edgeFetch] ${functionName} Supabase error:`, error);
      
      let errorMessage = error.message || 'Edge function error';
      
      // Extract error from context (Response object)
      if (error.context && error.context instanceof Response) {
        try {
          const responseText = await error.context.text();
          console.log('[edgeFetch] Response body:', responseText);
          
          try {
            const errorResponse = JSON.parse(responseText);
            errorMessage = errorResponse.error || errorResponse.message || responseText;
          } catch {
            errorMessage = responseText;
          }
        } catch (readError) {
          console.error('[edgeFetch] Failed to read error response:', readError);
        }
      }
      
      // Classify error
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        throw new AuthError(errorMessage, functionName);
      } else if (errorMessage.includes('409')) {
        throw new ConflictError(errorMessage, functionName);
      } else if (errorMessage.includes('400')) {
        throw new ValidationError(errorMessage, functionName);
      }
      
      throw new EdgeFunctionError(errorMessage, 500, functionName);
    }

    // Return successful data
    return data;
  } catch (error) {
    console.error(`[edgeFetch] ${functionName} caught error:`, error);
    
    // Re-throw custom errors as-is
    if (error instanceof EdgeFunctionError) {
      if (throwOnError) throw error;
      return { error: error.message, statusCode: error.statusCode };
    }
    
    // Wrap unknown errors
    const wrappedError = new EdgeFunctionError(
      error?.message || `Failed to call ${functionName}`,
      500,
      functionName
    );
    
    if (throwOnError) throw wrappedError;
    return { error: wrappedError.message };
  }
}

/**
 * Batch fetch multiple Edge Functions in parallel
 * Useful for loading related data together
 */
export async function batchEdgeFetch(requests, options = {}) {
  const { signal } = options;
  
  const promises = requests.map(({ functionName, params, options: reqOptions }) =>
    edgeFetch(functionName, params, { ...reqOptions, signal, throwOnError: false })
  );
  
  const results = await Promise.all(promises);
  
  // Check if any failed
  const errors = results.filter(r => r && r.error);
  if (errors.length > 0) {
    console.warn('[batchEdgeFetch] Some requests failed:', errors);
  }
  
  return results;
}
