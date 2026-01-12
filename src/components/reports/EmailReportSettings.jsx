import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Mail, Send, Clock, CheckCircle, Settings, Loader2, FileDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Chart } from 'chart.js/auto';

export default function EmailReportSettings() {
  const queryClient = useQueryClient();
  const { user: currentUser, isLoading: userLoading } = useAuth();
  const [userError, setUserError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pdfHtml, setPdfHtml] = useState('');
  const pdfContainerRef = useRef(null);

  // Fetch user's email report preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['emailReportPreferences', 'jonny@elora.com.au'],
    queryFn: async () => {
      if (!currentUser?.email) return null;

      try {
        const { data: result, error } = await supabaseClient.tables.emailReportPreferences
          .select('*')
          .eq('user_email', 'jonny@elora.com.au');

        if (result && result.length > 0) {
          return result[0];
        }

        // Return default preferences if none exist
        return {
          user_email: 'jonny@elora.com.au',
          enabled: false,
          frequency: 'weekly',
          report_types: [],
          include_charts: true,
          include_ai_insights: true,
          scheduled_time: '09:00',
          scheduled_day_of_week: 1,
          scheduled_day_of_month: 1
        };
      } catch (error) {
        console.error('Error fetching preferences:', error);
        return null;
      }
    },
    enabled: !!currentUser?.email
  });

  // Form state
  const [formData, setFormData] = useState({
    enabled: false,
    frequency: 'weekly',
    report_types: [],
    include_charts: true,
    include_ai_insights: true,
    scheduled_time: '09:00',
    scheduled_day_of_week: 1, // Monday
    scheduled_day_of_month: 1
  });

  // Update form when preferences load
  useEffect(() => {
    if (preferences) {
      setFormData({
        enabled: preferences.enabled || false,
        frequency: preferences.frequency || 'weekly',
        report_types: preferences.report_types || [],
        include_charts: preferences.include_charts !== false,
        include_ai_insights: preferences.include_ai_insights !== false,
        scheduled_time: preferences.scheduled_time || '09:00',
        scheduled_day_of_week: preferences.scheduled_day_of_week ?? 1,
        scheduled_day_of_month: preferences.scheduled_day_of_month || 1
      });
    }
  }, [preferences]);

  // Available report types
  const reportTypes = [
    { id: 'compliance', label: 'Compliance Summary', icon: '📊', description: 'Vehicle compliance rates and wash tracking' },
    { id: 'maintenance', label: 'Maintenance Analysis', icon: '🔧', description: 'Upcoming services and maintenance alerts' },
    { id: 'costs', label: 'Cost Analysis', icon: '💰', description: 'Maintenance costs and financial trends' },
    { id: 'ai_insights', label: 'AI-Generated Insights', icon: '🤖', description: 'Intelligent analysis and recommendations' }
  ];

  // Handle report type toggle
  const handleReportTypeToggle = (reportId) => {
    setFormData(prev => ({
      ...prev,
      report_types: prev.report_types.includes(reportId)
        ? prev.report_types.filter(id => id !== reportId)
        : [...prev.report_types, reportId]
    }));
  };

  // Handle "All Reports" toggle
  const handleAllReportsToggle = () => {
    const allReportIds = reportTypes.map(r => r.id);
    const allSelected = allReportIds.every(id => formData.report_types.includes(id));

    setFormData(prev => ({
      ...prev,
      report_types: allSelected ? [] : allReportIds
    }));
  };

  // Save preferences mutation
  const savePreferences = async () => {
    if (!currentUser?.email) return;

    setSaving(true);
    try {
      const data = {
        user_email: 'jonny@elora.com.au',
        enabled: formData.enabled,
        frequency: formData.frequency,
        report_types: formData.report_types,
        include_charts: formData.include_charts,
        include_ai_insights: formData.include_ai_insights,
        scheduled_time: formData.scheduled_time,
        scheduled_day_of_week: formData.scheduled_day_of_week,
        scheduled_day_of_month: formData.scheduled_day_of_month,
        last_sent: preferences?.last_sent || null,
        next_scheduled: calculateNextScheduled(formData.frequency, formData.scheduled_time, formData.scheduled_day_of_week, formData.scheduled_day_of_month)
      };

      if (preferences?.id) {
        // Update existing
        await supabaseClient.tables.emailReportPreferences
          .update(data)
          .eq('id', preferences.id);
      } else {
        // Create new
        await supabaseClient.tables.emailReportPreferences
          .insert([data]);
      }

      queryClient.invalidateQueries(['emailReportPreferences', 'jonny@elora.com.au']);
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate next scheduled date based on frequency
  const calculateNextScheduled = (frequency, scheduledTime = '09:00', dayOfWeek = 1, dayOfMonth = 1) => {
    const now = new Date();
    const [hours, minutes] = scheduledTime.split(':').map(Number);

    let nextDate = new Date();

    switch (frequency) {
      case 'daily':
        nextDate.setHours(hours, minutes, 0, 0);
        // If the time has passed today, schedule for tomorrow
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        break;

      case 'weekly':
        nextDate.setHours(hours, minutes, 0, 0);
        // Set to the specified day of week
        const currentDay = nextDate.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        nextDate.setDate(nextDate.getDate() + daysUntilTarget);

        // If that's today but the time has passed, schedule for next week
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 7);
        }
        break;

      case 'monthly':
        nextDate.setHours(hours, minutes, 0, 0);
        nextDate.setDate(dayOfMonth);

        // If the day is in the past this month, schedule for next month
        if (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(dayOfMonth);
        }
        break;
    }

    return nextDate.toISOString();
  };

  // Send email now
  const handleSendNow = async () => {
    console.log('[handleSendNow] Button clicked');
    console.log('[handleSendNow] Current user state:', {
      currentUser: currentUser,
      email: currentUser?.email,
      hasEmail: !!currentUser?.email,
      userLoading: userLoading
    });

    if (!currentUser) {
      console.error('[handleSendNow] Current user is null');
      alert('User not loaded. Please wait a moment and try again.');
      return;
    }

    if (!currentUser.email) {
      console.error('[handleSendNow] Current user has no email field:', currentUser);
      alert('User email not found. Please refresh the page and try again.');
      return;
    }

    if (formData.report_types.length === 0) {
      console.warn('[handleSendNow] No report types selected');
      alert('Please select at least one report type to send');
      return;
    }

    setSendingNow(true);
    try {
      console.log('[handleSendNow] Sending email report with params:', {
        userEmail: 'jonny@elora.com.au',
        reportTypes: formData.report_types,
        includeCharts: formData.include_charts,
        includeAiInsights: formData.include_ai_insights
      });

      // Call cloud function to send email immediately
      const result = await supabaseClient.reports.send({
        userEmail: 'jonny@elora.com.au',
        reportTypes: formData.report_types,
        includeCharts: formData.include_charts,
        includeAiInsights: formData.include_ai_insights
      });

      console.log('[handleSendNow] Email report sent successfully:', result);
      setSuccessMessage('Report sent successfully to jonny@elora.com.au! Check your email inbox.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('[handleSendNow] Error sending email report:', error);
      console.error('[handleSendNow] Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response,
        name: error.name
      });

      let errorMessage = 'Failed to send email. ';
      if (error.message && error.message.includes('User not found')) {
        errorMessage = 'Your user account was not found in the system. Please contact support.';
      } else if (error.message) {
        errorMessage += `Error: ${error.message}`;
      } else {
        errorMessage += 'Please try again or contact support.';
      }

      alert(errorMessage);
    } finally {
      setSendingNow(false);
    }
  };

  const extractBodyHtml = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body?.innerHTML || html;
  };

  const generateChartImage = async (type, data, primaryColor) => {
    // Create a temporary canvas for the chart
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 250;

    const ctx = canvas.getContext('2d');

    let chartConfig;

    if (type === 'compliance') {
      chartConfig = {
        type: 'doughnut',
        data: {
          labels: ['Compliant', 'At Risk'],
          datasets: [{
            data: [data.compliant || 0, data.atRisk || 0],
            backgroundColor: [primaryColor || '#7CB342', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { size: 12 },
                padding: 15
              }
            }
          }
        }
      };
    } else if (type === 'maintenance') {
      chartConfig = {
        type: 'bar',
        data: {
          labels: ['Upcoming', 'Overdue'],
          datasets: [{
            label: 'Services',
            data: [data.upcoming || 0, data.overdue || 0],
            backgroundColor: [primaryColor || '#7CB342', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      };
    } else if (type === 'costs') {
      // Create a simple bar chart for costs
      chartConfig = {
        type: 'bar',
        data: {
          labels: ['Monthly Average', 'Total Period'],
          datasets: [{
            label: 'Cost ($)',
            data: [data.monthly || 0, data.total || 0],
            backgroundColor: [primaryColor || '#7CB342', '#10b981'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: false,
          scales: {
            y: {
              beginAtZero: true
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      };
    }

    const chart = new Chart(ctx, chartConfig);

    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));

    const imageUrl = canvas.toDataURL('image/png');

    // Clean up
    chart.destroy();

    return imageUrl;
  };

  const buildEnhancedReportHtml = async (reportData, clientBranding = null, includeCharts = true) => {
    const selectedReports = formData.report_types.length > 0
      ? formData.report_types
      : ['compliance', 'maintenance', 'costs', 'ai_insights'];

    // Use client branding if provided, otherwise use default colors
    const primaryColor = clientBranding?.primary_color || '#7CB342';
    const secondaryColor = clientBranding?.secondary_color || '#9CCC65';
    const companyName = clientBranding?.company_name || 'ELORA';
    const logoUrl = clientBranding?.logo_url || null;

    const section = (title, content) => `
      <div style="margin: 30px 0 20px 0; page-break-inside: avoid;">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; font-family: Arial, sans-serif;">
          ${title}
        </h2>
        <div style="height: 3px; width: 60px; background: ${primaryColor}; margin-bottom: 20px;"></div>
      </div>
      ${content}
    `;

    const metricCard = (label, value, subtitle, color = primaryColor) => `
      <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 15px; border-left: 4px solid ${color}; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
        <div style="color: #334155; font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif;">${label}</div>
        <div style="color: #0f172a; font-size: 32px; font-weight: 700; margin-bottom: 4px; font-family: Arial, sans-serif;">${value}</div>
        <div style="color: #64748b; font-size: 13px; font-family: Arial, sans-serif;">${subtitle}</div>
      </div>
    `;

    const twoColumnMetrics = (leftCard, rightCard) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td width="48%" style="vertical-align: top;">${leftCard}</td>
          <td width="4%"></td>
          <td width="48%" style="vertical-align: top;">${rightCard}</td>
        </tr>
      </table>
    `;

    let content = `
      <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0; font-family: Arial, sans-serif;">
        ${reportData ? 'This PDF was generated from your current fleet data.' : 'This PDF was generated from your current report selections. Live data could not be loaded, so placeholder values are shown.'}
      </p>
    `;

    // Compliance section
    if (selectedReports.includes('compliance')) {
      const complianceData = reportData?.compliance?.summary;

      if (complianceData) {
        let chartHtml = '';
        if (includeCharts) {
          try {
            const chartImage = await generateChartImage('compliance', {
              compliant: complianceData.compliantVehicles || 0,
              atRisk: complianceData.atRiskVehicles || 0
            }, primaryColor);
            chartHtml = `
              <div style="text-align: center; margin: 20px 0; page-break-inside: avoid;">
                <img src="${chartImage}" style="max-width: 400px; height: auto;" alt="Compliance Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating compliance chart:', error);
          }
        }

        content += section('Compliance Overview',
          twoColumnMetrics(
            metricCard('AVERAGE COMPLIANCE', `${complianceData.averageCompliance || 0}%`, 'Across all vehicles', primaryColor),
            metricCard('TOTAL VEHICLES', `${complianceData.totalVehicles || 0}`, 'In your fleet', secondaryColor)
          ) +
          twoColumnMetrics(
            metricCard('COMPLIANT', `${complianceData.compliantVehicles || 0}`, '≥80% compliance', primaryColor),
            metricCard('AT RISK', `${complianceData.atRiskVehicles || 0}`, '<80% compliance', '#ef4444')
          ) +
          chartHtml +
          (complianceData.alerts && complianceData.alerts.length > 0 ? complianceData.alerts.map(alert => `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; page-break-inside: avoid;">
              <h4 style="color: #92400e; font-size: 15px; font-weight: 600; margin: 0 0 8px 0; font-family: Arial, sans-serif;">${alert.title}</h4>
              <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6; font-family: Arial, sans-serif;">${alert.message}</p>
            </div>
          `).join('') : '')
        );
      } else {
        content += section('Compliance Overview',
          twoColumnMetrics(
            metricCard('AVERAGE COMPLIANCE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL VEHICLES', '—', 'Awaiting live data', secondaryColor)
          ) + `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #92400e; font-size: 15px; font-weight: 600; margin: 0 0 8px 0; font-family: Arial, sans-serif;">Data Pending</h4>
            <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6; font-family: Arial, sans-serif;">Connect to live data sources to populate compliance metrics.</p>
          </div>
        `);
      }
    }

    // Maintenance section
    if (selectedReports.includes('maintenance')) {
      const maintenanceData = reportData?.maintenance?.summary;
      const maintenanceList = reportData?.maintenance?.upcomingMaintenance;

      if (maintenanceData) {
        let chartHtml = '';
        if (includeCharts) {
          try {
            const chartImage = await generateChartImage('maintenance', {
              upcoming: maintenanceData.upcomingCount || 0,
              overdue: maintenanceData.overdueCount || 0
            }, primaryColor);
            chartHtml = `
              <div style="text-align: center; margin: 20px 0; page-break-inside: avoid;">
                <img src="${chartImage}" style="max-width: 400px; height: auto;" alt="Maintenance Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating maintenance chart:', error);
          }
        }

        let maintenanceTable = '';
        if (maintenanceList && maintenanceList.length > 0) {
          maintenanceTable = `
            <div style="margin: 20px 0; page-break-inside: avoid;">
              <h3 style="color: #334155; font-size: 16px; font-weight: 600; margin: 20px 0 10px 0; font-family: Arial, sans-serif;">Upcoming Maintenance Items</h3>
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
                <thead>
                  <tr style="background: #f1f5f9;">
                    <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; font-family: Arial, sans-serif;">Vehicle</th>
                    <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; font-family: Arial, sans-serif;">Service</th>
                    <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; font-family: Arial, sans-serif;">Due Date</th>
                    <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; font-family: Arial, sans-serif;">Days</th>
                  </tr>
                </thead>
                <tbody>
                  ${maintenanceList.slice(0, 10).map((m, index) => `
                    <tr style="border-bottom: 1px solid #f1f5f9; ${index % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;'}">
                      <td style="padding: 12px; font-size: 13px; color: #334155; font-family: Arial, sans-serif;">${m.vehicleName}</td>
                      <td style="padding: 12px; font-size: 13px; color: #334155; font-family: Arial, sans-serif;">${m.serviceType}</td>
                      <td style="padding: 12px; font-size: 13px; color: #334155; font-family: Arial, sans-serif;">${m.dueDate}</td>
                      <td style="padding: 12px; font-size: 13px; color: ${m.status === 'Overdue' ? '#ef4444' : '#334155'}; font-weight: ${m.status === 'Overdue' ? '600' : '400'}; font-family: Arial, sans-serif;">${m.daysUntil}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }

        content += section('Maintenance Status',
          twoColumnMetrics(
            metricCard('UPCOMING SERVICES', `${maintenanceData.upcomingCount || 0}`, 'Next 30 days', primaryColor),
            metricCard('OVERDUE SERVICES', `${maintenanceData.overdueCount || 0}`, 'Need attention', '#ef4444')
          ) +
          chartHtml +
          maintenanceTable
        );
      } else {
        content += section('Maintenance Status',
          twoColumnMetrics(
            metricCard('UPCOMING SERVICES', '—', 'Awaiting live data', primaryColor),
            metricCard('OVERDUE SERVICES', '—', 'Awaiting live data', '#ef4444')
          ) + `
          <div style="background: #f8fafc; border-radius: 8px; padding: 18px; margin: 20px 0; border: 1px dashed #cbd5e1;">
            <p style="color: #475569; font-size: 13px; margin: 0; font-family: Arial, sans-serif;">Maintenance items will appear here once data syncing is complete.</p>
          </div>
        `);
      }
    }

    // Cost Analysis section
    if (selectedReports.includes('costs')) {
      const costData = reportData?.costs?.summary;

      if (costData) {
        let chartHtml = '';
        if (includeCharts) {
          try {
            const chartImage = await generateChartImage('costs', {
              monthly: costData.monthlyAverage || 0,
              total: costData.totalCost || 0
            }, primaryColor);
            chartHtml = `
              <div style="text-align: center; margin: 20px 0; page-break-inside: avoid;">
                <img src="${chartImage}" style="max-width: 400px; height: auto;" alt="Cost Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating cost chart:', error);
          }
        }

        content += section('Cost Analysis',
          twoColumnMetrics(
            metricCard('MONTHLY AVERAGE', `$${costData.monthlyAverage || 0}`, 'Per month', primaryColor),
            metricCard('TOTAL THIS PERIOD', `$${costData.totalCost || 0}`, 'Last 30 days', '#10b981')
          ) +
          chartHtml
        );
      } else {
        content += section('Cost Analysis',
          twoColumnMetrics(
            metricCard('MONTHLY AVERAGE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL THIS PERIOD', '—', 'Awaiting live data', '#10b981')
          )
        );
      }
    }

    // AI Insights section
    if (selectedReports.includes('ai_insights')) {
      const aiInsights = reportData?.aiInsights;

      if (aiInsights && aiInsights !== 'AI insights are currently unavailable.') {
        content += section('AI-Generated Insights', `
          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 20px 0; border-left: 4px solid ${primaryColor}; page-break-inside: avoid;">
            <p style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; font-family: Arial, sans-serif; white-space: pre-wrap;">${aiInsights}</p>
          </div>
        `);
      } else {
        content += section('AI-Generated Insights', `
          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 20px 0; border-left: 4px solid ${primaryColor};">
            <p style="color: #334155; font-size: 13px; line-height: 1.8; margin: 0; font-family: Arial, sans-serif;">
              AI insights will be generated once live data becomes available.
            </p>
          </div>
        `);
      }
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fleet Compliance Report - ${companyName}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, sans-serif;">
        <div style="width: 700px; margin: 30px auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            ${logoUrl ? `
              <img src="${logoUrl}" alt="${companyName}" style="height: 60px; object-fit: contain; margin-bottom: 16px; display: inline-block;" />
            ` : ''}
            <h1 style="color: white; margin: 0; font-size: 36px; font-weight: 700; font-family: Arial, sans-serif; letter-spacing: 2px;">
              ${companyName}
            </h1>
            <p style="color: rgba(255, 255, 255, 0.95); margin: 12px 0 0 0; font-size: 16px; font-family: Arial, sans-serif; letter-spacing: 0.5px;">
              Compliance Portal Report
            </p>
          </div>
          <div style="padding: 40px 35px;">
            ${content}
          </div>
          <div style="background: #f8fafc; padding: 25px 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 2px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0; font-family: Arial, sans-serif;">
              This is a ${reportData ? '' : 'preview '}PDF generated from your current settings.
            </p>
            <p style="color: #94a3b8; font-size: 11px; margin: 0; font-family: Arial, sans-serif;">
              © ${new Date().getFullYear()} ${companyName}. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleExportPdf = async () => {
    console.log('[handleExportPdf] Starting PDF export...');

    if (!currentUser) {
      alert('User not loaded. Please wait a moment and try again.');
      return;
    }

    if (!currentUser.email) {
      alert('User email not found. Please refresh the page and try again.');
      return;
    }

    if (formData.report_types.length === 0) {
      alert('Please select at least one report type to export');
      return;
    }

    setExportingPdf(true);

    try {
      // Fetch user's branding based on email domain
      let branding = null;
      try {
        console.log('[handleExportPdf] Fetching branding for user:', currentUser.email);
        const emailDomain = currentUser.email.split('@')[1];
        console.log('[handleExportPdf] Email domain:', emailDomain);

        const { data: brandingResults, error: brandingError } = await supabaseClient.tables.clientBranding
          .select('*')
          .eq('client_email_domain', emailDomain);

        console.log('[handleExportPdf] Branding results:', brandingResults);

        if (brandingResults && brandingResults.length > 0) {
          branding = brandingResults[0];
          console.log('[handleExportPdf] Using client branding:', branding.company_name);
        } else {
          console.log('[handleExportPdf] No branding found, using default ELORA branding');
          branding = {
            company_name: 'ELORA',
            logo_url: null,
            primary_color: '#7CB342',
            secondary_color: '#9CCC65'
          };
        }
      } catch (error) {
        console.error('[handleExportPdf] Error fetching branding:', error);
        branding = {
          company_name: 'ELORA',
          logo_url: null,
          primary_color: '#7CB342',
          secondary_color: '#9CCC65'
        };
      }

      let reportData = null;
      let reportHtml = '';
      let usedBackendData = false;

      // Try to fetch report data from backend
      try {
        console.log('[handleExportPdf] Fetching report data from backend...');
        const result = await supabaseClient.reports.send({
          userEmail: currentUser.email,
          reportTypes: formData.report_types,
          includeCharts: false, // We'll generate charts ourselves
          includeAiInsights: formData.include_ai_insights,
          previewOnly: true
        });

        console.log('[handleExportPdf] Backend response received:', result);

        // The backend might return the data in different formats
        // Check if we got HTML back or structured data
        if (result?.data?.html || result?.html) {
          // Backend returned HTML - we need to parse it or use it directly
          const htmlContent = result?.data?.html || result?.html;
          console.log('[handleExportPdf] Received HTML from backend, length:', htmlContent.length);

          // For now, we'll try to extract data from vehicles/maintenance directly
          // This is a workaround - ideally backend should return structured data
          try {
            const { data: vehicles } = await supabaseClient.tables.vehicles
              .select('*')
              .order('updated_date', { ascending: false })
              .limit(1000);
            const { data: maintenanceRecords } = await supabaseClient.tables.maintenanceRecords
              .select('*')
              .order('service_date', { ascending: false })
              .limit(1000);

            console.log('[handleExportPdf] Fetched data directly:', {
              vehicleCount: vehicles?.length || 0,
              maintenanceCount: maintenanceRecords?.length || 0
            });

            if (vehicles && vehicles.length > 0) {
              // Generate compliance data
              const compliantVehicles = vehicles.filter(v => (v.compliance_rate || 0) >= 80);
              const atRiskVehicles = vehicles.filter(v => (v.compliance_rate || 0) < 80);
              const totalCompliance = vehicles.reduce((sum, v) => sum + (v.compliance_rate || 0), 0);
              const averageCompliance = Math.round(totalCompliance / vehicles.length);

              // Generate maintenance data
              const now = new Date();
              const upcomingMaintenance = [];
              let overdueCount = 0;

              for (const record of maintenanceRecords || []) {
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

              upcomingMaintenance.sort((a, b) => a.daysUntil - b.daysUntil);

              // Generate cost data
              const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              const recentRecords = maintenanceRecords?.filter(r => {
                if (!r.service_date) return false;
                const serviceDate = new Date(r.service_date);
                return serviceDate >= thirtyDaysAgo;
              }) || [];

              const totalCost = recentRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
              const monthlyAverage = Math.round(totalCost / (recentRecords.length > 0 ? 1 : 1));

              reportData = {
                compliance: {
                  summary: {
                    averageCompliance,
                    totalVehicles: vehicles.length,
                    compliantVehicles: compliantVehicles.length,
                    atRiskVehicles: atRiskVehicles.length,
                    alerts: atRiskVehicles.length > 0 ? [{
                      title: 'Low Compliance Alert',
                      message: `${atRiskVehicles.length} vehicle(s) are below the 80% compliance threshold and require attention.`,
                      type: 'warning'
                    }] : []
                  }
                },
                maintenance: {
                  summary: {
                    upcomingCount: upcomingMaintenance.length,
                    overdueCount
                  },
                  upcomingMaintenance
                },
                costs: {
                  summary: {
                    totalCost: Math.round(totalCost),
                    monthlyAverage,
                    recordCount: recentRecords.length
                  }
                },
                aiInsights: formData.include_ai_insights ? 'AI insights are being generated...' : null
              };

              usedBackendData = true;
              console.log('[handleExportPdf] Successfully parsed data from backend');
            }
          } catch (dataError) {
            console.error('[handleExportPdf] Error fetching direct data:', dataError);
          }
        }
      } catch (error) {
        console.error('[handleExportPdf] Backend call failed:', error);
        console.error('[handleExportPdf] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }

      // Generate enhanced HTML with charts
      console.log('[handleExportPdf] Generating enhanced HTML with charts...');
      reportHtml = await buildEnhancedReportHtml(reportData, branding, formData.include_charts);

      if (!reportData) {
        console.warn('[handleExportPdf] Using fallback template - real data was not available');
        usedBackendData = false;
      }

      console.log('[handleExportPdf] Report HTML length:', reportHtml.length);

      // Extract body content and set it in the hidden container
      const bodyContent = extractBodyHtml(reportHtml);
      console.log('[handleExportPdf] Setting PDF HTML in container');
      setPdfHtml(bodyContent);

      // Wait for React to render the HTML and all resources to load
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Verify the container exists
      if (!pdfContainerRef.current) {
        throw new Error('PDF container not available. Please try again.');
      }

      console.log('[handleExportPdf] Container ready, capturing with html2canvas...');
      console.log('[handleExportPdf] Container dimensions:', {
        scrollHeight: pdfContainerRef.current.scrollHeight,
        offsetHeight: pdfContainerRef.current.offsetHeight,
        clientHeight: pdfContainerRef.current.clientHeight
      });

      // Capture the HTML as a canvas with improved settings
      const canvas = await html2canvas(pdfContainerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f1f5f9',
        logging: false,
        width: 820,
        height: pdfContainerRef.current.scrollHeight || 1200,
        x: 0,
        y: 0
      });

      console.log('[handleExportPdf] Canvas captured:', canvas.width, 'x', canvas.height);

      // Convert canvas to PDF with better page handling
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      // Add first page
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - margin * 2);

      // Add additional pages if needed with proper positioning
      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft) + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - margin * 2);
      }

      // Save the PDF
      const filename = `${branding.company_name.replace(/\s+/g, '-')}-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      console.log('[handleExportPdf] Saving PDF as:', filename);
      pdf.save(filename);

      // Show appropriate success message
      if (usedBackendData) {
        setSuccessMessage('PDF exported successfully with real data!');
      } else {
        setSuccessMessage('PDF exported. Connect to live data sources for real metrics.');
      }
      setTimeout(() => setSuccessMessage(''), 5000);

      console.log('[handleExportPdf] PDF export completed successfully');
    } catch (error) {
      console.error('[handleExportPdf] Error exporting PDF:', error);
      console.error('[handleExportPdf] Error stack:', error.stack);
      alert(`Failed to export PDF: ${error.message || 'Unknown error'}. Check the console for details.`);
    } finally {
      setExportingPdf(false);
      // Clear the PDF HTML to free up memory
      setPdfHtml('');
    }
  };

  // Manual retry for user loading (no longer needed with useAuth hook)
  const handleRetryUserLoad = () => {
    window.location.reload();
  };

  // Show error state if user failed to load
  if (userError && !userLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to Load User Information</h3>
              <p className="text-red-700 mb-4">
                We couldn't load your user information. This might be due to a temporary connection issue.
              </p>
              <p className="text-sm text-red-600 mb-4">Error: {userError}</p>
              <button
                onClick={handleRetryUserLoad}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-elora-primary mx-auto mb-4" />
          <p className="text-slate-600">Loading email report settings...</p>
          {retryCount > 0 && (
            <p className="text-slate-500 text-sm mt-2">Retrying... (attempt {retryCount + 1})</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-elora-primary to-elora-primary-light text-white rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
            <Mail className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Email Report Settings</h1>
            <p className="text-white/90">Configure automated email reports and delivery preferences</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Enable Email Reports</h2>
              <p className="text-sm text-slate-600">Receive automated reports via email</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-elora-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-elora-primary"></div>
          </label>
        </div>
      </div>

      {/* Report Frequency */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">Report Frequency</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {['daily', 'weekly', 'monthly'].map((freq) => (
            <button
              key={freq}
              onClick={() => setFormData(prev => ({ ...prev, frequency: freq }))}
              className={`p-4 rounded-lg border-2 transition-all ${
                formData.frequency === freq
                  ? 'border-elora-primary bg-elora-primary/5 text-elora-primary font-semibold'
                  : 'border-slate-200 text-slate-600 hover:border-elora-primary/50'
              }`}
            >
              <div className="text-center">
                <div className="text-lg capitalize">{freq}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Scheduling Options */}
        <div className="pt-6 border-t border-slate-200 space-y-4">
          <h3 className="text-md font-semibold text-slate-700 mb-3">Schedule Details</h3>

          {/* Time Picker (all frequencies) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-sm font-medium text-slate-600 min-w-[100px]">
              Time of Day:
            </label>
            <input
              type="time"
              value={formData.scheduled_time}
              onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-elora-primary focus:border-transparent"
            />
            <span className="text-sm text-slate-500">
              Reports will be sent at this time
            </span>
          </div>

          {/* Day of Week Picker (weekly only) */}
          {formData.frequency === 'weekly' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm font-medium text-slate-600 min-w-[100px]">
                Day of Week:
              </label>
              <select
                value={formData.scheduled_day_of_week}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_day_of_week: Number(e.target.value) }))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-elora-primary focus:border-transparent"
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
              <span className="text-sm text-slate-500">
                Weekly reports will be sent on this day
              </span>
            </div>
          )}

          {/* Day of Month Picker (monthly only) */}
          {formData.frequency === 'monthly' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-sm font-medium text-slate-600 min-w-[100px]">
                Day of Month:
              </label>
              <select
                value={formData.scheduled_day_of_month}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_day_of_month: Number(e.target.value) }))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-elora-primary focus:border-transparent"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <span className="text-sm text-slate-500">
                Monthly reports will be sent on this day
              </span>
            </div>
          )}

          {/* Preview of next scheduled time */}
          {formData.enabled && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Next scheduled report:</strong>{' '}
                {new Date(calculateNextScheduled(
                  formData.frequency,
                  formData.scheduled_time,
                  formData.scheduled_day_of_week,
                  formData.scheduled_day_of_month
                )).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Report Types Selection */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Select Reports to Include</h2>
          </div>
          <button
            onClick={handleAllReportsToggle}
            className="px-4 py-2 text-sm font-medium text-elora-primary hover:bg-elora-primary/5 rounded-lg transition-colors"
          >
            {reportTypes.every(r => formData.report_types.includes(r.id)) ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="grid gap-4">
          {reportTypes.map((report) => (
            <label
              key={report.id}
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                formData.report_types.includes(report.id)
                  ? 'border-elora-primary bg-elora-primary/5'
                  : 'border-slate-200 hover:border-elora-primary/30'
              }`}
            >
              <input
                type="checkbox"
                checked={formData.report_types.includes(report.id)}
                onChange={() => handleReportTypeToggle(report.id)}
                className="mt-1 w-5 h-5 text-elora-primary border-slate-300 rounded focus:ring-elora-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{report.icon}</span>
                  <span className="font-semibold text-slate-800">{report.label}</span>
                </div>
                <p className="text-sm text-slate-600">{report.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Additional Options */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Additional Options</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.include_charts}
              onChange={(e) => setFormData(prev => ({ ...prev, include_charts: e.target.checked }))}
              className="w-5 h-5 text-elora-primary border-slate-300 rounded focus:ring-elora-primary"
            />
            <div>
              <div className="font-medium text-slate-800">Include Charts & Visualizations</div>
              <div className="text-sm text-slate-600">Add visual graphs and charts to your reports</div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.include_ai_insights}
              onChange={(e) => setFormData(prev => ({ ...prev, include_ai_insights: e.target.checked }))}
              className="w-5 h-5 text-elora-primary border-slate-300 rounded focus:ring-elora-primary"
            />
            <div>
              <div className="font-medium text-slate-800">Include AI-Generated Insights</div>
              <div className="text-sm text-slate-600">Get intelligent analysis and recommendations</div>
            </div>
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="flex-1 bg-elora-primary hover:bg-elora-primary-light text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Settings className="w-5 h-5" />
              Save Settings
            </>
          )}
        </button>

        <button
          onClick={handleSendNow}
          disabled={sendingNow || userLoading || !currentUser?.email || formData.report_types.length === 0}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          title={
            userLoading ? 'Loading user information...' :
            !currentUser?.email ? 'User email not available' :
            formData.report_types.length === 0 ? 'Please select at least one report type' :
            'Send email report now'
          }
        >
          {sendingNow ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : userLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Email Me Now
            </>
          )}
        </button>

        <button
          onClick={handleExportPdf}
          disabled={exportingPdf || userLoading || !currentUser?.email || formData.report_types.length === 0}
          className="flex-1 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold py-4 px-6 rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          title={
            userLoading ? 'Loading user information...' :
            !currentUser?.email ? 'User email not available' :
            formData.report_types.length === 0 ? 'Please select at least one report type' :
            'Export report to PDF'
          }
        >
          {exportingPdf ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileDown className="w-5 h-5" />
              Export to PDF
            </>
          )}
        </button>
      </div>

      <div
        ref={pdfContainerRef}
        style={{
          position: 'fixed',
          width: '820px',
          minHeight: pdfHtml ? '1000px' : '0px',
          padding: '24px',
          background: '#f1f5f9',
          top: '-99999px',
          left: '0',
          pointerEvents: 'none',
          zIndex: -9999,
          overflow: 'visible',
          visibility: pdfHtml ? 'visible' : 'hidden'
        }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: pdfHtml }}
      />

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Email reports will be sent to{' '}
          <strong className="text-blue-900">jonny@elora.com.au</strong>{' '}
          with your organization's branding.
          {formData.enabled && formData.frequency && (
            <span> Your next scheduled report will be sent {formData.frequency}.</span>
          )}
        </p>
      </div>

      {/* Debug Info (remove after testing) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 border border-gray-300 p-4 rounded-lg text-xs">
          <p className="font-bold mb-2">Debug Info:</p>
          <p>User Loading: {userLoading ? 'Yes' : 'No'}</p>
          <p>Current User: {currentUser ? 'Loaded' : 'Not Loaded'}</p>
          <p>User Email: {currentUser?.email || 'Not Available'}</p>
          <p>Report Types Selected: {formData.report_types.length}</p>
          <p>Button Should Be: {(sendingNow || userLoading || !currentUser?.email || formData.report_types.length === 0) ? 'Disabled' : 'Enabled'}</p>
        </div>
      )}
    </div>
  );
}
