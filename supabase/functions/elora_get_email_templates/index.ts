import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Get Email Templates Function
 * Retrieves email templates for a company
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();
    const { company_id, template_type } = body;

    if (!company_id) {
      return new Response(JSON.stringify({
        error: 'Company ID is required',
        data: []
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('company_id', company_id)
      .eq('is_active', true);

    if (template_type) {
      query = query.eq('template_type', template_type);
    }

    const { data: templates, error } = await query.order('template_type');

    if (error) throw error;

    // If requesting a specific template and none found, return default template
    if (template_type && (!templates || templates.length === 0)) {
      const defaultTemplates: Record<string, any> = {
        welcome: {
          template_type: 'welcome',
          template_name: 'Welcome Email',
          subject_template: 'Welcome to {{company_name}} Fleet Portal',
          body_html_template: '<h1>Welcome, {{user_name}}!</h1><p>Your account has been created for the {{company_name}} Fleet Compliance Portal.</p><p>Login at: {{login_url}}</p>',
          available_variables: {
            user_name: 'User full name',
            company_name: 'Company name',
            login_url: 'Portal login URL'
          }
        },
        compliance_alert: {
          template_type: 'compliance_alert',
          template_name: 'Compliance Alert',
          subject_template: 'Compliance Alert: {{vehicle_name}} - {{alert_type}}',
          body_html_template: '<h2>Compliance Alert</h2><p>Vehicle <strong>{{vehicle_name}}</strong> has a compliance issue:</p><p>{{alert_message}}</p><p>Current compliance: {{compliance_rate}}%</p>',
          available_variables: {
            vehicle_name: 'Vehicle name',
            alert_type: 'Type of alert',
            alert_message: 'Alert details',
            compliance_rate: 'Current compliance percentage'
          }
        },
        compliance_digest_daily: {
          template_type: 'compliance_digest_daily',
          template_name: 'Daily Compliance Digest',
          subject_template: '{{company_name}} Daily Fleet Report - {{date}}',
          body_html_template: '<h1>Daily Fleet Compliance Report</h1><p>Date: {{date}}</p><h2>Summary</h2><ul><li>Total Vehicles: {{total_vehicles}}</li><li>Compliant: {{compliant_count}}</li><li>Non-Compliant: {{non_compliant_count}}</li><li>Compliance Rate: {{compliance_rate}}%</li></ul>{{vehicle_details}}',
          available_variables: {
            company_name: 'Company name',
            date: 'Report date',
            total_vehicles: 'Total vehicle count',
            compliant_count: 'Compliant vehicles',
            non_compliant_count: 'Non-compliant vehicles',
            compliance_rate: 'Overall rate',
            vehicle_details: 'Detailed vehicle list HTML'
          }
        },
        compliance_digest_weekly: {
          template_type: 'compliance_digest_weekly',
          template_name: 'Weekly Compliance Digest',
          subject_template: '{{company_name}} Weekly Fleet Report - Week of {{week_start}}',
          body_html_template: '<h1>Weekly Fleet Compliance Report</h1><p>Week: {{week_start}} - {{week_end}}</p><h2>Summary</h2><ul><li>Total Vehicles: {{total_vehicles}}</li><li>Average Compliance: {{compliance_rate}}%</li><li>Total Washes: {{total_washes}}</li></ul>{{charts_html}}{{vehicle_details}}',
          available_variables: {
            company_name: 'Company name',
            week_start: 'Week start date',
            week_end: 'Week end date',
            total_vehicles: 'Vehicle count',
            compliance_rate: 'Average rate',
            total_washes: 'Wash count',
            charts_html: 'Charts HTML',
            vehicle_details: 'Details HTML'
          }
        },
        compliance_digest_monthly: {
          template_type: 'compliance_digest_monthly',
          template_name: 'Monthly Compliance Digest',
          subject_template: '{{company_name}} Monthly Fleet Report - {{month}} {{year}}',
          body_html_template: '<h1>Monthly Fleet Compliance Report</h1><p>{{month}} {{year}}</p><h2>Summary</h2><ul><li>Total Vehicles: {{total_vehicles}}</li><li>Average Compliance: {{compliance_rate}}%</li><li>Total Washes: {{total_washes}}</li></ul>{{charts_html}}{{vehicle_details}}',
          available_variables: {
            company_name: 'Company name',
            month: 'Month name',
            year: 'Year',
            total_vehicles: 'Vehicle count',
            compliance_rate: 'Average rate',
            total_washes: 'Wash count',
            charts_html: 'Charts HTML',
            vehicle_details: 'Details HTML'
          }
        },
        report_ready: {
          template_type: 'report_ready',
          template_name: 'Report Ready',
          subject_template: 'Your {{report_type}} Report is Ready',
          body_html_template: '<h2>Your Report is Ready</h2><p>Your {{report_type}} report has been generated and is ready for download.</p><p><a href="{{download_url}}">Download Report</a></p>',
          available_variables: {
            report_type: 'Type of report',
            download_url: 'Report download URL'
          }
        }
      };

      const defaultTemplate = defaultTemplates[template_type];
      if (defaultTemplate) {
        return new Response(JSON.stringify({
          success: true,
          data: [{
            ...defaultTemplate,
            id: null,
            company_id,
            is_default: true
          }]
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: templates || []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      data: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
