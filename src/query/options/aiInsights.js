import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * AI Settings (default model: Sonnet vs Opus) - readable by all, writable by super_admin only.
 */
export const aiSettingsOptions = () =>
  queryOptions({
    queryKey: queryKeys.global.aiSettings(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('key, value, updated_at');
      if (error) throw error;
      const map = {};
      (data || []).forEach((row) => {
        map[row.key] = row.value;
      });
      return map;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

/**
 * AI Predictions for a company (optionally for a date range, customer, site).
 * For real-time risk monitoring, pass startDate=null and endDate=null to get all non-expired predictions.
 * @param {string} companyId - Company UUID
 * @param {string} startDate - Start date for filtering (YYYY-MM-DD, optional)
 * @param {string} endDate - End date for filtering (YYYY-MM-DD, optional)
 * @param {string} customerRef - Customer reference (optional)
 * @param {string} siteRef - Site reference (optional)
 */
export const aiPredictionsOptions = (companyId, startDate = null, endDate = null, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.predictions(companyId, startDate, endDate, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase
        .from('ai_predictions')
        .select('*')
        .order('risk_score', { ascending: false});
      if (companyId) q = q.eq('company_id', companyId);
      
      // If date range is provided, filter by date range
      // If both null, show all non-expired predictions (for real-time risk monitoring)
      if (startDate && endDate) {
        q = q.gte('prediction_date', startDate)
             .lte('prediction_date', endDate);
      } else if (startDate) {
        q = q.gte('prediction_date', startDate);
      } else if (endDate) {
        q = q.lte('prediction_date', endDate);
      } else {
        // Show predictions that haven't expired yet
        const now = new Date().toISOString();
        q = q.or(`expires_at.is.null,expires_at.gte.${now}`);
      }
      
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 0, // Always refetch when query key changes (date changes)
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Recommendations for a company (or all for super_admin when companyId is null).
 * @param {string} companyId - Company UUID
 * @param {string} customerRef - Customer reference (optional)
 * @param {string} siteRef - Site reference (optional)
 * @param {string} startDate - Start date for filtering (YYYY-MM-DD, optional)
 * @param {string} endDate - End date for filtering (YYYY-MM-DD, optional)
 */
export const aiRecommendationsOptions = (companyId, customerRef = null, siteRef = null, startDate = null, endDate = null) =>
  queryOptions({
    queryKey: queryKeys.ai.recommendations(companyId, customerRef, siteRef, startDate, endDate),
    queryFn: async () => {
      let q = supabase
        .from('ai_recommendations')
        .select('*')
        .order('created_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      
      // Apply date range filter on created_at if provided
      if (startDate && endDate) {
        q = q.gte('created_at', `${startDate}T00:00:00`)
             .lte('created_at', `${endDate}T23:59:59`);
      } else if (startDate) {
        q = q.gte('created_at', `${startDate}T00:00:00`);
      } else if (endDate) {
        q = q.lte('created_at', `${endDate}T23:59:59`);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 0, // Always refetch when query key changes (date range changes)
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Wash Windows (optimal wash time slots) for a company.
 * @param {string} companyId - Company UUID
 * @param {string} customerRef - Customer reference (optional)
 * @param {string} siteRef - Site reference (optional)
 * @param {string} startDate - Start date for filtering (YYYY-MM-DD, optional)
 * @param {string} endDate - End date for filtering (YYYY-MM-DD, optional)
 */
export const aiWashWindowsOptions = (companyId, customerRef = null, siteRef = null, startDate = null, endDate = null) =>
  queryOptions({
    queryKey: queryKeys.ai.washWindows(companyId, customerRef, siteRef, startDate, endDate),
    queryFn: async () => {
      let q = supabase
        .from('ai_wash_windows')
        .select('*')
        .order('window_start', { ascending: true });
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      
      // Apply date range filter on created_at if provided
      if (startDate && endDate) {
        q = q.gte('created_at', `${startDate}T00:00:00`)
             .lte('created_at', `${endDate}T23:59:59`);
      } else if (startDate) {
        q = q.gte('created_at', `${startDate}T00:00:00`);
      } else if (endDate) {
        q = q.lte('created_at', `${endDate}T23:59:59`);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 0, // Always refetch when query key changes (date range changes)
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Driver Patterns (behavioral insights per driver) for a company.
 * @param {string} companyId - Company UUID
 * @param {string} customerRef - Customer reference (optional)
 * @param {string} siteRef - Site reference (optional)
 * @param {string} startDate - Start date for filtering (YYYY-MM-DD, optional)
 * @param {string} endDate - End date for filtering (YYYY-MM-DD, optional)
 */
export const aiDriverPatternsOptions = (companyId, customerRef = null, siteRef = null, startDate = null, endDate = null) =>
  queryOptions({
    queryKey: queryKeys.ai.driverPatterns(companyId, customerRef, siteRef, startDate, endDate),
    queryFn: async () => {
      let q = supabase
        .from('ai_driver_patterns')
        .select('*')
        .order('detected_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      
      // Apply date range filter on detected_at if provided
      if (startDate && endDate) {
        q = q.gte('detected_at', `${startDate}T00:00:00`)
             .lte('detected_at', `${endDate}T23:59:59`);
      } else if (startDate) {
        q = q.gte('detected_at', `${startDate}T00:00:00`);
      } else if (endDate) {
        q = q.lte('detected_at', `${endDate}T23:59:59`);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 0, // Always refetch when query key changes (date range changes)
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Site Insights (location-based compliance and recommendations) for a company.
 * @param {string} companyId - Company UUID
 * @param {string} startDate - Start date for filtering (YYYY-MM-DD, optional)
 * @param {string} endDate - End date for filtering (YYYY-MM-DD, optional)
 * @param {string} customerRef - Customer reference (optional)
 * @param {string} siteRef - Site reference (optional)
 */
export const aiSiteInsightsOptions = (companyId, startDate = null, endDate = null, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.siteInsights(companyId, startDate, endDate, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase
        .from('ai_site_insights')
        .select('*')
        .order('compliance_rate', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      
      // Apply date range filter on insight_date if provided
      if (startDate && endDate) {
        q = q.gte('insight_date', startDate)
             .lte('insight_date', endDate);
      } else if (startDate) {
        q = q.gte('insight_date', startDate);
      } else if (endDate) {
        q = q.lte('insight_date', endDate);
      }
      
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 0, // Always refetch when query key changes (date changes)
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Pattern Summary (heatmap, peak hour, best site/driver, positive/concern patterns) for Patterns tab.
 * @param {string} companyId - Company UUID
 * @param {string} customerRef - Customer reference (optional)
 * @param {string} siteRef - Site reference (optional)
 * @param {string} startDate - Start date for filtering (YYYY-MM-DD, optional)
 * @param {string} endDate - End date for filtering (YYYY-MM-DD, optional)
 */
export const aiPatternSummaryOptions = (companyId, customerRef = null, siteRef = null, startDate = null, endDate = null) =>
  queryOptions({
    queryKey: queryKeys.ai.patternSummary(companyId, customerRef, siteRef, startDate, endDate),
    queryFn: async () => {
      let q = supabase.from('ai_pattern_summary').select('*');
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      
      // Apply date range filter on updated_at if provided
      if (startDate && endDate) {
        q = q.gte('updated_at', `${startDate}T00:00:00`)
             .lte('updated_at', `${endDate}T23:59:59`);
      } else if (startDate) {
        q = q.gte('updated_at', `${startDate}T00:00:00`);
      } else if (endDate) {
        q = q.lte('updated_at', `${endDate}T23:59:59`);
      }
      
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: true,
    staleTime: 0, // Always refetch when query key changes (date range changes)
    gcTime: 5 * 60 * 1000,
  });
