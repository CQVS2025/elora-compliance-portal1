


import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { roleTabSettingsOptions } from '@/query/options';
import { getDefaultEmailReportTypes, isAdmin } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { Mail, Send, Clock, CheckCircle, Loader2, FileDown, Info, Calendar, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Chart } from 'chart.js/auto';
import { toast } from '@/lib/toast';
import { exportVehicleComplianceReportAsBase64 } from '@/utils/excelExport';

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

  // Schedule automation state (admin/super_admin only)
  const [scheduleForm, setScheduleForm] = useState({
    automationEnabled: false,
    scheduledDay: 1,
    scheduledTime: '09:00',
    timezone: 'Australia/Sydney',
    recipientEmailsText: '', // one email per line; single source of truth for additional recipients
    reportTypes: [],
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const canManageSchedule = isAdmin(userProfile) || userProfile?.role === 'super_admin';

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());

  /** Parse text (one email per line or comma-separated) into sanitized array for API/DB. Excludes account holder. */
  const parseRecipientsFromText = (text, accountHolderEmail) => {
    if (!text || typeof text !== 'string') return [];
    const raw = text
      .split(/[\n,;]+/)
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean);
    const account = (accountHolderEmail || '').toLowerCase();
    return Array.from(
      new Set(
        raw.filter((e) => isValidEmail(e) && e !== account)
      )
    );
  };

  const AUSTRALIA_TIMEZONES = [
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
    { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)' },
  ];

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

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

  // Track which preference row we last inited from so we only overwrite when it actually changes
  // (e.g. different user). Stops refetches / effect re-runs from wiping the user's added recipients.
  const lastInitedPreferenceIdRef = useRef(null);

  // Update form when preferences load. Only overwrite schedule form when the preference row changed
  // (new id) so refetches and effect re-runs don't overwrite the user's unsaved recipient edits.
  useEffect(() => {
    if (preferences) {
      const prefsTypes = preferences.report_types || [];
      const filtered = prefsTypes.filter(id => allowedEmailReportTypeIds.includes(id));
      setFormData(prev => ({
        ...prev,
        report_types: filtered,
        include_charts: preferences.include_charts !== false
      }));
      const prefId = preferences.id ?? preferences.user_email;
      const alreadyInitedForThisRow = lastInitedPreferenceIdRef.current === prefId;
      if (!alreadyInitedForThisRow) {
        lastInitedPreferenceIdRef.current = prefId;
        const prefsReportTypes = preferences.report_types || [];
        const filteredScheduleTypes = prefsReportTypes.filter(id => allowedEmailReportTypeIds.includes(id));
        const prefsRecipients = Array.isArray(preferences.recipients) ? preferences.recipients : [];
        const recipientEmailsText = prefsRecipients.join('\n');
        setScheduleForm({
          automationEnabled: preferences.enabled === true,
          scheduledDay: preferences.scheduled_day_of_week ?? 1,
          scheduledTime: (preferences.scheduled_time && String(preferences.scheduled_time).slice(0, 5)) || '09:00',
          timezone: preferences.timezone || 'Australia/Sydney',
          recipientEmailsText,
          reportTypes: filteredScheduleTypes,
        });
      }
    }
  }, [preferences, allowedEmailReportTypeIds]);

  const saveSchedule = async () => {
    if (!userEmail || !currentUser?.id) return;
    setSavingSchedule(true);
    try {
      // Single source of truth: parse from textarea (one email per line)
      const recipientsListDeduped = scheduleForm.automationEnabled
        ? parseRecipientsFromText(scheduleForm.recipientEmailsText, userEmail)
        : [];

      const scheduleReportTypes = scheduleForm.automationEnabled
        ? (scheduleForm.reportTypes || []).filter(id => allowedEmailReportTypeIds.includes(id))
        : [];
      const payload = {
        user_email: userEmail,
        enabled: scheduleForm.automationEnabled,
        frequency: 'weekly',
        report_types: scheduleReportTypes,
        include_charts: formData.include_charts,
        scheduled_time: scheduleForm.scheduledTime,
        scheduled_day_of_week: scheduleForm.scheduledDay,
        scheduled_day_of_month: 1,
        timezone: scheduleForm.timezone,
        filters_json: reportData ? {
          selectedCustomer: reportData.selectedCustomer,
          selectedSite: reportData.selectedSite,
          selectedDriverIds: reportData.selectedDriverIds || [],
        } : {},
        recipients: recipientsListDeduped,
      };

      if (preferences?.id) {
        const { data, error } = await supabase
          .from('email_report_preferences')
          .update(payload)
          .eq('id', preferences.id)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const savedRecipients = Array.isArray(data.recipients) ? data.recipients : [];
          setScheduleForm(prev => ({
            ...prev,
            recipientEmailsText: savedRecipients.join('\n'),
            reportTypes: Array.isArray(data.report_types) ? [...data.report_types] : [],
          }));
        }
      } else {
        const { error } = await supabase
          .from('email_report_preferences')
          .insert([{ ...payload, user_id: currentUser.id, company_id: userProfile?.company_id }]);
        if (error) throw error;
        setScheduleForm(prev => ({
          ...prev,
          recipientEmailsText: recipientsListDeduped.join('\n'),
        }));
      }
      queryClient.invalidateQueries(['emailReportPreferences', userEmail]);
      setSuccessMessage(scheduleForm.automationEnabled ? 'Schedule saved. Weekly reports will be sent automatically.' : 'Automation disabled.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (e) {
      console.error('Save schedule error:', e);
      toast.error('Failed to save schedule. Please try again.');
    } finally {
      setSavingSchedule(false);
    }
  };

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
      // Build report data with site/vehicle filters applied (for email body and CSV)
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
      // Ensure dateRange is on payload for edge (CSV/email)
      if (reportData?.dateRange && dataToSend) dataToSend = { ...dataToSend, dateRange: reportData.dateRange };

      const branding = await resolveBrandingForReport();
      let pdfBase64 = null;
      let pdfFilename = null;
      const reportDataForPdf = buildReportDataForPdf(reportData, reportVehicles);
      if (reportDataForPdf) {
        try {
          const { pdf, filename } = await buildReportPdf(reportDataForPdf, branding);
          pdfBase64 = pdf.output('datauristring').split(',')[1];
          pdfFilename = filename;
        } catch (e) {
          console.warn('[handleSendNow] PDF generation failed, sending email without PDF:', e);
        }
      }
      let excelBase64 = null;
      let excelFilename = null;
      const excelResult = exportVehicleComplianceReportAsBase64(reportVehicles, branding.company_name);
      if (!excelResult.error) {
        excelBase64 = excelResult.base64;
        excelFilename = excelResult.filename;
      }

      const sendNowRecipients = parseRecipientsFromText(scheduleForm.recipientEmailsText, userEmail);

      await supabaseClient.reports.send({
        userEmail,
        reportTypes: effectiveReportTypes,
        includeCharts: formData.include_charts,
        reportData: dataToSend || null,
        branding: { company_name: branding.company_name, logo_url: branding.logo_url, primary_color: branding.primary_color, secondary_color: branding.secondary_color },
        pdfBase64: pdfBase64 || undefined,
        pdfFilename: pdfFilename || undefined,
        excelBase64: excelBase64 || undefined,
        excelFilename: excelFilename || undefined,
        recipients: sendNowRecipients,
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
      setPdfHtml('');
    }
  };

  const extractBodyHtml = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body?.innerHTML || html;
  };

  /** Resolve branding for PDF/email: selectedCustomer → companies, else user company, else client_branding by domain, else ELORA default */
  const resolveBrandingForReport = async () => {
    const selectedCustomer = reportData?.selectedCustomer;
    try {
      if (selectedCustomer && selectedCustomer !== 'all') {
        const { data: companyRows, error: companyError } = await supabaseClient.tables.companies
          .select('name, logo_url, primary_color, secondary_color')
          .eq('elora_customer_ref', selectedCustomer)
          .limit(1);
        if (!companyError && companyRows?.length > 0) {
          const c = companyRows[0];
          return { company_name: c.name || 'ELORA', logo_url: c.logo_url || null, primary_color: c.primary_color || '', secondary_color: c.secondary_color || '#9CCC65' };
        }
      }
      if (userProfile?.company_id) {
        const { data: companyRows, error: companyError } = await supabaseClient.tables.companies
          .select('name, logo_url, primary_color, secondary_color')
          .eq('id', userProfile.company_id)
          .limit(1);
        if (!companyError && companyRows?.length > 0) {
          const c = companyRows[0];
          return { company_name: c.name || 'ELORA', logo_url: c.logo_url || null, primary_color: c.primary_color || '', secondary_color: c.secondary_color || '#9CCC65' };
        }
      }
      const emailDomain = currentUser?.email?.split('@')[1];
      if (emailDomain) {
        const { data: brandingResults } = await supabaseClient.tables.clientBranding
          .select('*')
          .eq('client_email_domain', emailDomain);
        if (brandingResults?.length > 0) return brandingResults[0];
      }
    } catch (e) {
      console.warn('[resolveBrandingForReport] Error:', e);
    }
    return { company_name: 'ELORA', logo_url: null, primary_color: '', secondary_color: '#9CCC65' };
  };

  /** Build report payload for PDF/email from dashboard reportData and filtered reportVehicles */
  const buildReportDataForPdf = (reportData, vehiclesForReport) => {
    if (!reportData?.stats || (vehiclesForReport.length === 0 && !reportData?.filteredVehicles)) return null;
    const vehicles = vehiclesForReport;
    const targetDefault = 12;
    const compliantCount = vehicles.filter(v => (v.washes_completed ?? 0) >= (v.target ?? targetDefault)).length;
    const criticalCount = vehicles.filter(v => (v.washes_completed ?? 0) === 0).length;
    const atRiskCount = vehicles.length - compliantCount - criticalCount;
    const totalWashes = vehicles.reduce((sum, v) => sum + (v?.washes_completed || 0), 0);
    const activeDriversCount = vehicles.filter(v => v?.washes_completed > 0).length;
    const { dateRange } = reportData;
    const customerSet = new Set(vehicles.map(v => v.customer_name).filter(Boolean));
    const siteSet = new Set(vehicles.map(v => v.site_name).filter(Boolean));
    const filterSummary = customerSet.size === 0 && siteSet.size === 0 ? 'All (dashboard filters)' : [customerSet.size <= 3 ? Array.from(customerSet).join(', ') : `${customerSet.size} customers`, siteSet.size <= 3 ? Array.from(siteSet).join(', ') : `${siteSet.size} sites`].join(' · ');
    const vehicleList = vehicles.slice(0, 50).map((v) => {
      const washes = v.washes_completed ?? 0;
      const target = v.target ?? targetDefault;
      return { name: v.name || v.rfid || '—', customer_name: v.customer_name || '—', site_name: v.site_name || '—', washes_completed: washes, target, status: washes >= target ? 'Compliant' : washes === 0 ? 'Critical' : 'At Risk' };
    });
    const siteMap = new Map();
    vehicles.forEach((v) => {
      const siteName = v.site_name || 'Unknown';
      if (!siteMap.has(siteName)) siteMap.set(siteName, { siteName, vehicles: 0, compliant: 0, totalWashes: 0 });
      const entry = siteMap.get(siteName);
      entry.vehicles += 1;
      entry.totalWashes += v.washes_completed ?? 0;
      if ((v.washes_completed ?? 0) >= (v.target ?? targetDefault)) entry.compliant += 1;
    });
    const siteSummary = Array.from(siteMap.values()).map((s) => ({ ...s, compliancePct: s.vehicles > 0 ? Math.round((s.compliant / s.vehicles) * 100) : 0 })).sort((a, b) => b.totalWashes - a.totalWashes).slice(0, 10);
    const avgWashesPerVehicle = vehicles.length > 0 ? (totalWashes / vehicles.length).toFixed(1) : 0;
    const siteCount = siteMap.size;
    let dailyWashes = [];
    if (dateRange?.start && dateRange?.end && totalWashes > 0) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1);
      const sum = (days * (days + 1)) / 2;
      dailyWashes = Array.from({ length: days }, (_, i) => Math.round((totalWashes * (i + 1)) / sum));
    }
    return {
      dateRange: dateRange ? { start: dateRange.start, end: dateRange.end } : null,
      filterSummary,
      totalVehicles: vehicles.length,
      vehicleList,
      siteSummary,
      siteCount,
      avgWashesPerVehicle: Number(avgWashesPerVehicle),
      dailyWashes,
      compliance: {
        summary: {
          averageCompliance: vehicles.length > 0 ? Math.round((compliantCount / vehicles.length) * 100) : 0,
          totalVehicles: vehicles.length,
          compliantVehicles: compliantCount,
          atRiskVehicles: atRiskCount + criticalCount,
          criticalVehicles: criticalCount,
          complianceLikelihood: vehicles.length > 0 ? { onTrackPct: Math.round((compliantCount / vehicles.length) * 100), atRiskPct: Math.round((atRiskCount / vehicles.length) * 100), criticalPct: Math.round((criticalCount / vehicles.length) * 100) } : { onTrackPct: 0, atRiskPct: 0, criticalPct: 0 }
        }
      },
      costs: { summary: { totalCost: 0, monthlyAverage: 0, totalWashes, activeDrivers: activeDriversCount, recordCount: 0, siteCount, avgWashesPerVehicle: Number(avgWashesPerVehicle) } }
    };
  };

  /** Build PDF from report data and branding; returns { pdf, filename } for save or base64 */
  const buildReportPdf = async (reportDataForPdf, branding) => {
    const selectedReports = formData.report_types.length > 0 ? formData.report_types : allowedEmailReportTypeIds;
    const hasBothSections = selectedReports.includes('compliance') && selectedReports.includes('costs');

    const addCanvasToPdf = (pdf, canvas, startWithNewPage = false) => {
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentWidth = pageWidth - (margin * 2);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png', 0.95);
      let heightLeft = imgHeight;
      let position = margin;
      if (startWithNewPage) pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - margin * 2);
      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft) + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - margin * 2);
      }
    };

    const captureContainerToCanvas = async () => {
      if (!pdfContainerRef.current) throw new Error('PDF container not available. Please try again.');
      return await html2canvas(pdfContainerRef.current, {
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
    };

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });

    if (hasBothSections) {
      const reportHtmlCompliance = await buildEnhancedReportHtml(reportDataForPdf, branding, true, 'compliance');
      setPdfHtml(extractBodyHtml(reportHtmlCompliance));
      await new Promise((r) => setTimeout(r, 1200));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas1 = await captureContainerToCanvas();
      addCanvasToPdf(pdf, canvas1, false);
      const reportHtmlCost = await buildEnhancedReportHtml(reportDataForPdf, branding, true, 'costs');
      setPdfHtml(extractBodyHtml(reportHtmlCost));
      await new Promise((r) => setTimeout(r, 1200));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas2 = await captureContainerToCanvas();
      addCanvasToPdf(pdf, canvas2, true);
    } else {
      const reportHtml = await buildEnhancedReportHtml(reportDataForPdf, branding, true);
      setPdfHtml(extractBodyHtml(reportHtml));
      await new Promise((r) => setTimeout(r, 1200));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await captureContainerToCanvas();
      addCanvasToPdf(pdf, canvas, false);
    }

    const filename = `${branding.company_name.replace(/\s+/g, '-')}-fleet-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    return { pdf, filename };
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
    } else if (type === 'washTrend') {
      const dailyWashes = data.dailyWashes || [];
      const labels = dailyWashes.length > 0 ? dailyWashes.map((_, i) => String(i + 1)) : ['1'];
      const values = dailyWashes.length > 0 ? dailyWashes : [0];
      chartConfig = {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Washes',
            data: values,
            borderColor: primaryColor || 'hsl(142, 71%, 45%)',
            backgroundColor: (primaryColor || 'hsl(142, 71%, 45%)').replace(')', ', 0.15)').replace('hsl(', 'hsla('),
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: primaryColor || 'hsl(142, 71%, 45%)'
          }]
        },
        options: {
          responsive: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'hsl(220, 13%, 91%)', lineWidth: 1 },
              ticks: { font: { size: 10, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 9%, 46%)' }
            },
            x: {
              grid: { color: 'hsl(220, 13%, 91%)', lineWidth: 1 },
              ticks: { font: { size: 10, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, color: 'hsl(220, 9%, 46%)' }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            title: { display: false }
          }
        }
      };
      canvas.width = compact ? 280 : 380;
      canvas.height = compact ? 140 : 200;
    }

    const chart = new Chart(ctx, chartConfig);

    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));

    const imageUrl = canvas.toDataURL('image/png');

    // Clean up
    chart.destroy();

    return imageUrl;
  };

  const buildEnhancedReportHtml = async (reportData, clientBranding = null, includeCharts = true, sectionsToInclude = 'both') => {
    const requested = formData.report_types.length > 0 ? formData.report_types : allowedEmailReportTypeIds;
    const selectedReports = [...new Set(
      requested.filter(id => allowedEmailReportTypeIds.includes(id))
    )];
    const isComplianceOnly = selectedReports.length === 1 && selectedReports.includes('compliance');
    const includeComplianceSection = selectedReports.includes('compliance') && (sectionsToInclude === 'both' || sectionsToInclude === 'compliance');
    const includeCostSection = selectedReports.includes('costs') && (sectionsToInclude === 'both' || sectionsToInclude === 'costs');

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

    // Use same full layout/spacing for compliance-only as when both report types selected (so compliance section looks identical either way)
    const pad = { card: '14px 20px', cardVal: '28px', cardLabel: '11px' };

    const section = (title, content, startNewPage = false, extraTopMargin = 0) => {
      const top = startNewPage ? 0 : 40;
      const paddingTop = startNewPage ? 66 + extraTopMargin : 0;
      const marginTop = startNewPage ? 0 : top + extraTopMargin;
      const pageBreakBefore = startNewPage ? 'page-break-before: always; break-before: page;' : '';
      return `
      <div style="${pageBreakBefore} page-break-inside: avoid; break-inside: avoid;">
      ${startNewPage ? '<div style="height: 90px;" aria-hidden="true"></div>' : ''}
        <div style="margin: ${marginTop}px 0 24px 0; padding-top: ${paddingTop}px;">
          <div style="display: inline-block; position: relative; margin-bottom: 20px;">
            <h2 style="color: ${fg}; font-size: 28px; font-weight: 700; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; letter-spacing: -0.5px;">
              ${title}
            </h2>
            <div style="height: 3px; width: 50px; background: linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor}80 100%); margin-top: 8px; border-radius: 2px;"></div>
          </div>
        </div>
        ${content}
      </div>
    `;
    };

    const metricCard = (label, value, subtitle, color = primaryColor, icon = null) => `
      <div style="background: linear-gradient(135deg, ${portal.background} 0%, ${mutedBg} 100%); border-radius: 10px; padding: ${pad.card}; margin-bottom: 10px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04); position: relative; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${color}; border-radius: 10px 0 0 10px;"></div>
        <div style="color: ${mutedFg}; font-size: ${pad.cardLabel}px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${label}</div>
        <div style="color: ${fg}; font-size: ${pad.cardVal}px; font-weight: 700; margin-bottom: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px; line-height: 1;">${value}</div>
        <div style="color: ${mutedFg}; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.3;">${subtitle}</div>
      </div>
    `;

    const twoColumnMetrics = (leftCard, rightCard) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
        <tr>
          <td width="48%" style="vertical-align: top;">${leftCard}</td>
          <td width="4%"></td>
          <td width="48%" style="vertical-align: top;">${rightCard}</td>
        </tr>
      </table>
    `;

    const fourColumnMetrics = (a, b, c, d) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
        <tr>
          <td width="23%" style="vertical-align: top;">${a}</td>
          <td width="2%"></td>
          <td width="23%" style="vertical-align: top;">${b}</td>
          <td width="2%"></td>
          <td width="23%" style="vertical-align: top;">${c}</td>
          <td width="2%"></td>
          <td width="23%" style="vertical-align: top;">${d}</td>
        </tr>
      </table>
    `;

    const threeColumnMetrics = (a, b, c) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
        <tr>
          <td width="31%" style="vertical-align: top;">${a}</td>
          <td width="3%"></td>
          <td width="31%" style="vertical-align: top;">${b}</td>
          <td width="3%"></td>
          <td width="31%" style="vertical-align: top;">${c}</td>
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
      <div style="background: linear-gradient(135deg, ${portal.primaryLight} 0%, ${mutedBg} 100%); border-radius: 12px; padding: 24px 28px; margin-bottom: 32px; border: 1px solid ${border}; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); page-break-inside: avoid; break-inside: avoid;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <div style="width: 4px; height: 20px; background: ${primaryColor}; border-radius: 2px; margin-right: 10px;"></div>
          <div style="color: ${fg}; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Report Summary</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px; color: ${mutedFg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr><td style="padding: 6px 0; width: 150px; font-weight: 500;">Report period</td><td style="padding: 6px 0; font-weight: 700; color: ${fg};">${reportPeriod || '—'}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 500;">Scope</td><td style="padding: 6px 0; font-weight: 700; color: ${fg};">${filterSummary}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 500;">Vehicles in scope</td><td style="padding: 6px 0; font-weight: 700; color: ${fg};">${totalVehicles.toLocaleString()}</td></tr>
        </table>
        ${!isComplianceOnly ? `<p style="color: ${mutedFg}; font-size: 13px; line-height: 1.6; margin: 16px 0 0 0; font-style: italic;">${reportData ? 'This report was generated from your current dashboard filters and fleet data.' : 'Live data could not be loaded; placeholder values are shown.'}</p>` : ''}
      </div>
    `;

    const hasReportPeriodBar = reportPeriod && (reportData?.siteCount != null || reportData?.totalVehicles != null);
    const skipSummaryBlock = hasReportPeriodBar && selectedReports.includes('compliance');
    let content = (reportData && (reportPeriod || filterSummary || totalVehicles > 0) && !skipSummaryBlock) ? summaryBlock : (isComplianceOnly && !skipSummaryBlock ? '' : `
      <p style="color: ${mutedFg}; font-size: 15px; line-height: 1.6; margin: 0 0 32px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${reportData ? 'This report was generated from your current fleet data.' : 'Live data could not be loaded; placeholder values are shown.'}
      </p>
    `);
    if (sectionsToInclude === 'costs') content = '';

    // Compliance section
    if (includeComplianceSection) {
      const complianceData = reportData?.compliance?.summary;

      if (complianceData) {
        let chartHtml = '';
        let washTrendChartHtml = '';
        if (includeCharts) {
          try {
            const chartImage = await generateChartImage('compliance', {
              compliant: complianceData.compliantVehicles || 0,
              atRisk: complianceData.atRiskVehicles || 0
            }, primaryColor, false, portal.destructive);
            chartHtml = `
              <div style="text-align: center; page-break-inside: avoid; break-inside: avoid; background: ${portal.background}; border-radius: 12px; padding: 16px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                <div style="color: ${fg}; font-size: 11px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">Fleet Compliance</div>
                <img src="${chartImage}" style="max-width: 320px; height: auto;" alt="Compliance Chart" />
              </div>
            `;
          } catch (error) {
            console.error('Error generating compliance chart:', error);
          }
          const dailyWashes = reportData?.dailyWashes || [];
          if (dailyWashes.length > 0) {
            try {
              const trendImage = await generateChartImage('washTrend', { dailyWashes }, portal.success, false);
              washTrendChartHtml = `
                <div style="text-align: center; page-break-inside: avoid; break-inside: avoid; background: ${portal.background}; border-radius: 12px; padding: 16px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                  <div style="color: ${fg}; font-size: 11px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">Wash Activity Trend</div>
                  <img src="${trendImage}" style="max-width: 320px; height: auto;" alt="Wash trend" />
                </div>
              `;
            } catch (err) {
              console.error('Error generating wash trend chart:', err);
            }
          }
        }
        const twoColumnChartsRow = (chartHtml && washTrendChartHtml) ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; page-break-inside: avoid; break-inside: avoid;">
            <tr>
              <td width="48%" style="vertical-align: top;">${chartHtml}</td>
              <td width="4%"></td>
              <td width="48%" style="vertical-align: top;">${washTrendChartHtml}</td>
            </tr>
          </table>
        ` : (chartHtml ? `<div style="margin: 20px 0; page-break-inside: avoid;">${chartHtml}</div>` : '');

        const likelihood = complianceData.complianceLikelihood;
        const onTrackPct = likelihood?.onTrackPct ?? 0;
        const atRiskPct = likelihood?.atRiskPct ?? 0;
        const criticalPct = likelihood?.criticalPct ?? 0;
        const fleetHealthBar = (onTrackPct + atRiskPct + criticalPct > 0) ? `
          <div style="margin: 20px 0; page-break-inside: avoid; break-inside: avoid;">
            <div style="color: ${fg}; font-size: 12px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Fleet Health Distribution</div>
            <div style="display: flex; height: 24px; border-radius: 6px; overflow: hidden; background: ${border};">
              <div style="width: ${onTrackPct}%; background: ${portal.success}; min-width: ${onTrackPct > 0 ? '20px' : '0'};"></div>
              <div style="width: ${atRiskPct}%; background: ${portal.warning}; min-width: ${atRiskPct > 0 ? '20px' : '0'};"></div>
              <div style="width: ${criticalPct}%; background: ${portal.destructive}; min-width: ${criticalPct > 0 ? '20px' : '0'};"></div>
            </div>
            <div style="display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap;">
              <span style="font-size: 11px; color: ${mutedFg};"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${portal.success}; vertical-align: middle; margin-right: 4px;"></span> On Track (${complianceData.compliantVehicles || 0})</span>
              <span style="font-size: 11px; color: ${mutedFg};"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${portal.warning}; vertical-align: middle; margin-right: 4px;"></span> At Risk</span>
              <span style="font-size: 11px; color: ${mutedFg};"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${portal.destructive}; vertical-align: middle; margin-right: 4px;"></span> Critical (${complianceData.criticalVehicles || 0})</span>
            </div>
          </div>
        ` : '';

        const costSummary = reportData?.costs?.summary;
        const totalWashes = costSummary?.totalWashes ?? 0;
        const activeDrivers = costSummary?.activeDrivers ?? 0;
        const criticalVehicles = complianceData.criticalVehicles ?? 0;
        const atRiskVehicles = complianceData.atRiskVehicles ?? 0;
        const siteCount = reportData?.siteCount ?? 0;
        const avgWashesPerVehicle = reportData?.avgWashesPerVehicle ?? costSummary?.avgWashesPerVehicle ?? 0;
        const complianceTarget = 80;
        const showComplianceAlert = (atRiskVehicles + criticalVehicles) > 0;

        const complianceAlertBox = showComplianceAlert ? `
          <div style="background: ${portal.destructiveLight}; border: 1px solid ${portal.destructive}; border-radius: 10px; padding: 16px 20px; margin: 20px 0; page-break-inside: avoid; break-inside: avoid;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 18px; line-height: 1;">⚠</span>
              <div>
                <div style="color: ${fg}; font-size: 13px; font-weight: 700; margin-bottom: 4px;">Compliance Alert — ${companyName} Fleet</div>
                <p style="color: ${mutedFg}; font-size: 12px; margin: 0; line-height: 1.5;">${atRiskVehicles + criticalVehicles} vehicles below threshold. ${criticalVehicles} have zero washes. Fleet at ${complianceData.averageCompliance || 0}% vs ${complianceTarget}% target.</p>
              </div>
            </div>
          </div>
        ` : '';

        let complianceBySiteChartHtml = '';
        let washFrequencyBySiteHtml = '';
        const siteSummary = reportData?.siteSummary || [];
        if (includeCharts && siteSummary.length > 0) {
          try {
            const bySiteImage = await generateChartImage('complianceBySite', { sites: siteSummary }, primaryColor, false);
            complianceBySiteChartHtml = `
              <div style="margin-top: 24px; page-break-inside: avoid; break-inside: avoid;">
                <div style="color: ${fg}; font-size: 13px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Compliance by site</div>
                <div style="text-align: center; background: ${portal.background}; border-radius: 12px; padding: 16px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                  <img src="${bySiteImage}" style="max-width: 480px; height: auto;" alt="Compliance by site" />
                </div>
              </div>
            `;
          } catch (err) {
            console.error('Error generating compliance-by-site chart:', err);
          }
          try {
            const washFreqImage = await generateChartImage('washesBySite', { sites: siteSummary }, portal.success, false);
            washFrequencyBySiteHtml = `
              <div style="margin-top: 134px; page-break-inside: avoid; break-inside: avoid;">
                <div style="color: ${fg}; font-size: 13px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Wash Frequency By Site</div>
                <div style="text-align: center; background: ${portal.background}; border-radius: 12px; padding: 16px; border: 1px solid ${border}; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);">
                  <img src="${washFreqImage}" style="max-width: 480px; height: auto;" alt="Wash frequency by site" />
                </div>
              </div>
            `;
          } catch (err) {
            console.error('Error generating wash frequency by site chart:', err);
          }
        }

        const topSite = siteSummary.length > 0 ? siteSummary[0] : null;
        const insightsBlock = (siteCount > 0 || topSite) ? `
          <div style="background: linear-gradient(135deg, ${portal.chart2Light || mutedBg} 0%, ${mutedBg} 100%); border-radius: 10px; padding: 18px 20px; margin: 20px 0; border-left: 4px solid ${portal.chart2}; page-break-inside: avoid; break-inside: avoid;">
            <div style="color: ${fg}; font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Analysis</div>
            <p style="color: ${mutedFg}; font-size: 13px; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${siteCount > 0 ? `Report covers <strong>${siteCount}</strong> site${siteCount !== 1 ? 's' : ''}. ` : ''}
              ${topSite ? `Top site by washes: <strong>${(topSite.siteName || '—').toString().replace(/</g, '&lt;')}</strong> (${topSite.compliancePct}% compliant, ${topSite.totalWashes} washes). ` : ''}
              ${criticalVehicles > 0 ? `<strong>${criticalVehicles} vehicle${criticalVehicles !== 1 ? 's' : ''}</strong> with zero washes need attention.` : 'No vehicles with zero washes in this period.'}
            </p>
          </div>
        ` : '';

        const complianceCardsBlock = `<div style="page-break-inside: avoid; break-inside: avoid;">
          ${fourColumnMetrics(
            metricCard('COMPLIANCE RATE', `${complianceData.averageCompliance || 0}%`, `vs ${complianceTarget}% target`, (complianceData.averageCompliance || 0) >= complianceTarget ? portal.success : portal.destructive),
            metricCard('TOTAL VEHICLES', `${complianceData.totalVehicles || 0}`, 'In scope', portal.chart2),
            metricCard('TOTAL WASHES', `${totalWashes.toLocaleString()}`, 'In report period', primaryColor),
            metricCard('ACTIVE DRIVERS', `${activeDrivers}`, 'Active in period', portal.chart2)
          )}
          ${threeColumnMetrics(
            metricCard('COMPLIANT', `${complianceData.compliantVehicles || 0}`, 'Meeting target', portal.success),
            metricCard('AT RISK', `${complianceData.atRiskVehicles || 0}`, 'Below target', portal.destructive),
            metricCard('AVG WASHES/VEHICLE', `${Number(avgWashesPerVehicle).toFixed(1)}`, 'Fleet average', portal.chart2)
          )}
          ${fleetHealthBar}
          ${complianceAlertBox}
          ${twoColumnChartsRow}
          ${washFrequencyBySiteHtml}
          ${complianceBySiteChartHtml}
          ${insightsBlock}
        </div>`;
        content += section('Compliance Overview', complianceCardsBlock);
      } else {
        content += section('Compliance Overview',
          twoColumnMetrics(
            metricCard('AVERAGE COMPLIANCE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL VEHICLES', '—', 'Awaiting live data', portal.chart2)
          ) + `
          <div style="background: ${portal.warningLight}; border-left: 4px solid ${portal.warning}; border-radius: 10px; padding: 20px 24px; margin: 20px 0; page-break-inside: avoid; break-inside: avoid;">
            <h4 style="color: ${portal.warning}; font-size: 16px; font-weight: 700; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">⚠ Data Pending</h4>
            <p style="color: ${portal.warning}; font-size: 14px; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Connect to live data sources to populate compliance metrics.</p>
          </div>
        `);
      }
    }

    // Cost Analysis / Usage section
    if (includeCostSection) {
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
        const costContent = `<div style="margin-top: ${isComplianceOnly ? '16px' : '30px'};page-break-inside: avoid; break-inside: avoid;">${costBodyContent}</div>`;
        const costSectionStartNewPage = selectedReports.includes('compliance') && sectionsToInclude === 'both';
        content += section('Cost & Usage', costContent, costSectionStartNewPage, costSectionStartNewPage ? 145 : 0);
      } else {
        const costSectionStartNewPage = selectedReports.includes('compliance') && sectionsToInclude === 'both';
        content += section('Cost & Usage',
          twoColumnMetrics(
            metricCard('MONTHLY AVERAGE', '—', 'Awaiting live data', primaryColor),
            metricCard('TOTAL THIS PERIOD', '—', 'Awaiting live data', portal.chart2)
          ),
          costSectionStartNewPage,
          costSectionStartNewPage ? 145 : 0
        );
      }
    }

    const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const headerPad = '28px 32px';
    const contentPad = '40px 44px';
    const footerPad = '24px 32px';
    const pageWidth = 820;
    const reportPeriodFormatted = reportPeriod ? reportPeriod.toUpperCase().replace(/(\d+)/g, (m) => m).replace(/ – /g, ' – ') : '';
    const sitesVehiclesBar = (reportData?.siteCount != null && reportData?.totalVehicles != null)
      ? `${reportData.siteCount} SITES • ${reportData.totalVehicles} VEHICLES`
      : '';

    const headerBg = 'linear-gradient(160deg, #004E2B 0%, #003d22 50%, #002a17 100%)';
    const headerAccent = '#00DD39';
    const summaryBarBg = '#f0faf5';
    const summaryBarBorder = '#d1e8da';
    const summaryBarText = '#004E2B';

    // When only cost section (continuation page after compliance), omit header/summary/footer so we get just a page break + Cost & Usage content
    if (sectionsToInclude === 'costs') {
      return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fleet Compliance Report - ${companyName}</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: ${fg};">
        <div style="width: ${pageWidth}px; margin: 0 auto; background: ${portal.background}; min-height: 400px;">
          <div style="padding: ${contentPad};">
            ${content}
          </div>
        </div>
      </body>
      </html>
      `;
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fleet Compliance Report - ${companyName}</title>
      </head>
      <body style="margin: 0; padding: 0; background: linear-gradient(135deg, ${border} 0%, #e2e8f0 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: ${fg};">
        <div style="width: ${pageWidth}px; margin: 28px auto; background: ${portal.background}; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08); overflow: hidden;">
          <header style="background: ${headerBg}; padding: 0; border-radius: 16px 16px 0 0; position: relative;">
            <div style="padding: ${headerPad};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28%; vertical-align: middle; text-align: left;">
                    <div style="display: inline-flex; align-items: center; gap: 14px;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="" style="height: 36px; width: auto; max-width: 120px; object-fit: contain; filter: brightness(0) invert(1);" />` : ''}
                      <span style="color: rgba(255,255,255,0.98); font-size: 14px; font-weight: 600;">${companyName}</span>
                    </div>
                  </td>
                  <td style="width: 44%; vertical-align: middle; text-align: center;">
                    <h1 style="color: rgba(255, 255, 255, 0.98); margin: 0; font-size: 26px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px;">Fleet Compliance Report</h1>
                    <p style="color: rgba(255, 255, 255, 0.7); margin: 4px 0 0 0; font-size: 12px;">${companyName}</p>
                    <div style="display: inline-block; background: rgba(0, 221, 57, 0.15); border: 1px solid rgba(0, 221, 57, 0.25); color: ${headerAccent}; padding: 4px 14px; border-radius: 12px; font-size: 10px; font-weight: 600; margin-top: 10px; letter-spacing: 0.3px;">
                      ${generatedDate}
                    </div>
                  </td>
                  <td style="width: 28%; vertical-align: middle; text-align: right;">
                    <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 6px; opacity: 0.9; text-align: center;">
                      <img src="https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png" alt="" style="height: 32px; width: auto; object-fit: contain; display: block;" />
                      <span style="color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 600; letter-spacing: 0.3px;">Powered by Elora Solutions</span>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
            <div style="height: 3px; background: linear-gradient(90deg, ${headerAccent}, ${headerAccent} 50%, #7cc43e);"></div>
          </header>
          ${reportPeriodFormatted || sitesVehiclesBar ? `
          <div style="background: ${summaryBarBg}; padding: 10px 24px; border-bottom: 1px solid ${summaryBarBorder}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            ${reportPeriodFormatted ? `<span style="color: ${summaryBarText}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">REPORT PERIOD: ${reportPeriodFormatted}</span>` : ''}
            ${sitesVehiclesBar ? `<span style="color: ${summaryBarText}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${sitesVehiclesBar}</span>` : ''}
          </div>
          ` : ''}
          <div style="padding: ${contentPad};">
            ${content}
          </div>
          <footer style="background: linear-gradient(180deg, #f7f8fa, ${summaryBarBg}); padding: ${footerPad}; border-top: 1px solid ${summaryBarBorder}; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <p style="color: ${mutedFg}; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 500;">
              ${reportData ? 'Report reflects current dashboard filters. Confidential — ' + companyName + '.' : 'Preview — connect to live data for full report.'}
            </p>
            <div style="display: inline-flex; align-items: center; flex-wrap: nowrap; gap: 8px;">
              <img src="https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png" alt="" style="height: 22px; width: auto; object-fit: contain; flex-shrink: 0; display: inline-block; vertical-align: middle;" />
              <span style="color: ${mutedFg}; font-size: 11px; font-weight: 500; white-space: nowrap;">Powered by ELORA · © ${new Date().getFullYear()}</span>
            </div>
          </footer>
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
      const branding = await resolveBrandingForReport();
      const reportDataForPdf = buildReportDataForPdf(reportData, reportVehicles);
      if (!reportDataForPdf) {
        alert('No report data available. Set dashboard filters and ensure there is vehicle data.');
        return;
      }

      const { pdf, filename } = await buildReportPdf(reportDataForPdf, branding);
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

      {/* Email Schedule - admin/super_admin only */}
      {canManageSchedule && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Email Schedule</CardTitle>
            </div>
            <CardDescription>
              Enable automatic weekly email reports. Reports use last week&apos;s data and are sent on your chosen day and time (Australia timezone).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="automation-toggle" className="text-sm font-medium">Enable automatic weekly reports</Label>
                <p className="text-xs text-muted-foreground mt-0.5">When on, reports are sent automatically based on your schedule below.</p>
              </div>
              <Switch
                id="automation-toggle"
                checked={scheduleForm.automationEnabled}
                onCheckedChange={(v) => setScheduleForm(prev => ({ ...prev, automationEnabled: v }))}
              />
            </div>
            {scheduleForm.automationEnabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Day of week</Label>
                    <Select
                      value={String(scheduleForm.scheduledDay)}
                      onValueChange={(v) => setScheduleForm(prev => ({ ...prev, scheduledDay: parseInt(v, 10) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={scheduleForm.scheduledTime}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduledTime: e.target.value || '09:00' }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={scheduleForm.timezone}
                    onValueChange={(v) => setScheduleForm(prev => ({ ...prev, timezone: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUSTRALIA_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select your Australian timezone so reports are sent at the correct local time.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Additional recipients</Label>
                  <p className="text-xs text-muted-foreground">Add email addresses to also receive the weekly report. Separate with commas or new lines. You (the account holder) always receive it.</p>
                  <Textarea
                    placeholder="email1@example.com, email2@example.com"
                    className="min-h-[88px] font-mono text-sm"
                    value={scheduleForm.recipientEmailsText ?? ''}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, recipientEmailsText: e.target.value }))}
                    aria-label="Additional recipient emails, comma or newline separated"
                  />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{parseRecipientsFromText(scheduleForm.recipientEmailsText, userEmail).length}</span> valid recipient(s) will receive the report.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Report types to include</Label>
                  <p className="text-xs text-muted-foreground">Choose which sections appear in the weekly automated report.</p>
                  {reportTypes.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No report types available for your role.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {reportTypes.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`schedule-${report.id}`}
                            checked={(scheduleForm.reportTypes || []).includes(report.id)}
                            onCheckedChange={(checked) => {
                              setScheduleForm(prev => ({
                                ...prev,
                                reportTypes: checked
                                  ? [...(prev.reportTypes || []), report.id]
                                  : (prev.reportTypes || []).filter((id) => id !== report.id),
                              }));
                            }}
                          />
                          <Label htmlFor={`schedule-${report.id}`} className="text-sm font-normal cursor-pointer">
                            {report.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Filters use the dashboard selection above. The automated report will include data from the <strong>previous week</strong> (last 7 days).
                </p>
                <Button onClick={saveSchedule} disabled={savingSchedule} className="gap-2">
                  {savingSchedule && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingSchedule ? 'Saving...' : 'Save Schedule'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
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
            <span className="font-medium text-foreground">Data is Syncing.</span> Wait for the report data above to finish loading before sending or exporting.
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