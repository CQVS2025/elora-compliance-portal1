import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plug, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, LinkIcon, Building2, Unplug } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  integrationLogOptions,
  xeroCredentialsOptions,
} from '@/query/options/marketplace';
import { callEdgeFunction } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/toast';
import { useConfirm } from '@/hooks/useConfirm';

const INTEGRATIONS = [
  { value: 'all', label: 'All integrations' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'xero', label: 'Xero' },
  { value: 'email', label: 'Email' },
  { value: 'system', label: 'System' },
];

/**
 * Admin diagnostic page for the marketplace integrations.
 *
 *  - Xero connection status (connected tenant, expiry)
 *  - Recent integration_log entries (Stripe, Xero, email) with payload viewer
 */
export default function MarketplaceIntegrations() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const companyId = userProfile?.company_id;
  const isSuperAdmin = userProfile?.role === 'super_admin';

  const [filter, setFilter] = useState({ integration: undefined });
  const { data: logs = [], isLoading, isFetching, refetch } = useQuery(integrationLogOptions(companyId, filter));
  const { data: xero, refetch: refetchXero } = useQuery(xeroCredentialsOptions(companyId));

  const [openLog, setOpenLog] = useState(null);
  const [xeroBusy, setXeroBusy] = useState(null); // 'connect' | 'refresh' | 'disconnect' | null

  const xeroConnected = !!xero?.tenant_id;
  // The 30-minute access-token clock running out is NOT an error — Xero
  // tokens auto-refresh lazily on the next API call (via getValidXeroCreds).
  // We only badge the connection as "Action needed" when the long-lived
  // refresh-token grant itself has lapsed (60+ days of inactivity → Xero
  // force-disconnects). The FE can detect that from `expires_at` alone:
  // if the LAST stamp is more than 60 days behind us, no refresh succeeded
  // recently and an admin needs to re-OAuth.
  //
  // Note: we do NOT read access_token / refresh_token here — those columns
  // are intentionally excluded from the FE query because they're secrets.
  // Their absence on the row object means "hidden", not "missing".
  const xeroNeedsAttention = useMemo(() => {
    if (!xeroConnected) return false;
    if (!xero?.expires_at) return false;
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    return new Date(xero.expires_at).getTime() + sixtyDaysMs < Date.now();
  }, [xeroConnected, xero?.expires_at]);
  // Soft "stale" flag — past expires_at but inside the refresh window.
  // Used only to show a "Will refresh on next use" hint, no alarm.
  const xeroAccessStale = useMemo(() => {
    if (!xero?.expires_at) return false;
    return new Date(xero.expires_at) < new Date();
  }, [xero?.expires_at]);

  // Surface ?xero_connected=1 / ?xero_error=... from the OAuth callback redirect
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('xero_connected') === '1') {
      toastSuccess('Xero connected.');
      refetchXero();
      refetch();
      const next = new URLSearchParams(searchParams);
      next.delete('xero_connected');
      setSearchParams(next, { replace: true });
    }
    const err = searchParams.get('xero_error');
    if (err) {
      toastError(`Xero connection failed: ${err}`);
      const next = new URLSearchParams(searchParams);
      next.delete('xero_error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, refetchXero, refetch, setSearchParams]);

  async function connectXero() {
    setXeroBusy('connect');
    try {
      const res = await callEdgeFunction('marketplace_xero_oauth_start', {});
      if (!res?.url) throw new Error('No authorize URL returned');
      window.location.href = res.url;
    } catch (e) {
      toastError(e?.message ?? 'Could not start Xero connection');
      setXeroBusy(null);
    }
  }

  async function refreshXero() {
    setXeroBusy('refresh');
    try {
      const res = await callEdgeFunction('marketplace_xero_refresh_token', {});
      if (res?.error) throw new Error(res.error);
      toastSuccess('Xero token refreshed.');
      refetchXero();
    } catch (e) {
      toastError(e?.message ?? 'Refresh failed');
    } finally {
      setXeroBusy(null);
    }
  }

  async function disconnectXero() {
    const ok = await confirm({
      title: 'Disconnect Xero?',
      description:
        'This revokes the active organisation on Xero and clears the stored tokens here. If your grant covers other Xero organisations, the next one will become active automatically. Stored Xero invoice / PO ids on existing orders will be wiped.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    setXeroBusy('disconnect');
    try {
      const res = await callEdgeFunction('marketplace_xero_disconnect', {});
      if (res?.error) throw new Error(res.error);
      if (res?.state === 'switched') {
        toastSuccess(`Disconnected. Active org switched to ${res.tenant_name}.`);
      } else if (res?.state === 'fully_disconnected') {
        toastSuccess('Xero fully disconnected.');
      } else {
        toastSuccess('Xero disconnected.');
      }
      refetchXero();
      refetch();
    } catch (e) {
      toastError(e?.message ?? 'Disconnect failed');
    } finally {
      setXeroBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary"><Plug className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connection state for Xero, Stripe and email; plus the audit log of every payload sent and received.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card className={
          !xeroConnected
            ? ''
            : xeroNeedsAttention
              ? 'border-amber-200 dark:border-amber-900'
              : 'border-emerald-200 dark:border-emerald-900'
        }>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Xero
              {!xeroConnected ? (
                <Badge variant="outline">Not connected</Badge>
              ) : xeroNeedsAttention ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Reconnect needed
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Connected
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {xeroConnected ? (
              <>
                <p><span className="text-muted-foreground">Org:</span> <strong>{xero?.tenant_name ?? '-'}</strong></p>
                {xero?.expires_at && (
                  <p className="text-xs text-muted-foreground">
                    {xeroAccessStale
                      ? <>Access token rotates on the next Xero call. Last access stamp was valid until{' '}
                          <span className="text-foreground">{new Date(xero.expires_at).toLocaleString('en-AU')}</span>.</>
                      : <>Token refreshes automatically. Current 30-minute access token valid until{' '}
                          <span className="text-foreground">{new Date(xero.expires_at).toLocaleString('en-AU')}</span>.</>}
                  </p>
                )}
                {xero?.last_refreshed_at && (
                  <p className="text-xs text-muted-foreground">
                    Last refresh: {new Date(xero.last_refreshed_at).toLocaleString('en-AU')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">
                Xero is not yet connected. Click <strong>Connect Xero</strong> to start the OAuth flow. Once linked,
                approved PO orders will post invoices and purchase orders to Xero automatically.
              </p>
            )}

            {isSuperAdmin ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!xeroConnected && (
                  <Button size="sm" onClick={connectXero} disabled={xeroBusy === 'connect'}>
                    {xeroBusy === 'connect'
                      ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      : <LinkIcon className="w-3.5 h-3.5 mr-1.5" />}
                    Connect Xero
                  </Button>
                )}
                {xeroConnected && (
                  <>
                    <Button size="sm" variant="outline" onClick={refreshXero} disabled={xeroBusy === 'refresh'}>
                      {xeroBusy === 'refresh'
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                      Refresh token
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/admin/marketplace/xero/choose-org')}
                    >
                      <Building2 className="w-3.5 h-3.5 mr-1.5" /> Choose org
                    </Button>
                    <Button size="sm" variant="outline" onClick={connectXero} disabled={xeroBusy === 'connect'}>
                      {xeroBusy === 'connect'
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <LinkIcon className="w-3.5 h-3.5 mr-1.5" />}
                      Connect another org
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={disconnectXero}
                      disabled={xeroBusy === 'disconnect'}
                      className="text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900 dark:text-rose-400"
                    >
                      {xeroBusy === 'disconnect'
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <Unplug className="w-3.5 h-3.5 mr-1.5" />}
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic pt-1">
                Connecting Xero is restricted to Elora super_admins.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Stripe
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Wired</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground">
              Webhook URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">/functions/v1/marketplace_stripe_webhook</code>
            </p>
            <p className="text-muted-foreground mt-1">
              Configure <code className="text-xs">STRIPE_SECRET_KEY</code> and <code className="text-xs">STRIPE_WEBHOOK_SECRET</code> in Supabase project secrets.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Event log</CardTitle>
              <CardDescription>Last 200 integration events with their payloads.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={filter.integration ?? 'all'}
                onValueChange={(v) => setFilter({ integration: v === 'all' ? undefined : v })}
              >
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTEGRATIONS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading log…</p>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {logs.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setOpenLog(entry)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-start gap-3"
                  >
                    <StatusIcon status={entry.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase">{entry.integration}</Badge>
                        <span className="text-sm font-medium">{entry.event_type}</span>
                        {entry.event_id && <span className="text-[10px] text-muted-foreground font-mono">{entry.event_id}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(entry.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'medium' })}
                        {entry.error_message && <span className="text-rose-600 dark:text-rose-400 ml-2">{entry.error_message}</span>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openLog} onOpenChange={(o) => !o && setOpenLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {openLog?.integration?.toUpperCase()} · {openLog?.event_type}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs whitespace-pre-wrap bg-muted/40 p-3 rounded font-mono">
{JSON.stringify({ ...openLog, payload: openLog?.payload, response: openLog?.response }, null, 2)}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />;
  return <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />;
}
