import { corsHeadersForRequest, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

interface CreateCompanyRequest {
  // Company details
  company_name: string;
  email_domain: string;
  elora_customer_ref?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;

  // Branding
  login_tagline?: string;

  // Admin user details
  admin_email: string;
  admin_password: string;
  admin_full_name?: string;
  admin_phone?: string;
  admin_job_title?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = corsHeadersForRequest(req);

  try {
    const adminSupabase = createSupabaseAdminClient();

    // Parse request body
    const body: CreateCompanyRequest = await req.json();

    const {
      company_name,
      email_domain,
      elora_customer_ref,
      logo_url,
      primary_color = '#1e3a5f',
      secondary_color = '#3b82f6',
      login_tagline = `Welcome to ${company_name}`,
      admin_email,
      admin_password,
      admin_full_name = 'Admin User',
      admin_phone = '',
      admin_job_title = 'Administrator',
    } = body;

    // Validation
    if (!company_name || !email_domain || !admin_email || !admin_password) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: company_name, email_domain, admin_email, admin_password'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (admin_password.length < 6) {
      return new Response(JSON.stringify({
        error: 'Password must be at least 6 characters'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Check if company already exists
    const { data: existingCompany } = await adminSupabase
      .from('companies')
      .select('id')
      .eq('email_domain', email_domain)
      .single();

    if (existingCompany) {
      return new Response(JSON.stringify({
        error: `Company with email domain "${email_domain}" already exists`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409
      });
    }

    // Check if user already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === admin_email);

    if (existingUser) {
      return new Response(JSON.stringify({
        error: `User with email "${admin_email}" already exists`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409
      });
    }

    // ========================================
    // STEP 1: Create Company
    // ========================================
    let baseSlug = company_name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!baseSlug) {
      baseSlug = `company-${crypto.randomUUID().slice(0, 8)}`;
    }
    let slug = baseSlug;
    let suffix = 0;
    while (true) {
      const { data: existing } = await adminSupabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (!existing) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const { data: company, error: companyError } = await adminSupabase
      .from('companies')
      .insert({
        name: company_name,
        slug,
        email_domain,
        elora_customer_ref: elora_customer_ref || null,
        logo_url: logo_url || null,
        primary_color,
        secondary_color,
        is_active: true,
      })
      .select()
      .single();

    if (companyError) {
      console.error('Company creation error:', companyError);
      throw new Error(`Failed to create company: ${companyError.message}`);
    }

    const companyId = company.id;

    // ========================================
    // STEP 2: Create Client Branding
    // ========================================
    const { error: brandingError } = await adminSupabase
      .from('client_branding')
      .insert({
        company_id: companyId,
        client_email_domain: email_domain,
        company_name: company_name,
        logo_url: logo_url || null,
        primary_color,
        secondary_color,
        login_tagline,
        login_logo_position: 'center',
        login_background_color: '#f0f4f8',
        app_name: `${company_name} Fleet Portal`,
        email_accent_color: primary_color,
        email_from_name: `${company_name} Fleet Portal`,
        pdf_accent_color: primary_color,
        pdf_logo_url: logo_url || null,
      });

    if (brandingError) {
      console.error('Branding creation error:', brandingError);
      // Don't fail - branding is nice to have
    }

    // ========================================
    // STEP 3: Create User Permissions
    // ========================================
    // Domain-level permissions (ignore errors e.g. duplicate)
    const { error: domainPermError } = await adminSupabase.from('user_permissions').insert({
      company_id: companyId,
      scope: 'domain',
      email_domain: email_domain,
      show_all_data: true,
      can_view_compliance: true,
      can_view_reports: true,
      can_manage_sites: true,
      can_manage_users: false,
      can_export_data: true,
      can_view_costs: true,
      can_generate_ai_reports: true,
      can_edit_vehicles: true,
      can_edit_sites: true,
      is_active: true,
    });
    if (domainPermError) console.error('Domain permissions insert (non-fatal):', domainPermError.message);

    // User-specific admin permissions (ignore errors e.g. duplicate)
    const { error: userPermError } = await adminSupabase.from('user_permissions').insert({
      company_id: companyId,
      scope: 'user',
      user_email: admin_email,
      show_all_data: true,
      can_view_compliance: true,
      can_view_reports: true,
      can_manage_sites: true,
      can_manage_users: true,
      can_export_data: true,
      can_view_costs: true,
      can_generate_ai_reports: true,
      can_edit_vehicles: true,
      can_edit_sites: true,
      can_delete_records: true,
      is_active: true,
    });
    if (userPermError) console.error('User permissions insert (non-fatal):', userPermError.message);

    // ========================================
    // STEP 4: Create Auth User
    // ========================================
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
        company: company_name,
      }
    });

    if (authError) {
      // Rollback company creation
      await adminSupabase.from('companies').delete().eq('id', companyId);
      console.error('Auth creation error:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    // ========================================
    // STEP 5: Create User Profile
    // ========================================
    const { error: profileError } = await adminSupabase
      .from('user_profiles')
      .insert({
        id: authData.user!.id,
        company_id: companyId,
        email: admin_email,
        full_name: admin_full_name,
        phone: admin_phone,
        job_title: admin_job_title,
        role: 'admin',
        company_name: company_name,
        is_active: true,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail completely - auth user was created
    }

    // ========================================
    // STEP 6: Create Default Email Templates
    // ========================================
    try {
      await adminSupabase.rpc('create_default_email_templates', {
        p_company_id: companyId
      });
    } catch (e) {
      // Function might not exist, ignore
    }

    // ========================================
    // SUCCESS RESPONSE
    // ========================================
    return new Response(JSON.stringify({
      success: true,
      message: `Company "${company_name}" created successfully with admin user!`,
      company: {
        id: companyId,
        name: company_name,
        email_domain,
        slug,
      },
      user: {
        id: authData.user!.id,
        email: admin_email,
        full_name: admin_full_name,
        role: 'admin',
      },
      branding: {
        primary_color,
        secondary_color,
        login_tagline,
      },
      login_credentials: {
        email: admin_email,
        password: '(as provided)',
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Failed to create company with user'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
