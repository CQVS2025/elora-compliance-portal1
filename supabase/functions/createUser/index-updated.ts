import { createClient } from "npm:@supabase/supabase-js@2.28.0";

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': [
          'authorization',
          'x-client-info',
          'apikey',
          'content-type',
          'x-supabase-auth',
          'x-supabase-authorization',
        ].join(', '),
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': [
          'authorization',
          'x-client-info',
          'apikey',
          'content-type',
          'x-supabase-auth',
          'x-supabase-authorization',
        ].join(', '),
      } 
    });
  }

  try {
    const body = await req.json();
    const { email, password, full_name, phone, job_title, role, company_id } = body;

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
    };

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

    // Create admin client with service role key (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
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
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', finalCompanyId)
        .single();
      companyName = company?.name || '';
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name,
        company: companyName,
      }
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: full_name || '',
        phone: phone || '',
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
      // Auth user was created, but profile failed
      // Return partial success with warning
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
    };
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to create user',
      details: 'An unexpected error occurred'
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});

