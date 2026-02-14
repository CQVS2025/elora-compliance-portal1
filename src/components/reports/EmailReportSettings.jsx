


import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { roleTabSettingsOptions } from '@/query/options';
import { getDefaultEmailReportTypes } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { Mail, Send, Clock, CheckCircle, Loader2, FileDown, Info } from 'lucide-react';
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

  const generateChartImage = async (type, data, primaryColor, compact = false, atRiskColor = 'hsl(0, 84%, 60%)', secondaryBarColor = 'hsl(173, 58%, 39%)') => {
    const canvas = document.createElement('canvas');
    canvas.width = compact ? 280 : 420;
    canvas.height = compact ? 140 : 260;

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
            backgroundColor: total > 0 ? [primaryColor || 'hsl(217, 91%, 60%)', atRiskColor] : ['hsl(220, 13%, 91%)'],
            borderWidth: 4,
            borderColor: '#fff',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: false,
          cutout: compact ? '60%' : '65%',
          plugins: {
            title: { display: false },
            legend: {
              position: 'bottom',
              labels: {
                font: { size: compact ? 11 : 13, weight: '600', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
                padding: compact ? 10 : 18,
                usePointStyle: true,
                pointStyle: 'circle'
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
              ? [primaryColor || 'hsl(217, 91%, 60%)', secondaryBarColor]
              : primaryColor || 'hsl(217, 91%, 60%)',
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'hsl(220, 13%, 91%)', lineWidth: 1 },
              ticks: { font: { size: 11, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 9%, 46%)' }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 12, weight: '600', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 13%, 9%)' }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            title: { display: false }
          }
        }
      };
    } else if (type === 'complianceBySite') {
      const sites = data.sites || [];
      const labels = sites.map((s) => (s.siteName || '').length > 12 ? (s.siteName || '').substring(0, 11) + '…' : (s.siteName || ''));
      const values = sites.map((s) => s.compliancePct ?? 0);
      const colors = values.map((v) => v >= 75 ? (primaryColor || 'hsl(217, 91%, 60%)') : v >= 50 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 84%, 60%)');
      chartConfig = {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Compliance %',
            data: values,
            backgroundColor: colors,
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: false,
          scales: {
            x: {
              min: 0,
              max: 100,
              grid: { color: 'hsl(220, 13%, 91%)', lineWidth: 1 },
              ticks: { font: { size: 10, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 9%, 46%)' }
            },
            y: {
              grid: { display: false },
              ticks: { font: { size: 10, weight: '600', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 13%, 9%)', maxRotation: 0 }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            title: { display: false }
          }
        }
      };
      canvas.width = compact ? 320 : 480;
      canvas.height = Math.max(160, Math.min(320, (labels.length || 1) * 36));
    } else if (type === 'washesBySite') {
      const sites = data.sites || [];
      const labels = sites.map((s) => (s.siteName || '').length > 12 ? (s.siteName || '').substring(0, 11) + '…' : (s.siteName || ''));
      const values = sites.map((s) => s.totalWashes ?? 0);
      chartConfig = {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Washes',
            data: values,
            backgroundColor: primaryColor || 'hsl(217, 91%, 60%)',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: false,
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'hsl(220, 13%, 91%)', lineWidth: 1 },
              ticks: { font: { size: 10, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 9%, 46%)' }
            },
            y: {
              grid: { display: false },
              ticks: { font: { size: 10, weight: '600', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 13%, 9%)', maxRotation: 0 }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            title: { display: false }
          }
        }
      };
      canvas.width = compact ? 320 : 480;
      canvas.height = Math.max(160, Math.min(320, (labels.length || 1) * 36));
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

    // Enhanced color palette with modern design system
    const portal = {
      primary: 'hsl(217, 91%, 60%)',
      primaryLight: 'hsl(217, 91%, 95%)',
      primaryDark: 'hsl(217, 91%, 45%)',
      secondary: 'hsl(220, 14%, 96%)',
      background: 'hsl(0, 0%, 100%)',
      foreground: 'hsl(220, 13%, 9%)',
      muted: 'hsl(220, 14%, 96%)',
      mutedForeground: 'hsl(220, 9%, 46%)',
      border: 'hsl(220, 13%, 91%)',
      destructive: 'hsl(0, 84%, 60%)',
      destructiveLight: 'hsl(0, 84%, 97%)',
      success: 'hsl(142, 71%, 45%)',
      successLight: 'hsl(142, 71%, 96%)',
      warning: 'hsl(38, 92%, 50%)',
      warningLight: 'hsl(38, 92%, 95%)',
      chart2: 'hsl(173, 58%, 39%)',
      chart2Light: 'hsl(173, 58%, 95%)',
    };

    const primaryColor = clientBranding?.primary_color || portal.primary;
    const secondaryColor = clientBranding?.secondary_color || portal.secondary;
    const companyName = clientBranding?.company_name || 'ELORA';
    const logoUrl = clientBranding?.logo_url || null;
    const fg = portal.foreground;
    const mutedFg = portal.mutedForeground;
    const border = portal.border;
    const mutedBg = portal.muted;

    const formatDate = (d) => {
      if (!d) return '—';
      const date = typeof d === 'string' ? new Date(d) : d;
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const pad = isComplianceOnly ? { card: '12px 16px', cardVal: '24px', cardLabel: '10px' } : { card: '14px 20px', cardVal: '28px', cardLabel: '11px' };

    const section = (title, content, startNewPage = false) => `
      ${startNewPage ? '<div style="height: 90px;" aria-hidden="true"></div>' : ''}
      <div style="page-break-inside: avoid; break-inside: avoid;">
        <div style="margin: ${startNewPage ? '0' : (isComplianceOnly ? '24px' : '40px')} 0 ${isComplianceOnly ? '16px' : '24px'} 0; padding-top: ${startNewPage ? '66px' : '0'};">
          <div style="display: inline-block; position: relative; margin-bottom: ${isComplianceOnly ? '16px' : '20px'};">
            <h2 style="color: ${fg}; font-size: ${isComplianceOnly ? '20px' : '28px'}; font-weight: 700; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; letter-spacing: -0.5px;">
              ${title}
            </h2>
            <div style="height: 3px; width: 50px; background: linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor}80 100%); margin-top: 8px; border-radius: 2px;"></div>
          </div>
        </div>
        ${content}
      </div>
    `;

    const metricCard = (label, value, subtitle, color = primaryColor, icon = null) => `
      <div style="background: linear-gradient(135deg, ${portal.background} 0%, ${mutedBg} 100%); border-radius: 10px; padding: ${pad.card}; margin-bottom: ${isComplianceOnly ? '8px' : '10px'}; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04); position: relative; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${color}; border-radius: 10px 0 0 10px;"></div>
        <div style="color: ${mutedFg}; font-size: ${pad.cardLabel}px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${label}</div>
        <div style="color: ${fg}; font-size: ${pad.cardVal}px; font-weight: 700; margin-bottom: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px; line-height: 1;">${value}</div>
        <div style="color: ${mutedFg}; font-size: ${isComplianceOnly ? '11px' : '12px'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.3;">${subtitle}</div>
      </div>
    `;

    const twoColumnMetrics = (leftCard, rightCard) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${isComplianceOnly ? '10px' : '14px'};">
        <tr>
          <td width="48%" style="vertical-align: top;">${leftCard}</td>
          <td width="4%"></td>
          <td width="48%" style="vertical-align: top;">${rightCard}</td>
        </tr>
      </table>
    `;

    const dateRange = reportData?.dateRange;
    const reportPeriod = dateRange?.start && dateRange?.end
      ? `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`
      : null;
    const filterSummary = reportData?.filterSummary || '—';
    const totalVehicles = reportData?.totalVehicles ?? 0;
    const vehicleList = reportData?.vehicleList || [];

    const summaryBlock = `
      <div style="background: linear-gradient(135deg, ${portal.primaryLight} 0%, ${mutedBg} 100%); border-radius: 12px; padding: ${isComplianceOnly ? '16px 20px' : '24px 28px'}; margin-bottom: ${isComplianceOnly ? '20px' : '32px'}; border: 1px solid ${border}; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); page-break-inside: avoid; break-inside: avoid;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <div style="width: 4px; height: 20px; background: ${primaryColor}; border-radius: 2px; margin-right: 10px;"></div>
          <div style="color: ${fg}; font-size: ${isComplianceOnly ? '13px' : '14px'}; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Report Summary</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: ${isComplianceOnly ? '13px' : '15px'}; color: ${mutedFg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr><td style="padding: 6px 0; width: 150px; font-weight: 500;">Report period</td><td style="padding: 6px 0; font-weight: 700; color: ${fg};">${reportPeriod || '—'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 500;">Scope</td><td style="padding: 6px 0; font-weight: 700; color: ${fg};">${filterSummary}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 500;">Vehicles in scope</td><td style="padding: 6px 0; font-weight: 700; color: ${fg};">${totalVehicles.toLocaleString()}</td></tr>
        </table>
        ${!isComplianceOnly ? `<p style="color: ${mutedFg}; font-size: 13px; line-height: 1.6; margin: 16px 0 0 0; font-style: italic;">${reportData ? 'This report was generated from your current dashboard filters and fleet data.' : 'Live data could not be loaded; placeholder values are shown.'}</p>` : ''}
      </div>
    `;

    let content = (reportData && (reportPeriod || filterSummary || totalVehicles > 0)) ? summaryBlock : (isComplianceOnly ? '' : `
      <p style="color: ${mutedFg}; font-size: 15px; line-height: 1.6; margin: 0 0 32px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${reportData ? 'This report was generated from your current fleet data.' : 'Live data could not be loaded; placeholder values are shown.'}
      </p>
    `);

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
            }, primaryColor, isComplianceOnly, portal.destructive);
            chartHtml = `
              <div style="text-align: center; margin: ${isComplianceOnly ? '12px' : '24px'} 0; page-break-inside: avoid; break-inside: avoid; background: ${portal.background}; border-radius: 12px; padding: 20px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                <img src="${chartImage}" style="max-width: ${isComplianceOnly ? '280px' : '420px'}; height: auto;" alt="Compliance Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating compliance chart:', error);
          }
        }

        const likelihood = complianceData.complianceLikelihood;
        const likelihoodSection = likelihood ? `
          <div style="background: ${mutedBg}; border-radius: 10px; padding: ${isComplianceOnly ? '14px 16px' : '20px 24px'}; margin: ${isComplianceOnly ? '436px' : '184px'} 0 ${isComplianceOnly ? '12px' : '20px'} 0; page-break-inside: avoid; break-inside: avoid; border: 1px solid ${border};">
            <div style="color: ${fg}; font-size: ${isComplianceOnly ? '12px' : '13px'}; font-weight: 700; margin-top: ${isComplianceOnly ? '26px' : '34px'}; margin-bottom: ${isComplianceOnly ? '10px' : '16px'}; text-transform: uppercase; letter-spacing: 1.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Likelihood Status</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="page-break-inside: avoid; break-inside: avoid;"><tr>
              <td width="33%" style="vertical-align: top; padding-right: 10px;">
                <div style="background: ${portal.primaryLight}; color: ${primaryColor}; padding: ${isComplianceOnly ? '10px 12px' : '14px 16px'}; border-radius: 10px; font-weight: 700; font-size: ${isComplianceOnly ? '16px' : '22px'}; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">${likelihood.onTrackPct ?? 0}%</div>
                <div style="color: ${mutedFg}; font-size: ${isComplianceOnly ? '11px' : '12px'}; margin-top: 6px; text-align: center; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">On Track</div>
              </td>
              <td width="33%" style="vertical-align: top; padding: 0 5px;">
                <div style="background: ${portal.warningLight}; color: ${portal.warning}; padding: ${isComplianceOnly ? '10px 12px' : '14px 16px'}; border-radius: 10px; font-weight: 700; font-size: ${isComplianceOnly ? '16px' : '22px'}; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">${likelihood.atRiskPct ?? 0}%</div>
                <div style="color: ${mutedFg}; font-size: ${isComplianceOnly ? '11px' : '12px'}; margin-top: 6px; text-align: center; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">At Risk</div>
              </td>
              <td width="33%" style="vertical-align: top; padding-left: 10px;">
                <div style="background: ${portal.destructiveLight}; color: ${portal.destructive}; padding: ${isComplianceOnly ? '10px 12px' : '14px 16px'}; border-radius: 10px; font-weight: 700; font-size: ${isComplianceOnly ? '16px' : '22px'}; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">${likelihood.criticalPct ?? 0}%</div>
                <div style="color: ${mutedFg}; font-size: ${isComplianceOnly ? '11px' : '12px'}; margin-top: 6px; text-align: center; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Critical</div>
              </td>
            </tr></table>
          </div>
        ` : '';

        const costSummary = reportData?.costs?.summary;
        const totalWashes = costSummary?.totalWashes ?? 0;
        const activeDrivers = costSummary?.activeDrivers ?? 0;
        const criticalVehicles = complianceData.criticalVehicles ?? 0;
        const siteCount = reportData?.siteCount ?? 0;
        const avgWashesPerVehicle = reportData?.avgWashesPerVehicle ?? costSummary?.avgWashesPerVehicle ?? 0;

        const extraMetrics = twoColumnMetrics(
          metricCard('TOTAL WASHES', `${totalWashes.toLocaleString()}`, 'In report period', primaryColor),
          metricCard('ACTIVE DRIVERS', `${activeDrivers}`, 'Vehicles with at least one wash', portal.chart2)
        );
        const analysisMetrics = twoColumnMetrics(
          metricCard('CRITICAL VEHICLES', `${criticalVehicles}`, 'Zero washes in period', criticalVehicles > 0 ? portal.destructive : portal.success),
          metricCard('AVG WASHES / VEHICLE', `${Number(avgWashesPerVehicle).toFixed(1)}`, 'Fleet average', portal.chart2)
        );

        let complianceBySiteChartHtml = '';
        const siteSummary = reportData?.siteSummary || [];
        if (includeCharts && siteSummary.length > 0) {
          try {
            const bySiteImage = await generateChartImage('complianceBySite', { sites: siteSummary }, primaryColor, isComplianceOnly);
            complianceBySiteChartHtml = `
              <div style="margin-top: ${isComplianceOnly ? '16px' : '24px'}; page-break-inside: avoid; break-inside: avoid;">
                <div style="color: ${fg}; font-size: ${isComplianceOnly ? '12px' : '13px'}; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Compliance by site</div>
                <div style="text-align: center; background: ${portal.background}; border-radius: 12px; padding: 16px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                  <img src="${bySiteImage}" style="max-width: ${isComplianceOnly ? '320px' : '480px'}; height: auto;" alt="Compliance by site" />
                </div>
              </div>
            `;
          } catch (err) {
            console.error('Error generating compliance-by-site chart:', err);
          }
        }

        const topSite = siteSummary.length > 0 ? siteSummary[0] : null;
        const insightsBlock = (siteCount > 0 || topSite) ? `
          <div style="background: linear-gradient(135deg, ${portal.chart2Light || mutedBg} 0%, ${mutedBg} 100%); border-radius: 10px; padding: ${isComplianceOnly ? '14px 16px' : '18px 20px'}; margin: ${isComplianceOnly ? '12px' : '20px'} 0; border-left: 4px solid ${portal.chart2}; page-break-inside: avoid; break-inside: avoid;">
            <div style="color: ${fg}; font-size: ${isComplianceOnly ? '12px' : '13px'}; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Analysis</div>
            <p style="color: ${mutedFg}; font-size: ${isComplianceOnly ? '12px' : '13px'}; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${siteCount > 0 ? `Report covers <strong>${siteCount}</strong> site${siteCount !== 1 ? 's' : ''}. ` : ''}
              ${topSite ? `Top site by washes: <strong>${(topSite.siteName || '—').toString().replace(/</g, '&lt;')}</strong> (${topSite.compliancePct}% compliant, ${topSite.totalWashes} washes). ` : ''}
              ${criticalVehicles > 0 ? `<strong>${criticalVehicles} vehicle${criticalVehicles !== 1 ? 's' : ''}</strong> with zero washes need attention.` : 'No vehicles with zero washes in this period.'}
            </p>
          </div>
        ` : '';

        const complianceCardsBlock = `<div style="page-break-inside: avoid; break-inside: avoid;">${twoColumnMetrics(
            metricCard('COMPLIANCE RATE', `${complianceData.averageCompliance || 0}%`, '% of vehicles meeting target', primaryColor),
            metricCard('TOTAL VEHICLES', `${complianceData.totalVehicles || 0}`, 'In scope', portal.chart2)
          ) +
          twoColumnMetrics(
            metricCard('COMPLIANT', `${complianceData.compliantVehicles || 0}`, 'Meeting target', portal.success),
            metricCard('AT RISK', `${complianceData.atRiskVehicles || 0}`, 'Below target', portal.destructive)
          ) +
          analysisMetrics +
          extraMetrics}</div>` +
          (likelihoodSection || '') +
          chartHtml +
          complianceBySiteChartHtml +
          insightsBlock;
        content += section('Compliance Overview', complianceCardsBlock);
      } else {
        content += section('Compliance Overview',
          twoColumnMetrics(
            metricCard('AVERAGE COMPLIANCE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL VEHICLES', '—', 'Awaiting live data', portal.chart2)
          ) + `
          <div style="background: ${portal.warningLight}; border-left: 4px solid ${portal.warning}; border-radius: 10px; padding: ${isComplianceOnly ? '14px 16px' : '20px 24px'}; margin: ${isComplianceOnly ? '12px' : '20px'} 0; page-break-inside: avoid; break-inside: avoid;">
            <h4 style="color: ${portal.warning}; font-size: ${isComplianceOnly ? '14px' : '16px'}; font-weight: 700; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠ Data Pending</h4>
            <p style="color: ${portal.warning}; font-size: ${isComplianceOnly ? '12px' : '14px'}; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Connect to live data sources to populate compliance metrics.</p>
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
        const siteCount = costData.siteCount ?? reportData?.siteCount ?? 0;
        const avgWashesPerVehicle = costData.avgWashesPerVehicle ?? reportData?.avgWashesPerVehicle ?? 0;
        const siteSummary = reportData?.siteSummary || [];

        let chartHtml = '';
        if (includeCharts && (totalWashes > 0 || totalCost > 0)) {
          try {
            const chartImage = await generateChartImage('costs', {
              monthly: costData.monthlyAverage || 0,
              total: hasCostData ? totalCost : totalWashes
            }, primaryColor, false, undefined, portal.chart2);
            chartHtml = `
              <div style="text-align: center; margin: 24px 0; page-break-inside: avoid; break-inside: avoid; background: ${portal.background}; border-radius: 12px; padding: 20px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                <img src="${chartImage}" style="max-width: 420px; height: auto;" alt="Usage Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating cost chart:', error);
          }
        }

        let washesBySiteChartHtml = '';
        if (includeCharts && siteSummary.length > 0) {
          try {
            const bySiteImage = await generateChartImage('washesBySite', { sites: siteSummary }, primaryColor, false);
            const washesBySiteTopMargin = selectedReports.includes('compliance') ? '34px' : '92px';
            washesBySiteChartHtml = `
              <div style="margin-top: ${washesBySiteTopMargin}; page-break-inside: avoid; break-inside: avoid;">
                <div style="color: ${fg}; font-size: 13px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Washes by site</div>
                <div style="text-align: center; background: ${portal.background}; border-radius: 12px; padding: 16px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                  <img src="${bySiteImage}" style="max-width: 480px; height: auto;" alt="Washes by site" />
                </div>
              </div>
            `;
          } catch (err) {
            console.error('Error generating washes-by-site chart:', err);
          }
        }

        // const usageInsightsBlock = (siteCount > 0 || siteSummary.length > 0) ? `
        //   <div style="background: linear-gradient(135deg, ${portal.primaryLight} 0%, ${mutedBg} 100%); border-radius: 10px; padding: 18px 20px; margin: 40px 0 20px 0; border-left: 4px solid ${primaryColor}; page-break-inside: avoid; break-inside: avoid;">
        //     <div style="color: ${fg}; font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Usage analysis</div>
        //     <p style="color: ${mutedFg}; font-size: 13px; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        //       ${siteCount > 0 ? `Activity across <strong>${siteCount}</strong> site${siteCount !== 1 ? 's' : ''}. ` : ''}
        //       Average <strong>${Number(avgWashesPerVehicle).toFixed(1)}</strong> washes per vehicle in period.
        //       ${siteSummary.length > 0 && siteSummary[0] ? ` Highest volume: <strong>${(siteSummary[0].siteName || '—').toString().replace(/</g, '&lt;')}</strong> (${siteSummary[0].totalWashes} washes).` : ''}
        //     </p>
        //   </div>
        // ` : '';
        const usageInsightsBlock = ``;
        const usageExtraCards = twoColumnMetrics(
          metricCard('AVG WASHES / VEHICLE', `${Number(avgWashesPerVehicle).toFixed(1)}`, 'Fleet average in period', portal.chart2),
          metricCard('SITES WITH ACTIVITY', `${siteCount}`, 'Sites in scope', primaryColor)
        );

        const costBodyContent = (hasCostData
          ? twoColumnMetrics(
            metricCard('MONTHLY AVERAGE', `$${costData.monthlyAverage || 0}`, 'Per month', primaryColor),
            metricCard('TOTAL THIS PERIOD', `$${totalCost}`, 'In selected period', portal.chart2)
          )
          : twoColumnMetrics(
            metricCard('TOTAL WASHES', `${totalWashes.toLocaleString()}`, 'In selected period', primaryColor),
            metricCard('DRIVER SCANNING', `${costData.activeDrivers ?? 0}`, 'Vehicles with washes in period', portal.chart2)
          )) + usageExtraCards + chartHtml + washesBySiteChartHtml + usageInsightsBlock;
        const costContent = `<div style="page-break-inside: avoid; break-inside: avoid;">${costBodyContent}</div>`;
        const costSectionStartNewPage = selectedReports.includes('compliance');
        content += section('Cost & Usage', costContent, costSectionStartNewPage);
      } else {
        const costSectionStartNewPage = selectedReports.includes('compliance');
        content += section('Cost & Usage',
          twoColumnMetrics(
            metricCard('MONTHLY AVERAGE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL THIS PERIOD', '—', 'Awaiting live data', portal.chart2)
          ),
          costSectionStartNewPage
        );
      }
    }

    const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const headerPad = isComplianceOnly ? '20px 24px' : '36px 32px';
    const contentPad = isComplianceOnly ? '20px 28px' : '40px 44px';
    const footerPad = isComplianceOnly ? '16px 24px' : '24px 32px';
    const pageWidth = isComplianceOnly ? 720 : 820;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fleet Compliance Report - ${companyName}</title>
      </head>
      <body style="margin: 0; padding: 0; background: linear-gradient(135deg, ${border} 0%, #e2e8f0 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: ${fg};">
        <div style="width: ${pageWidth}px; margin: ${isComplianceOnly ? '16px' : '28px'} auto; background: ${portal.background}; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08); overflow: hidden;">
          <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%); padding: ${headerPad}; text-align: center; border-radius: 16px 16px 0 0; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; right: -10%; width: 300px; height: 300px; background: rgba(255, 255, 255, 0.08); border-radius: 50%; filter: blur(60px);"></div>
            <div style="position: absolute; bottom: -30%; left: -5%; width: 250px; height: 250px; background: rgba(255, 255, 255, 0.05); border-radius: 50%; filter: blur(50px);"></div>
            ${logoUrl ? `
              <img src="${logoUrl}" alt="${companyName}" style="height: ${isComplianceOnly ? '44px' : '60px'}; object-fit: contain; margin-bottom: ${isComplianceOnly ? '12px' : '16px'}; display: inline-block; position: relative; z-index: 1; filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));" />
            ` : ''}
            <h1 style="color: rgba(255, 255, 255, 0.98); margin: 0; font-size: ${isComplianceOnly ? '26px' : '36px'}; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px; position: relative; z-index: 1; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
              ${companyName}
            </h1>
            <p style="color: rgba(255, 255, 255, 0.95); margin: 8px 0 0 0; font-size: ${isComplianceOnly ? '14px' : '17px'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative; z-index: 1; font-weight: 500;">
              Fleet Compliance &amp; Usage Report
            </p>
            <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); padding: 8px 20px; border-radius: 20px; margin-top: 12px; position: relative; z-index: 1; border: 1px solid rgba(255, 255, 255, 0.2);">
              <p style="color: rgba(255, 255, 255, 0.95); margin: 0; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600;">
                📅 ${generatedDate}
              </p>
            </div>
          </div>
          <div style="padding: ${contentPad};">
            ${content}
          </div>
          <div style="background: linear-gradient(135deg, ${mutedBg} 0%, ${portal.background} 100%); padding: ${footerPad}; text-align: center; border-top: 1px solid ${border};">
            <p style="color: ${mutedFg}; font-size: ${isComplianceOnly ? '12px' : '13px'}; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 500;">
              ${reportData ? '✓ Report reflects current dashboard filters and live fleet data.' : '⚠ Preview — connect to live data for full report.'}
            </p>
            <p style="color: ${mutedFg}; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
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

        // Build filter summary from unique customer/site names in the list
        const customerSet = new Set(vehicles.map(v => v.customer_name).filter(Boolean));
        const siteSet = new Set(vehicles.map(v => v.site_name).filter(Boolean));
        const filterSummary =
          customerSet.size === 0 && siteSet.size === 0
            ? 'All (dashboard filters)'
            : [
              customerSet.size <= 3 ? Array.from(customerSet).join(', ') : `${customerSet.size} customers`,
              siteSet.size <= 3 ? Array.from(siteSet).join(', ') : `${siteSet.size} sites`,
            ].join(' · ');

        // Vehicle list for fleet table (first 50; include status)
        const vehicleList = vehicles.slice(0, 50).map((v) => {
          const washes = v.washes_completed ?? 0;
          const target = v.target ?? targetDefault;
          const status = washes >= target ? 'Compliant' : washes === 0 ? 'Critical' : 'At Risk';
          return {
            name: v.name || v.rfid || '—',
            customer_name: v.customer_name || '—',
            site_name: v.site_name || '—',
            washes_completed: washes,
            target,
            status,
          };
        });

        // Site-level summary for charts and analysis (top 10 by washes)
        const siteMap = new Map();
        vehicles.forEach((v) => {
          const siteName = v.site_name || 'Unknown';
          if (!siteMap.has(siteName)) {
            siteMap.set(siteName, { siteName, vehicles: 0, compliant: 0, totalWashes: 0 });
          }
          const entry = siteMap.get(siteName);
          entry.vehicles += 1;
          entry.totalWashes += v.washes_completed ?? 0;
          if ((v.washes_completed ?? 0) >= (v.target ?? targetDefault)) entry.compliant += 1;
        });
        const siteSummary = Array.from(siteMap.values())
          .map((s) => ({
            ...s,
            compliancePct: s.vehicles > 0 ? Math.round((s.compliant / s.vehicles) * 100) : 0,
          }))
          .sort((a, b) => b.totalWashes - a.totalWashes)
          .slice(0, 10);

        const avgWashesPerVehicle = vehicles.length > 0 ? (totalWashes / vehicles.length).toFixed(1) : 0;
        const siteCount = siteMap.size;

        reportDataForPdf = {
          dateRange: dateRange ? { start: dateRange.start, end: dateRange.end } : null,
          filterSummary,
          totalVehicles: vehicles.length,
          vehicleList,
          siteSummary,
          siteCount,
          avgWashesPerVehicle: Number(avgWashesPerVehicle),
          compliance: {
            summary: {
              averageCompliance: vehicles.length > 0 ? Math.round((compliantCount / vehicles.length) * 100) : 0,
              totalVehicles: vehicles.length,
              compliantVehicles: compliantCount,
              atRiskVehicles: atRiskCount + criticalCount,
              criticalVehicles: criticalCount,
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
              recordCount: 0,
              siteCount,
              avgWashesPerVehicle: Number(avgWashesPerVehicle),
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
      await new Promise((resolve) => setTimeout(resolve, 1200));
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
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f1f5f9',
        logging: false,
        width: 860,
        height: pdfContainerRef.current.scrollHeight || 1200,
        x: 0,
        y: 0
      });

      console.log('[handleExportPdf] Canvas captured:', canvas.width, 'x', canvas.height);

      // Convert canvas to PDF with better page handling
      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
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
      const filename = `${branding.company_name.replace(/\s+/g, '-')}-fleet-report-${new Date().toISOString().slice(0, 10)}.pdf`;
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

      {/* How it works */}
      <Alert className="border-border bg-muted/30">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <AlertDescription>
          <span className="font-medium text-foreground">How email reports work</span>
          <span className="block mt-1.5 text-muted-foreground">
            The report uses the <strong className="text-foreground">current dashboard filters</strong> at the top of this page (customer, site, and drivers) plus the date range. Set your filters above (e.g. select a customer, site, or drivers), then choose the report duration and which sections to include below. The exported PDF and email will show data that matches that filtered view.
          </span>
        </AlertDescription>
      </Alert>

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
                value={formData.duration_count === '' ? '' : formData.duration_count}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setFormData(prev => ({ ...prev, duration_count: '' }));
                    return;
                  }
                  const num = parseInt(raw, 10);
                  if (Number.isNaN(num)) return;
                  const max = formData.duration_type === 'days' ? 365 : formData.duration_type === 'weeks' ? 52 : 60;
                  const val = Math.max(1, Math.min(max, num));
                  setFormData(prev => ({ ...prev, duration_count: val }));
                  applyDurationToFilters(formData.duration_type, val);
                }}
                onBlur={() => {
                  if (formData.duration_count === '') {
                    setFormData(prev => ({ ...prev, duration_count: 1 }));
                    applyDurationToFilters(formData.duration_type, 1);
                  }
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                {formData.duration_type === 'days' && `Last ${Number(formData.duration_count) || 1} day${(Number(formData.duration_count) || 1) > 1 ? 's' : ''}`}
                {formData.duration_type === 'weeks' && `Last ${Number(formData.duration_count) || 1} week${(Number(formData.duration_count) || 1) > 1 ? 's' : ''}`}
                {formData.duration_type === 'months' && `Last ${Number(formData.duration_count) || 1} month${(Number(formData.duration_count) || 1) > 1 ? 's' : ''}`}
              </span>
            </div>
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
          width: '860px',
          minHeight: pdfHtml
            ? (formData.report_types.length === 1 && formData.report_types.includes('compliance') ? '600px' : '1100px')
            : '0px',
          padding: '28px',
          background: 'linear-gradient(135deg, hsl(220, 13%, 91%) 0%, #e2e8f0 100%)',
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
          The report uses the date range and current filters (customer, site, drivers) from the dashboard above. Reports will be sent to{' '}
          <strong className="text-foreground">{userEmail || 'your email'}</strong>.
        </AlertDescription>
      </Alert>
    </div>
  );
}