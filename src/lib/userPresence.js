/**
 * User presence - DB-based online/offline and last seen
 * No webhooks. Updated by client on login + heartbeat every 45s.
 * Online = last_seen_at within 90 seconds.
 */

import { supabase } from './supabase';

const HEARTBEAT_INTERVAL_MS = 45 * 1000; // 45 seconds
const ONLINE_THRESHOLD_SECONDS = 90;

let heartbeatTimer = null;

/**
 * Upsert presence on login - sets last_login_at and last_seen_at
 */
export async function upsertPresenceOnLogin(userId, companyId = null) {
  if (!userId) return;
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('user_presence').upsert(
      {
        user_id: userId,
        company_id: companyId,
        last_login_at: now,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  } catch (err) {
    console.warn('Presence login upsert failed:', err);
  }
}

/**
 * Update last_seen_at for heartbeat (does not overwrite last_login_at)
 */
async function updatePresenceHeartbeat(userId) {
  if (!userId) return;
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('user_presence')
      .update({ last_seen_at: now, updated_at: now })
      .eq('user_id', userId);
    if (error) throw error;
  } catch (err) {
    console.warn('Presence heartbeat failed:', err);
  }
}

/**
 * Start heartbeat - updates last_seen_at every HEARTBEAT_INTERVAL_MS
 */
export function startHeartbeat(userId, companyId) {
  stopHeartbeat();
  if (!userId) return;
  upsertPresenceOnLogin(userId, companyId); // Ensure row exists
  heartbeatTimer = setInterval(() => {
    updatePresenceHeartbeat(userId);
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat when user logs out
 */
export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Check if user is online based on last_seen_at
 * @param {string} lastSeenAt - ISO timestamp
 */
export function isOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const diff = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  return diff < ONLINE_THRESHOLD_SECONDS;
}

export { ONLINE_THRESHOLD_SECONDS };
