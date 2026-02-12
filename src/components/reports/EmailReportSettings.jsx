import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { roleTabSettingsOptions } from '@/query/options';
import { getDefaultEmailReportTypes } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { Mail, Send, Clock, CheckCircle, Loader2, FileDown, Info, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Chart } from 'chart.js/auto';
import { toast } from '@/lib/toast';

export default function EmailReportSettings({ reportData, onSetDateRange, isReportDataUpdating = false }) {
  const queryClient = useQueryClient();
  const { user: currentUser, userProfile, isLoading: userLoading } = useAuth();
  const [userError, setUserError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pdfHtml, setPdfHtml] = useState('');
  const pdfContainerRef = useRef(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);

  const userEmail = currentUser?.email || '';

  // Fetch user's email report preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['emailReportPreferences', userEmail],
    queryFn: async () => {
      if (!userEmail) return null;

      try {
        const { data: result } = await supabaseClient.tables.emailReportPreferences
          .select('*')
          .eq('user_email', userEmail);

        if (result && result.length > 0) {
          return result[0];
        }

        return {
          user_email: userEmail,
          enabled: false,
          frequency: 'weekly',
          report_types: [],
          include_charts: true,
          scheduled_time: '09:00',
          scheduled_day_of_week: 1,
          scheduled_day_of_month: 1
        };
      } catch (error) {
        console.error('Error fetching preferences:', error);
        return null;
      }
    },
    enabled: !!userEmail
  });

  // Form state
  const [formData, setFormData] = useState({
    report_types: [],
    include_charts: true,
    duration_type: 'months',
    duration_count: 1,
    selectedReportSites: [],
    selectedReportVehicles: [],
  });

  // All report types (filtered by role's allowed types)
  const ALL_REPORT_TYPES = [
    { id: 'compliance', label: 'Compliance Summary', icon: '📊', description: 'Vehicle compliance rates and wash tracking' },
    { id: 'costs', label: 'Cost Analysis', icon: '💰', description: 'Cost and financial trends' }
  ];

  const { data: roleTabSettings = {} } = useQuery(roleTabSettingsOptions());
  const allowedEmailReportTypeIds = useMemo(() => {
    const role = userProfile?.role;
    if (!role) return ['compliance', 'costs'];
    const stored = roleTabSettings[role];
    if (stored?.visible_email_report_types !== undefined && stored?.visible_email_report_types !== null) {
      return stored.visible_email_report_types;
    }
    return getDefaultEmailReportTypes(userProfile);
  }, [userProfile, roleTabSettings]);

  const reportTypes = useMemo(() =>
    ALL_REPORT_TYPES.filter(r => allowedEmailReportTypeIds.includes(r.id)),
    [allowedEmailReportTypeIds]
  );

  // Sites and vehicles for report filter (from dashboard's filtered vehicles)
  const reportSitesOptions = useMemo(() => {
    const vehicles = reportData?.filteredVehicles ?? [];
    const bySite = new Map();
    vehicles.forEach(v => {
      const id = v.site_id ?? v.site_name;
      const name = v.site_name || '—';
      if (id != null && id !== '' && !bySite.has(String(id))) bySite.set(String(id), { id: String(id), name });
    });
    return Array.from(bySite.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [reportData?.filteredVehicles]);

  const reportVehiclesOptions = useMemo(() => {
    const vehicles = reportData?.filteredVehicles ?? [];
    return vehicles.map(v => ({
      id: v.id ?? v.rfid,
      name: v.name || v.rfid || '—',
      rfid: v.rfid,
      site_name: v.site_name,
    })).filter(v => v.id != null && v.id !== '');
  }, [reportData?.filteredVehicles]);

  // Vehicles to include in report (after applying site/vehicle filters)
  const reportVehicles = useMemo(() => {
    let list = reportData?.filteredVehicles ?? [];
    if (formData.selectedReportSites.length > 0) {
      const siteIds = new Set(formData.selectedReportSites);
      list = list.filter(v => {
        const sid = v.site_id ?? v.site_name;
        return sid != null && siteIds.has(String(sid));
      });
    }
    if (formData.selectedReportVehicles.length > 0) {
      const vehicleIds = new Set(formData.selectedReportVehicles);
      list = list.filter(v => {
        const vid = v.id ?? v.rfid;
        return vid != null && vehicleIds.has(String(vid));
      });
    }
    return list;
  }, [reportData?.filteredVehicles, formData.selectedReportSites, formData.selectedReportVehicles]);

  // Update form when preferences load (filter report_types to allowed for this role)
  useEffect(() => {
    if (preferences) {
      const prefsTypes = preferences.report_types || [];
      const filtered = prefsTypes.filter(id => allowedEmailReportTypeIds.includes(id));
      setFormData(prev => ({
        ...prev,
        report_types: filtered,
        include_charts: preferences.include_charts !== false
      }));
    }
  }, [preferences, allowedEmailReportTypeIds]);

  // Compute date range from duration and apply to dashboard filters
  const getDateRangeFromDuration = (type, count) => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    let start;

    if (type === 'today') {
      start = end;
    } else if (type === 'days') {
      const d = new Date(today);
      d.setDate(d.getDate() - Math.max(1, count || 1));
      start = d.toISOString().slice(0, 10);
    } else if (type === 'weeks') {
      const d = new Date(today);
      d.setDate(d.getDate() - Math.max(1, count || 1) * 7);
      start = d.toISOString().slice(0, 10);
    } else {
      // months
      const d = new Date(today);
      d.setMonth(d.getMonth() - Math.max(1, count || 1));
      start = d.toISOString().slice(0, 10);
    }
    return { start, end };
  };

  const applyDurationToFilters = (type, count) => {
    if (onSetDateRange) {
      const range = getDateRangeFromDuration(type, count);
      onSetDateRange(range);
    }
  };

  // Load email notifications setting
  useEffect(() => {
    const loadEmailNotifications = async () => {
      if (!currentUser?.id) return;
      
      try {
        const { data } = await supabase
          .from('notification_preferences')
          .select('email_notifications_enabled')
          .eq('user_id', currentUser.id)
          .single();
        
        if (data) {
          setEmailNotificationsEnabled(data.email_notifications_enabled ?? true);
        }
      } catch (error) {
        console.error('Error loading email notifications:', error);
      }
    };

    loadEmailNotifications();
  }, [currentUser]);

  // Save email notifications setting
  const saveEmailNotifications = async (enabled) => {
    if (!currentUser?.id) return;

    try {
      await supabase
        .from('notification_preferences')
        .upsert({
          user_id: currentUser.id,
          user_email: currentUser.email,
          email_notifications_enabled: enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_email'
        });

      toast.success('Settings Updated', { description: `Email notifications ${enabled ? 'enabled' : 'disabled'} successfully.` });
    } catch (error) {
      console.error('Error saving email notifications:', error);
      toast.error('Failed to update email notifications. Please try again.', { description: 'Error' });
    }
  };

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

  // Save preferences mutation (report types and chart option)
  const savePreferences = async () => {
    if (!currentUser?.email) return;

    setSaving(true);
    try {
      const data = {
        user_email: userEmail,
        enabled: false,
        frequency: 'weekly',
        report_types: formData.report_types,
        include_charts: formData.include_charts,
        scheduled_time: '09:00',
        scheduled_day_of_week: 1,
        scheduled_day_of_month: 1,
        last_sent: preferences?.last_sent || null,
        next_scheduled: null
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

      queryClient.invalidateQueries(['emailReportPreferences', userEmail]);
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
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

    if (!userEmail) {
      alert('User email not found. Please refresh the page and try again.');
      return;
    }

    const effectiveReportTypes = formData.report_types.filter(id => allowedEmailReportTypeIds.includes(id));
    if (effectiveReportTypes.length === 0) {
      console.warn('[handleSendNow] No report types selected or allowed for role');
      alert('Please select at least one report type to send');
      return;
    }

    setSendingNow(true);
    try {
      console.log('[handleSendNow] Sending email report with params:', {
        userEmail,
        reportTypes: effectiveReportTypes,
        includeCharts: formData.include_charts
      });

      // Build report data with site/vehicle filters applied
      let dataToSend = reportData;
      if (reportData && (formData.selectedReportSites.length > 0 || formData.selectedReportVehicles.length > 0)) {
        const vehicles = reportVehicles;
        const targetDefault = 12;
        const compliantCount = vehicles.filter(v => (v.washes_completed ?? 0) >= (v.target ?? targetDefault)).length;
        const totalWashes = vehicles.reduce((sum, v) => sum + (v?.washes_completed || 0), 0);
        const activeDriversCount = vehicles.filter(v => v?.washes_completed > 0).length;
        dataToSend = {
          ...reportData,
          filteredVehicles: vehicles,
          stats: {
            ...reportData.stats,
            totalVehicles: vehicles.length,
            complianceRate: vehicles.length > 0 ? Math.round((compliantCount / vehicles.length) * 100) : 0,
            monthlyWashes: totalWashes,
            activeDrivers: activeDriversCount,
            complianceLikelihood: vehicles.length > 0 ? (() => {
              const criticalCount = vehicles.filter(v => (v.washes_completed ?? 0) === 0).length;
              const atRiskCount = vehicles.length - compliantCount - criticalCount;
              return {
                onTrackPct: Math.round((compliantCount / vehicles.length) * 100),
                atRiskPct: Math.round((atRiskCount / vehicles.length) * 100),
                criticalPct: Math.round((criticalCount / vehicles.length) * 100),
              };
            })() : { onTrackPct: 0, atRiskPct: 0, criticalPct: 0 },
          },
        };
      }

      await supabaseClient.reports.send({
        userEmail,
        reportTypes: effectiveReportTypes,
        includeCharts: formData.include_charts,
        reportData: dataToSend || null
      });

      setSuccessMessage(`Report sent successfully to ${userEmail}! Check your email inbox.`);
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
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('user not found')) {
        errorMessage = 'Your user account was not found in the system. Please contact support.';
      } else if (msg.includes('authorized recipients') || msg.includes('free accounts') || msg.includes('sandbox')) {
        errorMessage = 'Email service is in sandbox mode. Add your email address as an authorized recipient in the Mailgun dashboard (Sending > Authorized Recipients), or upgrade your Mailgun plan to send to any address.';
      } else if (error.message) {
        errorMessage += error.message;
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

  const generateChartImage = async (type, data, primaryColor, compact = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = compact ? 260 : 400;
    canvas.height = compact ? 130 : 250;

    const ctx = canvas.getContext('2d');

    let chartConfig;

    if (type === 'compliance') {
      const compliant = data.compliant || 0;
      const atRisk = data.atRisk || 0;
      const total = compliant + atRisk;
      chartConfig = {
        type: 'doughnut',
        data: {
          labels: ['Compliant', 'At Risk'],
          datasets: [{
            data: total > 0 ? [compliant, atRisk] : [1],
            backgroundColor: total > 0 ? [primaryColor || 'hsl(var(--primary))', '#ef4444'] : ['#e2e8f0'],
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 4
          }]
        },
        options: {
          responsive: false,
          cutout: compact ? '55%' : '60%',
          plugins: {
            title: { display: false },
            legend: {
              position: 'bottom',
              labels: {
                font: { size: compact ? 10 : 12 },
                padding: compact ? 8 : 16,
                usePointStyle: true
              }
            }
          }
        }
      };
    } else if (type === 'costs') {
      const monthly = data.monthly || 0;
      const total = data.total || 0;
      const hasBoth = monthly > 0 && total > 0;
      const labels = hasBoth ? ['Monthly Average', 'Total Period'] : ['Total Washes'];
      const values = hasBoth ? [monthly, total] : [total];
      chartConfig = {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: hasBoth ? 'Value' : 'Total Washes',
            data: values,
            backgroundColor: hasBoth
              ? [primaryColor || 'hsl(var(--primary))', '#10b981']
              : primaryColor || 'hsl(var(--primary))',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#e2e8f0' },
              ticks: { font: { size: 11 }, color: '#64748b' }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 }, color: '#334155' }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            title: { display: false }
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
    const requested = formData.report_types.length > 0 ? formData.report_types : allowedEmailReportTypeIds;
    const selectedReports = [...new Set(
      requested.filter(id => allowedEmailReportTypeIds.includes(id))
    )];
    const isComplianceOnly = selectedReports.length === 1 && selectedReports.includes('compliance');

    // Use client branding if provided, otherwise use default colors
    const primaryColor = clientBranding?.primary_color || 'hsl(var(--primary))';
    const secondaryColor = clientBranding?.secondary_color || '#9CCC65';
    const companyName = clientBranding?.company_name || 'ELORA';
    const logoUrl = clientBranding?.logo_url || null;

    const pad = isComplianceOnly ? { card: '10px', cardVal: '22px', cardLabel: '10px' } : { card: '20px', cardVal: '32px', cardLabel: '12px' };
    const section = (title, content, startNewPage = false) => `
      ${startNewPage ? '<div style="height: 140px;" aria-hidden="true"></div>' : ''}
      <div style="margin: ${startNewPage ? '0' : (isComplianceOnly ? '0' : '30px')} 0 ${isComplianceOnly ? '8px' : '20px'} 0; padding-top: ${startNewPage ? '24px' : '0'};">
        <h2 style="color: #0f172a; font-size: ${isComplianceOnly ? '18px' : '24px'}; font-weight: 700; margin: 0 0 ${isComplianceOnly ? '6px' : '12px'} 0; font-family: Arial, sans-serif;">
          ${title}
        </h2>
        <div style="height: 2px; width: 40px; background: ${primaryColor}; margin-bottom: ${isComplianceOnly ? '10px' : '20px'};"></div>
      </div>
      ${content}
    `;

    const metricCard = (label, value, subtitle, color = primaryColor) => `
      <div style="background: white; border-radius: 6px; padding: ${pad.card}; margin-bottom: ${isComplianceOnly ? '8px' : '15px'}; border-left: 3px solid ${color}; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);">
        <div style="color: #334155; font-size: ${pad.cardLabel}px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif;">${label}</div>
        <div style="color: #0f172a; font-size: ${pad.cardVal}px; font-weight: 700; margin-bottom: 2px; font-family: Arial, sans-serif;">${value}</div>
        <div style="color: #64748b; font-size: ${isComplianceOnly ? '11px' : '13px'}; font-family: Arial, sans-serif;">${subtitle}</div>
      </div>
    `;

    const twoColumnMetrics = (leftCard, rightCard) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${isComplianceOnly ? '8px' : '20px'};">
        <tr>
          <td width="48%" style="vertical-align: top;">${leftCard}</td>
          <td width="4%"></td>
          <td width="48%" style="vertical-align: top;">${rightCard}</td>
        </tr>
      </table>
    `;

    let content = isComplianceOnly ? '' : `
      <p style="color: #64748b; font-size: 15px; line-height: 1.5; margin: 0 0 30px 0; font-family: Arial, sans-serif;">
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
            }, primaryColor, isComplianceOnly);
            chartHtml = `
              <div style="text-align: center; margin: ${isComplianceOnly ? '8px' : '20px'} 0; page-break-inside: avoid;">
                <img src="${chartImage}" style="max-width: ${isComplianceOnly ? '260px' : '400px'}; height: auto;" alt="Compliance Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating compliance chart:', error);
          }
        }

        const likelihood = complianceData.complianceLikelihood;
        const likelihoodSection = likelihood ? `
          <div style="background: #f8fafc; border-radius: 6px; padding: ${isComplianceOnly ? '10px' : '16px'}; margin: ${isComplianceOnly ? '8px' : '16px'} 0; page-break-inside: avoid;">
            <div style="color: #334155; font-size: ${isComplianceOnly ? '10px' : '12px'}; font-weight: 600; margin-bottom: ${isComplianceOnly ? '6px' : '12px'}; text-transform: uppercase; letter-spacing: 1px;">Likelihood Status</div>
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="33%" style="vertical-align: top; padding-right: 8px;">
                <div style="background: #dcfce7; color: #166534; padding: ${isComplianceOnly ? '6px 8px' : '8px 12px'}; border-radius: 6px; font-weight: 600; font-size: ${isComplianceOnly ? '14px' : '18px'};">${likelihood.onTrackPct ?? 0}%</div>
                <div style="color: #64748b; font-size: 10px; margin-top: 2px;">On Track</div>
              </td>
              <td width="33%" style="vertical-align: top; padding: 0 4px;">
                <div style="background: #fef3c7; color: #92400e; padding: ${isComplianceOnly ? '6px 8px' : '8px 12px'}; border-radius: 6px; font-weight: 600; font-size: ${isComplianceOnly ? '14px' : '18px'};">${likelihood.atRiskPct ?? 0}%</div>
                <div style="color: #64748b; font-size: 10px; margin-top: 2px;">At Risk</div>
              </td>
              <td width="33%" style="vertical-align: top; padding-left: 8px;">
                <div style="background: #fee2e2; color: #991b1b; padding: ${isComplianceOnly ? '6px 8px' : '8px 12px'}; border-radius: 6px; font-weight: 600; font-size: ${isComplianceOnly ? '14px' : '18px'};">${likelihood.criticalPct ?? 0}%</div>
                <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Critical</div>
              </td>
            </tr></table>
          </div>
        ` : '';

        content += section('Compliance Overview',
          twoColumnMetrics(
            metricCard('COMPLIANCE RATE', `${complianceData.averageCompliance || 0}%`, '% of vehicles meeting target', primaryColor),
            metricCard('TOTAL VEHICLES', `${complianceData.totalVehicles || 0}`, 'In your fleet', secondaryColor)
          ) +
          twoColumnMetrics(
            metricCard('COMPLIANT', `${complianceData.compliantVehicles || 0}`, 'Meeting target', primaryColor),
            metricCard('AT RISK', `${complianceData.atRiskVehicles || 0}`, 'Below target', '#ef4444')
          ) +
          (likelihoodSection || '') +
          chartHtml
        );
      } else {
        content += section('Compliance Overview',
          twoColumnMetrics(
            metricCard('AVERAGE COMPLIANCE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL VEHICLES', '—', 'Awaiting live data', secondaryColor)
          ) + `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: ${isComplianceOnly ? '12px' : '20px'}; margin: ${isComplianceOnly ? '8px' : '20px'} 0;">
            <h4 style="color: #92400e; font-size: ${isComplianceOnly ? '13px' : '15px'}; font-weight: 600; margin: 0 0 4px 0; font-family: Arial, sans-serif;">Data Pending</h4>
            <p style="color: #92400e; font-size: ${isComplianceOnly ? '11px' : '13px'}; margin: 0; line-height: 1.5; font-family: Arial, sans-serif;">Connect to live data sources to populate compliance metrics.</p>
          </div>
        `);
      }
    }


    // Cost Analysis / Usage section
    if (selectedReports.includes('costs')) {
      const costData = reportData?.costs?.summary;

      if (costData && (costData.totalWashes != null || costData.totalCost != null)) {
        const totalWashes = costData.totalWashes ?? 0;
        const totalCost = costData.totalCost ?? 0;
        const hasCostData = totalCost > 0 || costData.monthlyAverage > 0;

        let chartHtml = '';
        if (includeCharts && (totalWashes > 0 || totalCost > 0)) {
          try {
            const chartImage = await generateChartImage('costs', {
              monthly: costData.monthlyAverage || 0,
              total: hasCostData ? totalCost : totalWashes
            }, primaryColor);
            chartHtml = `
              <div style="text-align: center; margin: 20px 0; page-break-inside: avoid;">
                <img src="${chartImage}" style="max-width: 400px; height: auto;" alt="Usage Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating cost chart:', error);
          }
        }

        const costContent = (hasCostData
          ? twoColumnMetrics(
              metricCard('MONTHLY AVERAGE', `$${costData.monthlyAverage || 0}`, 'Per month', primaryColor),
              metricCard('TOTAL THIS PERIOD', `$${totalCost}`, 'In selected period', '#10b981')
            )
          : twoColumnMetrics(
              metricCard('TOTAL WASHES', `${totalWashes.toLocaleString()}`, 'In selected period', primaryColor),
              metricCard('ACTIVE DRIVERS', `${costData.activeDrivers ?? 0}`, 'Vehicles with washes in period', '#10b981')
            )) + chartHtml;
        content += section('Cost & Usage', costContent, true);
      } else {
        content += section('Cost & Usage',
          twoColumnMetrics(
            metricCard('MONTHLY AVERAGE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL THIS PERIOD', '—', 'Awaiting live data', '#10b981')
          ),
          true
        );
      }
    }

    const headerPad = isComplianceOnly ? '16px 16px' : '40px 20px';
    const contentPad = isComplianceOnly ? '16px 24px' : '40px 35px';
    const footerPad = isComplianceOnly ? '12px 16px' : '25px 20px';
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fleet Compliance Report - ${companyName}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, sans-serif;">
        <div style="width: 700px; margin: ${isComplianceOnly ? '12px' : '30px'} auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: ${headerPad}; text-align: center; border-radius: 12px 12px 0 0;">
            ${logoUrl ? `
              <img src="${logoUrl}" alt="${companyName}" style="height: ${isComplianceOnly ? '36px' : '60px'}; object-fit: contain; margin-bottom: ${isComplianceOnly ? '8px' : '16px'}; display: inline-block;" />
            ` : ''}
            <h1 style="color: white; margin: 0; font-size: ${isComplianceOnly ? '24px' : '36px'}; font-weight: 700; font-family: Arial, sans-serif; letter-spacing: 2px;">
              ${companyName}
            </h1>
            <p style="color: rgba(255, 255, 255, 0.95); margin: ${isComplianceOnly ? '4px' : '12px'} 0 0 0; font-size: ${isComplianceOnly ? '12px' : '16px'}; font-family: Arial, sans-serif; letter-spacing: 0.5px;">
              Compliance Portal Report
            </p>
          </div>
          <div style="padding: ${contentPad};">
            ${content}
          </div>
          <div style="background: #f8fafc; padding: ${footerPad}; text-align: center; border-radius: 0 0 12px 12px; border-top: 2px solid #e2e8f0;">
            <p style="color: #64748b; font-size: ${isComplianceOnly ? '11px' : '13px'}; margin: 0 0 4px 0; font-family: Arial, sans-serif;">
              This is a ${reportData ? '' : 'preview '}PDF generated from your current settings.
            </p>
            <p style="color: #94a3b8; font-size: 10px; margin: 0; font-family: Arial, sans-serif;">
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
            primary_color: '',
            secondary_color: '#9CCC65'
          };
        }
      } catch (error) {
        console.error('[handleExportPdf] Error fetching branding:', error);
        branding = {
          company_name: 'ELORA',
          logo_url: null,
          primary_color: '',
          secondary_color: '#9CCC65'
        };
      }

      // Use reportData from Dashboard, applying site/vehicle filters (reportVehicles)
      let reportDataForPdf = null;
      const vehiclesForReport = reportVehicles;
      if (reportData?.stats && (vehiclesForReport.length > 0 || reportData?.filteredVehicles)) {
        const { stats, dateRange } = reportData;
        const vehicles = vehiclesForReport;
        const targetDefault = 12;
        const compliantCount = vehicles.filter(v => (v.washes_completed ?? 0) >= (v.target ?? targetDefault)).length;
        const criticalCount = vehicles.filter(v => (v.washes_completed ?? 0) === 0).length;
        const atRiskCount = vehicles.length - compliantCount - criticalCount;
        const totalWashes = vehicles.reduce((sum, v) => sum + (v?.washes_completed || 0), 0);
        const activeDriversCount = vehicles.filter(v => v?.washes_completed > 0).length;

        reportDataForPdf = {
          compliance: {
            summary: {
              averageCompliance: vehicles.length > 0 ? Math.round((compliantCount / vehicles.length) * 100) : 0,
              totalVehicles: vehicles.length,
              compliantVehicles: compliantCount,
              atRiskVehicles: atRiskCount + criticalCount,
              complianceLikelihood: vehicles.length > 0 ? {
                onTrackPct: Math.round((compliantCount / vehicles.length) * 100),
                atRiskPct: Math.round((atRiskCount / vehicles.length) * 100),
                criticalPct: Math.round((criticalCount / vehicles.length) * 100),
              } : { onTrackPct: 0, atRiskPct: 0, criticalPct: 0 }
            }
          },
          costs: {
            summary: {
              totalCost: 0,
              monthlyAverage: 0,
              totalWashes,
              activeDrivers: activeDriversCount,
              recordCount: 0
            }
          }
        };
      }

      // Generate enhanced HTML with charts
      console.log('[handleExportPdf] Generating enhanced HTML with report data:', reportDataForPdf ? 'available' : 'fallback');
      const reportHtml = await buildEnhancedReportHtml(reportDataForPdf, branding, true);

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

      setSuccessMessage('PDF exported successfully!');
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
      <div className="w-full p-6">
        <div className="bg-destructive/10 border-l-4 border-destructive p-6 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-destructive mb-2">Failed to Load User Information</h3>
              <p className="text-foreground mb-4">
                We couldn't load your user information. This might be due to a temporary connection issue.
              </p>
              <p className="text-sm text-destructive mb-4">Error: {userError}</p>
              <Button
                onClick={handleRetryUserLoad}
                variant="destructive"
                className="gap-2"
              >
                Try Again
              </Button>
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
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading email report settings...</p>
          {retryCount > 0 && (
            <p className="text-muted-foreground text-sm mt-2">Retrying... (attempt {retryCount + 1})</p>
          )}
        </div>
      </div>
    );
  }

  const durationOptions = [
    { id: 'today', label: 'Today' },
    { id: 'days', label: 'Last X days' },
    { id: 'weeks', label: 'Last X weeks' },
    { id: 'months', label: 'Last X months' },
  ];

  const handleDurationChange = (value) => {
    const count = value === 'days' ? 7 : value === 'weeks' ? 1 : value === 'months' ? 1 : null;
    setFormData(prev => ({
      ...prev,
      duration_type: value,
      duration_count: count ?? prev.duration_count,
    }));
    if (value !== 'today') {
      applyDurationToFilters(value, count ?? (value === 'days' ? 7 : 1));
    } else {
      applyDurationToFilters('today', null);
    }
  };

  const actionDisabled = sendingNow || exportingPdf || userLoading || isReportDataUpdating || !userEmail || formData.report_types.length === 0;

  return (
    <div className="w-full space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Email Report Settings</h1>
        <p className="text-sm text-muted-foreground">Request and configure email reports for your account.</p>
      </div>

      {/* Success message */}
      {successMessage && (
        <Alert className="border-primary/50 bg-primary/5">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Report duration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Report duration</CardTitle>
          </div>
          <CardDescription>
            Choose the date range for the report. The dashboard filters above will update to match.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={formData.duration_type}
            onValueChange={handleDurationChange}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {durationOptions.map((opt) => (
              <div key={opt.id} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.id} id={`duration-${opt.id}`} />
                <Label htmlFor={`duration-${opt.id}`} className="cursor-pointer text-sm font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {(formData.duration_type === 'days' || formData.duration_type === 'weeks' || formData.duration_type === 'months') && (
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="duration-count" className="text-sm text-muted-foreground shrink-0">
                {formData.duration_type === 'days' && 'Number of days'}
                {formData.duration_type === 'weeks' && 'Number of weeks'}
                {formData.duration_type === 'months' && 'Number of months'}
              </Label>
              <Input
                id="duration-count"
                type="number"
                min={1}
                max={formData.duration_type === 'days' ? 365 : formData.duration_type === 'weeks' ? 52 : 60}
                value={formData.duration_count}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setFormData(prev => ({ ...prev, duration_count: val }));
                  applyDurationToFilters(formData.duration_type, val);
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                {formData.duration_type === 'days' && `Last ${formData.duration_count} day${formData.duration_count > 1 ? 's' : ''}`}
                {formData.duration_type === 'weeks' && `Last ${formData.duration_count} week${formData.duration_count > 1 ? 's' : ''}`}
                {formData.duration_type === 'months' && `Last ${formData.duration_count} month${formData.duration_count > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter by Site & Vehicle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Filter report data</CardTitle>
          </div>
          <CardDescription>
            Optionally narrow the report to specific sites or vehicles. Leave empty to include all data from the filters above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filter by Site</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {formData.selectedReportSites.length === 0
                      ? 'All sites'
                      : formData.selectedReportSites.length === 1
                        ? (reportSitesOptions.find(s => s.id === formData.selectedReportSites[0])?.name ?? '1 site')
                        : `${formData.selectedReportSites.length} sites`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <div className="max-h-[240px] overflow-y-auto p-2">
                    {reportSitesOptions.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No sites available</p>
                    ) : (
                      reportSitesOptions.map((site) => (
                        <label
                          key={site.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={formData.selectedReportSites.includes(site.id)}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                selectedReportSites: checked
                                  ? [...prev.selectedReportSites, site.id]
                                  : prev.selectedReportSites.filter(id => id !== site.id),
                              }));
                            }}
                          />
                          {site.name}
                        </label>
                      ))
                    )}
                  </div>
                  {formData.selectedReportSites.length > 0 && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setFormData(prev => ({ ...prev, selectedReportSites: [] }))}
                      >
                        Clear selection
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filter by Vehicle</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {formData.selectedReportVehicles.length === 0
                      ? 'All vehicles'
                      : formData.selectedReportVehicles.length === 1
                        ? (reportVehiclesOptions.find(v => String(v.id) === formData.selectedReportVehicles[0])?.name ?? formData.selectedReportVehicles[0])
                        : `${formData.selectedReportVehicles.length} vehicles`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <div className="max-h-[240px] overflow-y-auto p-2">
                    {reportVehiclesOptions.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No vehicles available</p>
                    ) : (
                      reportVehiclesOptions.map((v) => (
                        <label
                          key={v.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={formData.selectedReportVehicles.includes(String(v.id))}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                selectedReportVehicles: checked
                                  ? [...prev.selectedReportVehicles, String(v.id)]
                                  : prev.selectedReportVehicles.filter(id => id !== String(v.id)),
                              }));
                            }}
                          />
                          <span className="truncate">{v.name}{v.site_name ? ` · ${v.site_name}` : ''}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {formData.selectedReportVehicles.length > 0 && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setFormData(prev => ({ ...prev, selectedReportVehicles: [] }))}
                      >
                        Clear selection
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {reportVehicles.length > 0 && (formData.selectedReportSites.length > 0 || formData.selectedReportVehicles.length > 0) && (
            <p className="text-xs text-muted-foreground">
              Report will include {reportVehicles.length} vehicle{reportVehicles.length !== 1 ? 's' : ''}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Report types */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Reports to include</CardTitle>
            <CardDescription>Select which sections appear in the email and PDF report.</CardDescription>
          </div>
          {reportTypes.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleAllReportsToggle}>
              {reportTypes.every((r) => formData.report_types.includes(r.id)) ? 'Deselect all' : 'Select all'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {reportTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No report types are available for your role. Contact your administrator to enable report types.
            </p>
          ) : (
            <div className="grid gap-3">
              {reportTypes.map((report) => (
                <div
                  key={report.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleReportTypeToggle(report.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleReportTypeToggle(report.id);
                    }
                  }}
                  className="flex items-start space-x-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 cursor-pointer select-none"
                >
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0 pt-0.5">
                    <Checkbox
                      id={`report-${report.id}`}
                      checked={formData.report_types.includes(report.id)}
                      onCheckedChange={() => handleReportTypeToggle(report.id)}
                    />
                  </div>
                  <div className="grid gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium leading-none">
                      <span className="text-base" aria-hidden>{report.icon}</span>
                      {report.label}
                    </div>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data updating notice */}
      {isReportDataUpdating && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-500" />
          <AlertDescription>
            <span className="font-medium text-foreground">Data is updating.</span> Wait for the report data above to finish loading before sending or exporting.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="flex-1 gap-2"
              onClick={handleSendNow}
              disabled={actionDisabled}
              title={
                isReportDataUpdating ? 'Please wait for data to finish updating' :
                userLoading ? 'Loading user information...' :
                !userEmail ? 'User email not available' :
                formData.report_types.length === 0 ? 'Please select at least one report type' :
                'Send email report now'
              }
            >
              {sendingNow ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : userLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : isReportDataUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wait for data...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Email me now
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleExportPdf}
              disabled={actionDisabled}
              title={
                isReportDataUpdating ? 'Please wait for data to finish updating' :
                userLoading ? 'Loading user information...' :
                !userEmail ? 'User email not available' :
                formData.report_types.length === 0 ? 'Please select at least one report type' :
                'Export report to PDF'
              }
            >
              {exportingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : isReportDataUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wait for data...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Export to PDF
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden PDF container */}
      <div
        ref={pdfContainerRef}
        style={{
          position: 'fixed',
          width: '820px',
          minHeight: pdfHtml
            ? (formData.report_types.length === 1 && formData.report_types.includes('compliance') ? '550px' : '1000px')
            : '0px',
          padding: '24px',
          background: '#f1f5f9',
          top: '-99999px',
          left: '0',
          pointerEvents: 'none',
          zIndex: -9999,
          overflow: 'visible',
          visibility: pdfHtml ? 'visible' : 'hidden',
        }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: pdfHtml }}
      />

      {/* Info */}
      <Alert className="border-border bg-muted/30">
        <Info className="h-4 w-4 text-muted-foreground" />
        <AlertDescription>
          The report uses the date range and filters (customer, site) from the dashboard above. You can further narrow by specific sites or vehicles in the filter section. Reports will be sent to{' '}
          <strong className="text-foreground">{userEmail || 'your email'}</strong>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
