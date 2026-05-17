import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/toast';

/**
 * Org-picker page. Shown after a super_admin connects Xero and the OAuth
 * grant covers multiple organisations, or when they click "Choose org" on
 * the Integrations page later to switch the active org.
 *
 * Routes:
 *   /admin/marketplace/xero/choose-org           — switch active org
 *   /admin/marketplace/xero/choose-org?initial=1 — first-time pick after connect
 */
export default function MarketplaceXeroChooseOrg() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isInitial = searchParams.get('initial') === '1';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await callEdgeFunction('marketplace_xero_available_tenants', {});
        if (cancelled) return;
        setTenants(data?.tenants ?? []);
        setActiveTenantId(data?.active_tenant_id ?? '');
        setSelectedId(data?.active_tenant_id ?? '');
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load organisations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await callEdgeFunction('marketplace_xero_select_tenant', { tenant_id: selectedId });
      toastSuccess(res?.changed
        ? `Switched to ${res.tenant_name}. Per-order Xero ids from the previous org were cleared.`
        : `Active organisation: ${res?.tenant_name ?? 'updated'}`);
      navigate('/admin/marketplace/integrations?xero_connected=1');
    } catch (e) {
      toastError(e?.message ?? 'Failed to select organisation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketplace/integrations')}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Integrations
      </Button>

      <div>
        <h1 className="text-xl font-semibold">Choose Xero Organisation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isInitial
            ? 'Your Xero account has access to multiple organisations. Pick the one this marketplace should send invoices and purchase orders to.'
            : 'Switch the active Xero organisation. Invoices and POs will be created in the selected org going forward.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Authorized Organisations
          </CardTitle>
          <CardDescription>
            These are the Xero orgs your current connection can access. Only one can be active at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading organisations…
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organisations available. Try reconnecting to Xero.
            </p>
          ) : (
            <div className="space-y-2">
              {tenants.map((t) => {
                const isSelected = selectedId === t.tenant_id;
                const isActive = activeTenantId === t.tenant_id;
                return (
                  <button
                    type="button"
                    key={t.tenant_id}
                    onClick={() => setSelectedId(t.tenant_id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                      }`}>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.tenant_name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{t.tenant_id}</p>
                      </div>
                    </div>
                    {isActive && (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Currently active
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => navigate('/admin/marketplace/integrations')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading || submitting || !selectedId || (selectedId === activeTenantId && !isInitial)}
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
            : <>Use this organisation <ArrowRight className="w-4 h-4 ml-1.5" /></>}
        </Button>
      </div>
    </div>
  );
}
