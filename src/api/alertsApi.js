import { supabase } from '@/lib/supabase';

const ALERTS_SERVER_URL = import.meta.env.VITE_ALERTS_WS_URL || 'http://localhost:3001';

/**
 * Alerts API – direct Supabase queries for the alerts system.
 */
export const alertsApi = {
  // ── Alert Configurations ─────────────────────────────────────
  getConfigurations: async () => {
    const { data, error } = await supabase
      .from('alert_configurations')
      .select('*')
      .order('category', { ascending: true });
    if (error) throw error;
    return data;
  },

  updateConfiguration: async (id, updates) => {
    const { data, error } = await supabase
      .from('alert_configurations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Alerts (Live Feed) ──────────────────────────────────────
  getAlerts: async ({ category, limit = 1000 } = {}) => {
    // Fetch in batches if needed — Supabase caps at 1000 per request
    let allData = [];
    let offset = 0;
    const batchSize = 1000;
    let totalCount = 0;

    while (true) {
      let query = supabase
        .from('alerts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      totalCount = count || 0;
      allData = allData.concat(data || []);

      // If we got fewer rows than batch size, we've fetched everything
      if (!data || data.length < batchSize) break;
      // If we've reached the requested limit, stop
      if (allData.length >= limit) break;
      offset += batchSize;
    }

    return { data: allData, count: totalCount };
  },

  deleteAlert: async (id) => {
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  deleteAllAlerts: async ({ from, to } = {}) => {
    let query = supabase.from('alerts').delete();
    if (from && to) {
      // Delete alerts within date range
      query = query.gte('created_at', new Date(from).toISOString()).lte('created_at', new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString());
    } else {
      // Delete all
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { error } = await query;
    if (error) throw error;
  },

  // ── Alert Stats ─────────────────────────────────────────────
  getAlertStats: async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

    // Today's alerts
    const { count: todayCount } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart);

    // Today's critical
    const { count: criticalCount } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .eq('status', 'active')
      .gte('created_at', todayStart);

    // This week
    const { count: weekCount } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart);

    // Resolved
    const { count: resolvedCount } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved');

    // Warnings today
    const { count: warningsToday } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'warning')
      .gte('created_at', todayStart);

    // Total configured
    const { count: configuredCount } = await supabase
      .from('alert_configurations')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    return {
      todayCount: todayCount || 0,
      criticalCount: criticalCount || 0,
      weekCount: weekCount || 0,
      resolvedCount: resolvedCount || 0,
      warningsToday: warningsToday || 0,
      configuredCount: configuredCount || 0,
    };
  },

  // ── Delivery Settings ───────────────────────────────────────
  getDeliverySettings: async (userId) => {
    const { data, error } = await supabase
      .from('alert_delivery_settings')
      .select('*')
      .eq('admin_user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  },

  upsertDeliverySettings: async (userId, settings) => {
    // Check if exists
    const { data: existing } = await supabase
      .from('alert_delivery_settings')
      .select('id')
      .eq('admin_user_id', userId)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('alert_delivery_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('admin_user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('alert_delivery_settings')
        .insert({ admin_user_id: userId, ...settings })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // ── Test Alert ──────────────────────────────────────────────
  sendTestAlert: async () => {
    try {
      const res = await fetch(`${ALERTS_SERVER_URL}/emit-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DEVICE_OFFLINE',
          category: 'devices',
          severity: 'critical',
          entity_name: 'TEST DEVICE - Simulation',
          message: 'This is a test alert. Device offline simulation triggered manually.',
        }),
      });
      return await res.json();
    } catch (err) {
      // Fallback: insert directly if WS server is not reachable
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          type: 'DEVICE_OFFLINE',
          category: 'devices',
          severity: 'critical',
          entity_name: 'TEST DEVICE - Simulation',
          message: 'This is a test alert. Device offline simulation triggered manually.',
          status: 'active',
          delivery_channels: ['portal'],
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, alert: data, fallback: true };
    }
  },
};
