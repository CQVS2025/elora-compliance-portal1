import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { Resend } from 'npm:resend@4.0.0';

/**
 * Email Report Generation and Sending Function
 * Supports instant "Email Me Now" and scheduled report delivery
 */

// Initialize Resend with API key
const resend = new Resend('re_7KDKHjRM_KsRBUbTj2zgjSUHupenSbCBy');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse request body
    const body = await req.json();
    const { userEmail, reportTypes, includeCharts, includeAiInsights, previewOnly } = body;

    console.log('sendEmailReport invoked with:', {
      userEmail,
      reportTypes,
      includeCharts,
      includeAiInsights
    });

    if (!userEmail) {
      console.error('Missing userEmail parameter');
      return new Response(JSON.stringify({ error: 'User email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch user's branding based on email domain
    const emailDomain = userEmail.split('@')[1];
    let branding = null;

    try {
      const brandingResults = await base44.asServiceRole.entities.Client_Branding.filter({
        client_email_domain: emailDomain
      });

      if (brandingResults && brandingResults.length > 0) {
        branding = brandingResults[0];
      } else {
        // Default ELORA branding
        branding = {
          company_name: 'ELORA Solutions',
          logo_url: null,
          primary_color: '#7CB342',
          secondary_color: '#9CCC65'
        };
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
      // Use default branding
      branding = {
        company_name: 'ELORA Solutions',
        logo_url: null,
        primary_color: '#7CB342',
        secondary_color: '#9CCC65'
      };
    }

    // Fetch user details
    console.log('Fetching user details for:', userEmail);
    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      console.error('User not found:', userEmail);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('User found:', { id: user.id, email: user.email, role: user.role });

    // Generate report data
    const reports = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all necessary data
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-updated_date', 1000);
    const maintenanceRecords = await base44.asServiceRole.entities.Maintenance.list('-service_date', 1000);

    // Filter data based on user permissions
    let userVehicles = vehicles;
    if (user.role !== 'admin') {
      if (user.assigned_sites && user.assigned_sites.length > 0) {
        userVehicles = vehicles.filter(v => user.assigned_sites.includes(v.site_id));
      } else if (user.assigned_vehicles && user.assigned_vehicles.length > 0) {
        userVehicles = vehicles.filter(v => user.assigned_vehicles.includes(v.id));
      }
    }

    // Generate Compliance Report
    if (!reportTypes || reportTypes.length === 0 || reportTypes.includes('compliance')) {
      const complianceData = generateComplianceData(userVehicles, thirtyDaysAgo);
      reports.compliance = complianceData;
    }

    // Generate Maintenance Report
    if (!reportTypes || reportTypes.length === 0 || reportTypes.includes('maintenance')) {
      const maintenanceData = generateMaintenanceData(userVehicles, maintenanceRecords);
      reports.maintenance = maintenanceData;
    }

    // Generate Cost Analysis
    if (!reportTypes || reportTypes.length === 0 || reportTypes.includes('costs')) {
      const costData = generateCostData(maintenanceRecords, userVehicles, thirtyDaysAgo);
      reports.costs = costData;
    }

    // Generate AI Insights
    if (includeAiInsights && (!reportTypes || reportTypes.length === 0 || reportTypes.includes('ai_insights'))) {
      try {
        const aiInsights = await generateAIInsights(base44, reports, userVehicles);
        reports.aiInsights = aiInsights;
      } catch (error) {
        console.error('Error generating AI insights:', error);
        reports.aiInsights = 'AI insights are currently unavailable.';
      }
    }

    // Generate HTML email
    console.log('Generating email HTML with branding:', {
      company_name: branding.company_name,
      primary_color: branding.primary_color
    });
    const emailHTML = generateEmailHTML(reports, branding, userEmail);

    if (previewOnly) {
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        html: emailHTML
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send email using Resend
    console.log('Attempting to send email via Resend to:', userEmail);
    console.log('Resend config:', {
      from: 'Jonny <jonny@elora.com.au>',
      to: userEmail,
      hasHtmlContent: !!emailHTML,
      htmlLength: emailHTML.length
    });

    try {
      const emailResult = await resend.emails.send({
        from: 'Jonny <jonny@elora.com.au>',
        to: userEmail,
        subject: `${branding.company_name} - Fleet Compliance Report`,
        html: emailHTML
      });

      console.log('Resend API response:', JSON.stringify(emailResult, null, 2));

      // Check if the response indicates success
      if (emailResult && emailResult.id) {
        console.log('Email sent successfully! Resend ID:', emailResult.id);

        // Update last_sent timestamp if this is a scheduled send
        try {
          const prefs = await base44.asServiceRole.entities.EmailReportPreferences.filter({
            user_email: userEmail
          });

          if (prefs && prefs.length > 0) {
            await base44.asServiceRole.entities.EmailReportPreferences.update(prefs[0].id, {
              last_sent: now.toISOString()
            });
          }
        } catch (error) {
          console.error('Error updating last_sent:', error);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Email report sent successfully',
          recipient: userEmail,
          resendId: emailResult.id
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // No error thrown but no ID returned - unexpected response
        console.error('Unexpected Resend response - no email ID:', emailResult);
        return new Response(JSON.stringify({
          error: 'Email sending failed - unexpected response from email service',
          details: 'The email service did not confirm the email was sent. Please check your Resend dashboard.',
          response: emailResult
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } catch (emailError) {
      console.error('Resend API error:', emailError);
      console.error('Error details:', {
        message: emailError.message,
        stack: emailError.stack,
        name: emailError.name,
        cause: emailError.cause
      });

      // Parse Resend error for helpful messages
      let errorMessage = 'Failed to send email';
      let errorDetails = emailError.message;
      let statusCode = 500;

      // Check for common Resend errors
      if (emailError.message) {
        const msg = emailError.message.toLowerCase();

        if (msg.includes('domain') || msg.includes('verify') || msg.includes('dns')) {
          errorMessage = 'Email domain not verified';
          errorDetails = 'The domain elora.com.au needs to be verified in Resend. Please verify the domain and add DNS records in your Resend dashboard.';
          statusCode = 403;
        } else if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('authentication')) {
          errorMessage = 'Email service authentication failed';
          errorDetails = 'The Resend API key appears to be invalid or expired. Please check your Resend API key configuration.';
          statusCode = 401;
        } else if (msg.includes('rate limit') || msg.includes('quota')) {
          errorMessage = 'Email rate limit exceeded';
          errorDetails = 'You have exceeded your Resend email sending quota. Please check your Resend dashboard.';
          statusCode = 429;
        } else if (msg.includes('invalid email') || msg.includes('recipient')) {
          errorMessage = 'Invalid email address';
          errorDetails = `The recipient email address "${userEmail}" appears to be invalid.`;
          statusCode = 400;
        }
      }

      return new Response(JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        userEmail: userEmail,
        technicalDetails: emailError.message,
        hint: 'Check the Resend dashboard at https://resend.com/emails for more details'
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Function error:', error);
    console.error('Function error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to generate compliance data
function generateComplianceData(vehicles, startDate) {
  const compliantVehicles = vehicles.filter(v => (v.compliance_rate || 0) >= 80);
  const atRiskVehicles = vehicles.filter(v => (v.compliance_rate || 0) < 80);

  const totalCompliance = vehicles.reduce((sum, v) => sum + (v.compliance_rate || 0), 0);
  const averageCompliance = vehicles.length > 0 ? Math.round(totalCompliance / vehicles.length) : 0;

  const alerts = [];
  if (atRiskVehicles.length > 0) {
    alerts.push({
      title: 'Low Compliance Alert',
      message: `${atRiskVehicles.length} vehicle(s) are below the 80% compliance threshold and require attention.`,
      type: 'warning'
    });
  }

  return {
    summary: {
      averageCompliance,
      totalVehicles: vehicles.length,
      compliantVehicles: compliantVehicles.length,
      atRiskVehicles: atRiskVehicles.length,
      alerts
    },
    vehicles: vehicles.slice(0, 20).map(v => ({
      name: v.name || 'Unknown',
      site: v.site_name || 'N/A',
      complianceRate: v.compliance_rate || 0,
      washesCompleted: v.washes_completed || 0,
      targetWashes: v.target_washes || 0,
      status: (v.compliance_rate || 0) >= 80 ? 'Compliant' : 'At Risk'
    })),
    dateRange: `${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}`
  };
}

// Helper function to generate maintenance data
function generateMaintenanceData(vehicles, maintenanceRecords) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingMaintenance = [];
  let overdueCount = 0;

  for (const record of maintenanceRecords) {
    if (!record.next_service_date) continue;

    const nextDate = new Date(record.next_service_date);
    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      overdueCount++;
    }

    if (daysUntil <= 30) {
      const vehicle = vehicles.find(v => v.id === record.vehicle_id);
      upcomingMaintenance.push({
        vehicleName: vehicle?.name || 'Unknown',
        serviceType: record.service_type || 'Maintenance',
        dueDate: nextDate.toLocaleDateString(),
        daysUntil: Math.max(0, daysUntil),
        status: daysUntil < 0 ? 'Overdue' : daysUntil <= 7 ? 'Urgent' : 'Scheduled'
      });
    }
  }

  // Sort by days until due (ascending)
  upcomingMaintenance.sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    summary: {
      upcomingCount: upcomingMaintenance.length,
      overdueCount
    },
    upcomingMaintenance: upcomingMaintenance.slice(0, 15),
    dateRange: `${now.toLocaleDateString()} - ${thirtyDaysFromNow.toLocaleDateString()}`
  };
}

// Helper function to generate cost data
function generateCostData(maintenanceRecords, vehicles, startDate) {
  const recentRecords = maintenanceRecords.filter(r => {
    if (!r.service_date) return false;
    const serviceDate = new Date(r.service_date);
    return serviceDate >= startDate;
  });

  const totalCost = recentRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const monthlyAverage = Math.round(totalCost / (recentRecords.length > 0 ? 1 : 1));

  return {
    summary: {
      totalCost: Math.round(totalCost),
      monthlyAverage,
      recordCount: recentRecords.length
    },
    dateRange: `${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}`
  };
}

// Helper function to generate AI insights
async function generateAIInsights(base44, reports, vehicles) {
  const prompt = `Based on the following fleet data, provide 3-5 key insights and actionable recommendations:

Compliance: ${reports.compliance?.summary?.averageCompliance || 0}% average, ${reports.compliance?.summary?.atRiskVehicles || 0} vehicles at risk
Maintenance: ${reports.maintenance?.summary?.upcomingCount || 0} upcoming services, ${reports.maintenance?.summary?.overdueCount || 0} overdue
Costs: $${reports.costs?.summary?.totalCost || 0} total maintenance costs
Total Vehicles: ${vehicles.length}

Focus on practical, actionable insights for fleet management.`;

  try {
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500
    });

    return response.content?.[0]?.text || 'No insights available at this time.';
  } catch (error) {
    console.error('LLM invocation error:', error);
    return 'AI insights are temporarily unavailable. Please try again later.';
  }
}

// Generate complete HTML email
function generateEmailHTML(reports, branding, userEmail) {
  const primaryColor = branding?.primary_color || '#7CB342';
  const secondaryColor = branding?.secondary_color || '#9CCC65';
  const companyName = branding?.company_name || 'ELORA Solutions';
  const logoUrl = branding?.logo_url;

  let content = `
    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      This is your automated fleet compliance and management report. Below you'll find comprehensive insights into your fleet's performance.
    </p>
  `;

  // Compliance section
  if (reports.compliance) {
    const { summary, vehicles } = reports.compliance;
    content += `
      <div style="margin: 40px 0 20px 0;">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          📊 Compliance Overview
        </h2>
        <div style="height: 3px; width: 60px; background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%); border-radius: 2px; margin-top: 12px;"></div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
        <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-left: 4px solid ${primaryColor};">
          <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Average Compliance</h3>
          <p style="color: #0f172a; font-size: 32px; font-weight: 700; margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${summary.averageCompliance}%</p>
          <p style="color: #64748b; font-size: 14px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Across all vehicles</p>
        </div>
        <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-left: 4px solid ${secondaryColor};">
          <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Total Vehicles</h3>
          <p style="color: #0f172a; font-size: 32px; font-weight: 700; margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${summary.totalVehicles}</p>
          <p style="color: #64748b; font-size: 14px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">In your fleet</p>
        </div>
      </div>

      ${summary.alerts && summary.alerts.length > 0 ? summary.alerts.map(alert => `
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h4 style="color: #92400e; font-size: 16px; font-weight: 600; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${alert.title}</h4>
          <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${alert.message}</p>
        </div>
      `).join('') : ''}
    `;
  }

  // Maintenance section
  if (reports.maintenance) {
    const { summary, upcomingMaintenance } = reports.maintenance;
    content += `
      <div style="margin: 40px 0 20px 0;">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          🔧 Maintenance Status
        </h2>
        <div style="height: 3px; width: 60px; background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%); border-radius: 2px; margin-top: 12px;"></div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
        <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-left: 4px solid ${primaryColor};">
          <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Upcoming Services</h3>
          <p style="color: #0f172a; font-size: 32px; font-weight: 700; margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${summary.upcomingCount}</p>
          <p style="color: #64748b; font-size: 14px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Next 30 days</p>
        </div>
        <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-left: 4px solid #ef4444;">
          <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Overdue Services</h3>
          <p style="color: #0f172a; font-size: 32px; font-weight: 700; margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${summary.overdueCount}</p>
          <p style="color: #64748b; font-size: 14px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Need attention</p>
        </div>
      </div>

      ${upcomingMaintenance && upcomingMaintenance.length > 0 ? `
        <div style="overflow-x: auto; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 16px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Vehicle</th>
                <th style="padding: 16px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Service Type</th>
                <th style="padding: 16px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Due Date</th>
                <th style="padding: 16px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Days Until</th>
              </tr>
            </thead>
            <tbody>
              ${upcomingMaintenance.slice(0, 10).map((m, index) => `
                <tr style="border-bottom: 1px solid #f1f5f9; ${index % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;'}">
                  <td style="padding: 16px; font-size: 14px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${m.vehicleName}</td>
                  <td style="padding: 16px; font-size: 14px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${m.serviceType}</td>
                  <td style="padding: 16px; font-size: 14px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${m.dueDate}</td>
                  <td style="padding: 16px; font-size: 14px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${m.daysUntil} days</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
  }

  // AI Insights section
  if (reports.aiInsights) {
    content += `
      <div style="margin: 40px 0 20px 0;">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          🤖 AI-Generated Insights
        </h2>
        <div style="height: 3px; width: 60px; background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%); border-radius: 2px; margin-top: 12px;"></div>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid ${primaryColor};">
        <p style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap;">${reports.aiInsights}</p>
      </div>
    `;
  }

  // Wrap in complete email template
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Fleet Compliance Report</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 680px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
          ${logoUrl ? `
            <div style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); display: inline-block; padding: 20px 40px; border-radius: 12px; margin-bottom: 20px;">
              <img src="${logoUrl}" alt="${companyName}" style="max-height: 60px; max-width: 250px; display: block;" />
            </div>
          ` : ''}
          <h1 style="color: white; margin: ${logoUrl ? '10px' : '0'} 0 0 0; font-size: 28px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${companyName}
          </h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            Compliance Portal Report
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          ${content}
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 30px 20px; text-align: center; border-radius: 0 0 12px 12px; margin-top: 40px; border-top: 2px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            This is an automated report from ${companyName} Compliance Portal
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            © ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
