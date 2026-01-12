/**
 * Email Template Generator with Branding Support
 * Generates beautiful, responsive HTML emails with client branding
 */

/**
 * Generates a branded email header
 */
export const generateEmailHeader = (branding) => {
  const primaryColor = branding?.primary_color || '#2563eb';
  const secondaryColor = branding?.secondary_color || '#1e40af';
  const companyName = branding?.company_name || 'ELORA Solutions';
  const logoUrl = branding?.logo_url;

  return `
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
  `;
};

/**
 * Generates email footer
 */
export const generateEmailFooter = (branding) => {
  const companyName = branding?.company_name || 'ELORA Solutions';
  const currentYear = new Date().getFullYear();

  return `
    <div style="background: #f8fafc; padding: 30px 20px; text-align: center; border-radius: 0 0 12px 12px; margin-top: 40px; border-top: 2px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        This is an automated report from ${companyName} Compliance Portal
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        © ${currentYear} ${companyName}. All rights reserved.
      </p>
    </div>
  `;
};

/**
 * Generates a metric card for the email
 */
export const generateMetricCard = (title, value, subtitle, color = '#2563eb') => {
  return `
    <div style="background: white; border-radius: 12px; padding: 24px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-left: 4px solid ${color};">
      <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${title}
      </h3>
      <p style="color: #0f172a; font-size: 32px; font-weight: 700; margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${value}
      </p>
      ${subtitle ? `
        <p style="color: #64748b; font-size: 14px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          ${subtitle}
        </p>
      ` : ''}
    </div>
  `;
};

/**
 * Generates a data table
 */
