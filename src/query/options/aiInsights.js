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
 * AI Predictions for a company (optionally for a given date, customer, site).
 */
export const aiPredictionsOptions = (companyId, predictionDate = null, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.predictions(companyId, predictionDate, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase
        .from('ai_predictions')
        .select('*')
        .order('risk_score', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      if (predictionDate) q = q.eq('prediction_date', predictionDate);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Recommendations for a company (or all for super_admin when companyId is null).
 */
export const aiRecommendationsOptions = (companyId, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.recommendations(companyId, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase
        .from('ai_recommendations')
        .select('*')
        .order('created_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Wash Windows (optimal wash time slots) for a company.
 */
export const aiWashWindowsOptions = (companyId, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.washWindows(companyId, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase
        .from('ai_wash_windows')
        .select('*')
        .order('window_start', { ascending: true });
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Driver Patterns (behavioral insights per driver) for a company.
 */
export const aiDriverPatternsOptions = (companyId, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.driverPatterns(companyId, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase
        .from('ai_driver_patterns')
        .select('*')
        .order('detected_at', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Site Insights (location-based compliance and recommendations) for a company.
 */
export const aiSiteInsightsOptions = (companyId, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.siteInsights(companyId, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase
        .from('ai_site_insights')
        .select('*')
        .order('compliance_rate', { ascending: false });
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

/**
 * AI Pattern Summary (heatmap, peak hour, best site/driver, positive/concern patterns) for Patterns tab.
 */
export const aiPatternSummaryOptions = (companyId, customerRef = null, siteRef = null) =>
  queryOptions({
    queryKey: queryKeys.ai.patternSummary(companyId, customerRef, siteRef),
    queryFn: async () => {
      let q = supabase.from('ai_pattern_summary').select('*');
      if (companyId) q = q.eq('company_id', companyId);
      if (customerRef) q = q.eq('customer_ref', customerRef);
      if (siteRef) q = q.eq('site_ref', siteRef);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
