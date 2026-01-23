import { createClient } from "npm:@supabase/supabase-js@2.28.0";

Deno.serve(async (req: Request) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'x-supabase-auth',
      'x-supabase-authorization',
    ].join(', '),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight FIRST - before any other logic
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header format' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Create admin client with service role key (can verify any JWT)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify the JWT token using service role
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired token',
        details: authError?.message 
      }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Get user profile to check permissions
    const { data: userProfile, error: userProfileError } = await adminSupabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (userProfileError || !userProfile) {
      return new Response(JSON.stringify({ 
        error: 'User profile not found',
        details: userProfileError?.message 
      }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Check if user has admin or super_admin role
    if (userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
      return new Response(JSON.stringify({ 
        error: 'Insufficient permissions. Admin or Super Admin role required.' 
      }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Parse request body
    const body = await req.json();
    const { email, password, full_name, job_title, role, company_id } = body;

    // Validation
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Missing email or password' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Determine final company_id based on user role
    let finalCompanyId = company_id;
    if (userProfile.role === 'admin') {
      // Admin can only create users for their own company
      if (!finalCompanyId) {
        finalCompanyId = userProfile.company_id;
      } else if (finalCompanyId !== userProfile.company_id) {
        return new Response(JSON.stringify({ 
          error: 'Admins can only create users for their own company' 
        }), { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
    } else if (userProfile.role === 'super_admin') {
      // Super admin can create users for any company or no company
      finalCompanyId = company_id || null;
    }

    // Check if user already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      return new Response(JSON.stringify({ 
        error: `User with email "${email}" already exists` 
      }), { 
        status: 409, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Get company name if company_id provided
    let companyName = '';
    if (finalCompanyId) {
      const { data: company } = await adminSupabase
        .from('companies')
        .select('name')
        .eq('id', finalCompanyId)
        .single();
      companyName = company?.name || '';
    }

    // Create auth user
    const { data: authData, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name,
        company: companyName,
      }
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Create user profile
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: full_name || '',
        job_title: job_title || '',
        role: role || 'user',
        company_id: finalCompanyId || null,
        company_name: companyName,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return new Response(JSON.stringify({ 
        success: true,
        warning: 'User created but profile creation failed',
        user: authData.user,
        error: profileError.message
      }), { 
        status: 201, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `User "${email}" created successfully!`,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name,
        role: role || 'user',
        company_id: finalCompanyId,
      },
      profile,
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to create user',
      details: 'An unexpected error occurred'
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});