export const generateDataTable = (headers, rows) => {
  return `
    <div style="overflow-x: auto; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <thead>
          <tr style="background: #f1f5f9;">
            ${headers.map(header => `
              <th style="padding: 16px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${header}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr style="border-bottom: 1px solid #f1f5f9; ${index % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;'}">
              ${row.map(cell => `
                <td style="padding: 16px; font-size: 14px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  ${cell}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

/**
 * Generates a section header
 */
export const generateSectionHeader = (title, icon = '📊') => {
  return `
    <div style="margin: 40px 0 20px 0;">
      <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0; display: flex; align-items: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <span style="margin-right: 12px; font-size: 28px;">${icon}</span>
        ${title}
      </h2>
      <div style="height: 3px; width: 60px; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%); border-radius: 2px; margin-top: 12px;"></div>
    </div>
  `;
};

/**
 * Generates an alert/callout box
 */
export const generateAlert = (title, message, type = 'info') => {
  const colors = {
    info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
    warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    danger: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' }
  };

  const color = colors[type] || colors.info;

  return `
    <div style="background: ${color.bg}; border-left: 4px solid ${color.border}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h4 style="color: ${color.text}; font-size: 16px; font-weight: 600; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${title}
      </h4>
      <p style="color: ${color.text}; font-size: 14px; margin: 0; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${message}
      </p>
    </div>
  `;
};

/**
 * Generates a complete branded email template
 */
export const generateCompleteEmailTemplate = (branding, content) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Compliance Portal Report</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 680px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        ${generateEmailHeader(branding)}

        <div style="padding: 40px 30px;">
          ${content}
        </div>

        ${generateEmailFooter(branding)}
      </div>
    </body>
    </html>
  `;
};

/**
 * Generates compliance report content
 */
export const generateComplianceReport = (data, branding) => {
  const { summary, vehicles, dateRange } = data;

  let content = `
    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      This report provides a comprehensive overview of your fleet compliance status for <strong>${dateRange || 'the selected period'}</strong>.
    </p>

    ${generateSectionHeader('Executive Summary', '📈')}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
      ${generateMetricCard('Average Compliance', `${summary?.averageCompliance || 0}%`, 'Across all vehicles', branding?.primary_color)}
      ${generateMetricCard('Total Vehicles', summary?.totalVehicles || 0, 'In your fleet', branding?.secondary_color)}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      ${generateMetricCard('Compliant', summary?.compliantVehicles || 0, 'Vehicles meeting targets', '#10b981')}
      ${generateMetricCard('At Risk', summary?.atRiskVehicles || 0, 'Vehicles needing attention', '#f59e0b')}
    </div>
  `;

  if (summary?.alerts && summary.alerts.length > 0) {
    content += `
      ${generateSectionHeader('Alerts & Action Items', '⚠️')}
      ${summary.alerts.map(alert =>
        generateAlert(alert.title, alert.message, alert.type)
      ).join('')}
    `;
  }

  if (vehicles && vehicles.length > 0) {
    content += `
      ${generateSectionHeader('Vehicle Compliance Details', '🚛')}
      ${generateDataTable(
        ['Vehicle', 'Site', 'Compliance', 'Washes', 'Status'],
        vehicles.map(v => [
          v.name || 'N/A',
          v.site || 'N/A',
          `${v.complianceRate || 0}%`,
          `${v.washesCompleted || 0}/${v.targetWashes || 0}`,
          v.status || 'Unknown'
        ])
      )}
    `;
  }

  return generateCompleteEmailTemplate(branding, content);
};

/**
 * Generates maintenance report content
 */
export const generateMaintenanceReport = (data, branding) => {
  const { summary, upcomingMaintenance, costAnalysis, dateRange } = data;

  let content = `
    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Fleet maintenance overview and upcoming service requirements for <strong>${dateRange || 'the selected period'}</strong>.
    </p>

    ${generateSectionHeader('Maintenance Summary', '🔧')}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
      ${generateMetricCard('Upcoming Services', summary?.upcomingCount || 0, 'Next 30 days', branding?.primary_color)}
      ${generateMetricCard('Overdue Services', summary?.overdueCount || 0, 'Require immediate attention', '#ef4444')}
    </div>
  `;

  if (costAnalysis) {
    content += `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        ${generateMetricCard('Monthly Average', `$${costAnalysis.monthlyAverage || 0}`, 'Maintenance costs', branding?.secondary_color)}
        ${generateMetricCard('Total This Period', `$${costAnalysis.totalCost || 0}`, 'All maintenance', '#10b981')}
      </div>
    `;
  }

  if (upcomingMaintenance && upcomingMaintenance.length > 0) {
    const urgentServices = upcomingMaintenance.filter(m => m.daysUntil <= 7);

    if (urgentServices.length > 0) {
      content += `
        ${generateSectionHeader('Urgent - Next 7 Days', '🚨')}
        ${generateDataTable(
          ['Vehicle', 'Service Type', 'Due Date', 'Days Until Due'],
          urgentServices.map(m => [
            m.vehicleName || 'N/A',
            m.serviceType || 'N/A',
            m.dueDate || 'N/A',
            `${m.daysUntil || 0} days`
          ])
        )}
      `;
    }

    content += `
      ${generateSectionHeader('All Upcoming Maintenance', '📅')}
      ${generateDataTable(
        ['Vehicle', 'Service Type', 'Due Date', 'Status'],
        upcomingMaintenance.map(m => [
          m.vehicleName || 'N/A',
          m.serviceType || 'N/A',
          m.dueDate || 'N/A',
          m.status || 'Scheduled'
        ])
      )}
    `;
  }

  return generateCompleteEmailTemplate(branding, content);
};

/**
 * Generates a combined "All Reports" email
 */
export const generateAllReportsEmail = (reports, branding) => {
  let content = `
    <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Complete fleet management report including compliance, maintenance, and analytics insights.
    </p>
  `;

  // Compliance Section
  if (reports.compliance) {
    const { summary, vehicles } = reports.compliance;
    content += `
      ${generateSectionHeader('Compliance Overview', '📊')}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
        ${generateMetricCard('Average Compliance', `${summary?.averageCompliance || 0}%`, 'Across all vehicles', branding?.primary_color)}
        ${generateMetricCard('Compliant Vehicles', summary?.compliantVehicles || 0, `of ${summary?.totalVehicles || 0} total`, '#10b981')}
      </div>
    `;

    if (summary?.alerts && summary.alerts.length > 0) {
      content += summary.alerts.map(alert =>
        generateAlert(alert.title, alert.message, alert.type)
      ).join('');
    }
  }

  // Maintenance Section
  if (reports.maintenance) {
    const { summary, upcomingMaintenance } = reports.maintenance;
    content += `
      ${generateSectionHeader('Maintenance Status', '🔧')}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
        ${generateMetricCard('Upcoming Services', summary?.upcomingCount || 0, 'Next 30 days', branding?.secondary_color)}
        ${generateMetricCard('Overdue Services', summary?.overdueCount || 0, 'Need attention', '#ef4444')}
      </div>

      ${upcomingMaintenance && upcomingMaintenance.length > 0 ?
        generateDataTable(
          ['Vehicle', 'Service Type', 'Due Date', 'Days Until'],
          upcomingMaintenance.slice(0, 5).map(m => [
            m.vehicleName || 'N/A',
            m.serviceType || 'N/A',
            m.dueDate || 'N/A',
            `${m.daysUntil || 0} days`
          ])
        )
        : '<p style="color: #64748b; font-style: italic;">No upcoming maintenance scheduled</p>'
      }
    `;
  }

  // Cost Analysis Section
  if (reports.costs) {
    const { summary } = reports.costs;
    content += `
      ${generateSectionHeader('Cost Analysis', '💰')}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        ${generateMetricCard('Monthly Average', `$${summary?.monthlyAverage || 0}`, 'Maintenance costs', branding?.primary_color)}
        ${generateMetricCard('This Period', `$${summary?.totalCost || 0}`, 'Total maintenance', '#10b981')}
      </div>
    `;
  }

  // AI Insights Section
  if (reports.aiInsights) {
    content += `
      ${generateSectionHeader('AI-Generated Insights', '🤖')}
      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid ${branding?.primary_color || '#2563eb'};">
        <p style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap;">
          ${reports.aiInsights}
        </p>
      </div>
    `;
  }

  return generateCompleteEmailTemplate(branding, content);
};
