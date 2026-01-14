import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

interface CreateUserRequest {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  job_title?: string;
  role?: string;
  company_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const adminSupabase = createSupabaseAdminClient();

    // Parse request body
    const body: CreateUserRequest = await req.json();

    const {
      email,
      password,
      full_name = '',
      phone = '',
      job_title = '',
      role = 'user',
      company_id,
    } = body;

    // Validation
    if (!email || !password) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: email, password'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({
        error: 'Password must be at least 6 characters'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Check if user already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      return new Response(JSON.stringify({
        error: `User with email "${email}" already exists`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409
      });
    }

    // Get company name if company_id provided
    let companyName = '';
    if (company_id) {
      const { data: company } = await adminSupabase
        .from('companies')
        .select('name')
        .eq('id', company_id)
        .single();
      companyName = company?.name || '';
    }

    // Create Auth User
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        company: companyName,
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    // Create User Profile
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .insert({
        id: authData.user!.id,
        company_id: company_id || null,
        email,
        full_name,
        phone,
        job_title,
        role,
        company_name: companyName,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail completely - auth user was created
    }

    // SUCCESS RESPONSE
    return new Response(JSON.stringify({
      success: true,
      message: `User "${email}" created successfully!`,
      user: {
        id: authData.user!.id,
        email,
        full_name,
        role,
        company_id,
      },
      profile,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Failed to create user'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
