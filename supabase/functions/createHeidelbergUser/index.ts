import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

// Heidelberg Materials email domain - used to find company dynamically
const HEIDELBERG_EMAIL_DOMAIN = 'heidelberg.com.au';

interface CreateUserRequest {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  job_title?: string;
  role?: 'super_admin' | 'admin' | 'manager' | 'user' | 'site_manager' | 'driver';
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
      full_name = 'Jonny Harper',
      phone = '+61 400 000 000',
      job_title = 'Fleet Manager',
      role = 'admin'
    } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({
        error: 'Email and password are required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get Heidelberg Materials company ID from database
    const { data: company, error: companyError } = await adminSupabase
      .from('companies')
      .select('id, name')
      .eq('email_domain', HEIDELBERG_EMAIL_DOMAIN)
      .single();

    if (companyError || !company) {
      console.error('Company lookup error:', companyError);
      return new Response(JSON.stringify({
        error: 'Heidelberg Materials company not found. Please run the database migration first.',
        details: companyError?.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const HEIDELBERG_COMPANY_ID = company.id;

    // Check if user already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // User exists, update their profile if needed
      const { data: existingProfile } = await adminSupabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (!existingProfile) {
        // Create profile for existing auth user
        const { error: profileError } = await adminSupabase
          .from('user_profiles')
          .insert({
            id: existingUser.id,
            company_id: HEIDELBERG_COMPANY_ID,
            email: email,
            full_name: full_name,
            phone: phone,
            job_title: job_title,
            role: role,
            company_name: 'Heidelberg Materials',
            is_active: true
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `User ${email} already exists. Profile updated.`,
        user_id: existingUser.id,
        company_id: HEIDELBERG_COMPANY_ID
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Create new auth user with password
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: full_name,
        company: 'Heidelberg Materials'
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('User creation failed - no user returned');
    }

    // Create user profile
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        company_id: HEIDELBERG_COMPANY_ID,
        email: email,
        full_name: full_name,
        phone: phone,
        job_title: job_title,
        role: role,
        company_name: 'Heidelberg Materials',
        is_active: true
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail completely - auth user was created
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Heidelberg Materials user created successfully!`,
      user: {
        id: authData.user.id,
        email: email,
        full_name: full_name,
        role: role,
        company: 'Heidelberg Materials',
        company_id: HEIDELBERG_COMPANY_ID
      },
      branding: {
        primary_color: '#003DA5',
        secondary_color: '#00A3E0',
        company_name: 'Heidelberg Materials',
        tagline: 'Building Tomorrow\'s Infrastructure Today'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Failed to create Heidelberg Materials user'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
