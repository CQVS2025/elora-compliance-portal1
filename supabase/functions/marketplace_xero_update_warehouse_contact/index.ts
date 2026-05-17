// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { getValidXeroCreds, updateSupplierContact } from '../_shared/marketplaceXero.ts';

/**
 * POST { warehouse_id, details? } → { ok, tenant_name }
 *
 * Updates the Xero supplier contact for a warehouse that has already been
 * registered. POST to /Contacts with ContactID acts as upsert in Xero.
 *
 * Super-admin only.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createSupabaseClient(req);
    const { data: superAdminCheck } = await supabase.rpc('is_marketplace_super_admin');
    if (!superAdminCheck) {
      return json({ error: 'Forbidden: Elora super_admin required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const warehouseId = String(body?.warehouse_id ?? '').trim();
    if (!warehouseId) return json({ error: 'warehouse_id is required' }, 400);

    const admin = createSupabaseAdminClient();

    if (body?.details && typeof body.details === 'object') {
      const { error: dErr } = await admin
        .from('marketplace_warehouses')
        .update({ xero_contact_details: body.details })
        .eq('id', warehouseId);
      if (dErr) throw dErr;
    }

    const { data: warehouse, error: wErr } = await admin
      .from('marketplace_warehouses')
      .select('id, name, is_supplier_managed, xero_contact_id, contact_email, address_line1, address_line2, suburb, state, postcode, xero_contact_details')
      .eq('id', warehouseId)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!warehouse) return json({ error: 'Warehouse not found' }, 404);
    if (!warehouse.xero_contact_id) {
      return json({ error: 'Warehouse is not yet linked to a Xero contact. Use Register first.' }, 400);
    }
    if (!warehouse.is_supplier_managed) {
      return json({
        error: 'Warehouse is no longer marked as a third-party supplier. Re-enable "Third-party supplier" to manage its Xero supplier contact.',
      }, 409);
    }

    let creds;
    try { creds = await getValidXeroCreds(admin); }
    catch { return json({ error: 'Xero not connected. Connect Xero from the Integrations page first.' }, 400); }

    await updateSupplierContact(admin, creds, {
      id: warehouse.id,
      name: warehouse.name,
      xero_contact_id: warehouse.xero_contact_id,
      contact_email: warehouse.contact_email ?? null,
      address_line1: warehouse.address_line1 ?? null,
      address_line2: warehouse.address_line2 ?? null,
      suburb: warehouse.suburb ?? null,
      state: warehouse.state ?? null,
      postcode: warehouse.postcode ?? null,
      xero_contact_details: warehouse.xero_contact_details ?? {},
    });

    return json({ ok: true, tenant_name: creds.tenantName }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_update_warehouse_contact error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
