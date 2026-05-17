// deno-lint-ignore-file no-explicit-any
/**
 * Shared Xero client for marketplace Edge Functions.
 *
 * Configuration (Supabase project secrets, NOT .env):
 *   XERO_CLIENT_ID          OAuth app client id
 *   XERO_CLIENT_SECRET      OAuth app client secret
 *   XERO_REDIRECT_URI       Full HTTPS callback URL — must match the Xero
 *                           app config exactly. Typically the
 *                           marketplace_xero_oauth_callback function URL.
 *
 * Storage: marketplace_xero_credentials (singleton, id=1). Tokens are read
 * and refreshed lazily by the helpers in this module. Refresh happens when
 * access_token expires inside 60 seconds (matching Chem Connect's pattern).
 *
 * Scopes used (new granular scopes — required for Xero apps created after
 * 2 March 2026; the old broad `accounting.transactions` is rejected):
 *   openid / profile / email        (OIDC identification)
 *   offline_access                  (refresh token rotation)
 *   accounting.invoices             (Invoices, PurchaseOrders, CreditNotes, Quotes)
 *   accounting.contacts             (Contact create + lookup)
 *   accounting.attachments          (PO PDF attachment to Xero invoice)
 */

const XERO_OAUTH_AUTHORIZE = 'https://login.xero.com/identity/connect/authorize';
const XERO_OAUTH_TOKEN = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS = 'https://api.xero.com/connections';
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

/**
 * Xero scopes — use the NEW granular scopes (required for apps created
 * after 2 March 2026; Xero rejects the old broad scopes with `invalid_scope`).
 *
 *   Old (broad):        accounting.transactions
 *   New (granular):     accounting.invoices   ← covers Invoices, PurchaseOrders,
 *                                               CreditNotes, Quotes
 *
 * This matches the production Chem Connect portal's working scope list.
 */
export const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.invoices',
  'accounting.contacts',
  'accounting.attachments',
].join(' ');

export function getXeroEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = Deno.env.get('XERO_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('XERO_CLIENT_SECRET') ?? '';
  const redirectUri = Deno.env.get('XERO_REDIRECT_URI') ?? '';
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getXeroEnv();
  // Build the query string manually — URLSearchParams encodes spaces as `+`,
  // but Xero's authorize endpoint requires `%20` for spaces in the `scope`
  // param. A `+`-encoded scope list trips Xero into `invalid_scope`.
  const parts = [
    `response_type=code`,
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `scope=${encodeURIComponent(XERO_SCOPES)}`,
    `state=${encodeURIComponent(state)}`,
  ];
  return `${XERO_OAUTH_AUTHORIZE}?${parts.join('&')}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret, redirectUri } = getXeroEnv();
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(XERO_OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`Xero token exchange failed (${resp.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret } = getXeroEnv();
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(XERO_OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`Xero token refresh failed (${resp.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Returns the list of Xero connections (orgs) authorized under the
 * current access token. Each entry includes:
 *   - `id`         connection id — pass to deleteXeroConnection() to revoke
 *                  ONE org without touching the others
 *   - `tenantId`   Xero tenant uuid — used as the `Xero-tenant-id` header
 *   - `tenantName` human label shown in the picker UI
 *   - `tenantType` 'ORGANISATION' (only kind we care about)
 */
export async function fetchTenants(accessToken: string): Promise<Array<{
  id: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
}>> {
  const resp = await fetch(XERO_CONNECTIONS, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Xero /connections failed (${resp.status}): ${body}`);
  }
  return await resp.json();
}

/**
 * Revoke a SINGLE Xero connection (one org) without touching the others.
 * Other orgs authorized under the same OAuth grant remain connected on
 * Xero's side. Returns silently on 404 (already gone).
 */
export async function deleteXeroConnection(accessToken: string, connectionId: string): Promise<void> {
  const resp = await fetch(`${XERO_CONNECTIONS}/${connectionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
  });
  if (!resp.ok && resp.status !== 404) {
    const text = await resp.text();
    throw new Error(`Xero connection delete failed (${resp.status}): ${text}`);
  }
}

/**
 * Switch the active Xero tenant on the singleton credentials row. Tokens
 * stay the same (they're grant-wide, not tenant-scoped); only tenant_id
 * and tenant_name change. Caller is responsible for nulling any per-order
 * xero_invoice_id / xero_po_id values that were scoped to the old tenant.
 */
// deno-lint-ignore no-explicit-any
export async function switchActiveTenant(supabaseAdmin: any, params: {
  tenantId: string;
  tenantName: string;
}): Promise<{ changed: boolean }> {
  const { data: existing, error } = await supabaseAdmin
    .from('marketplace_xero_credentials')
    .select('id, tenant_id')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  if (!existing) throw new Error('No active Xero credentials to switch tenant on');

  const changed = existing.tenant_id !== params.tenantId;
  const { error: upErr } = await supabaseAdmin
    .from('marketplace_xero_credentials')
    .update({
      tenant_id: params.tenantId,
      tenant_name: params.tenantName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (upErr) throw upErr;

  // If the tenant actually changed, every stored Xero ContactID + per-order
  // Xero record id is scoped to the OLD org and won't resolve against the
  // new one. If we don't wipe them, the next invoice/PO attempt will send
  // `{ Contact: { ContactID: <id-from-old-org> } }` to the new org → Xero
  // rejects with HasErrors=true and a zero-uuid response.
  //
  // We preserve xero_contact_details / xero_invoicing_enabled / supplier
  // flags so admin can just re-Register on the Companies / Warehouses pages
  // and the rich data flows back into the new org's contact automatically
  // (via upsertContact + buildXeroContactPayload). Mirrors Chem Connect's
  // switchActiveTenant cleanup.
  if (changed) {
    await supabaseAdmin
      .from('marketplace_orders')
      .update({
        xero_invoice_id: null,
        xero_invoice_number: null,
        xero_invoice_status: null,
        xero_po_id: null,
        xero_po_number: null,
        xero_po_status: null,
      })
      .or('xero_invoice_id.not.is.null,xero_po_id.not.is.null');

    await supabaseAdmin
      .from('companies')
      .update({ xero_contact_id: null })
      .not('xero_contact_id', 'is', null);

    await supabaseAdmin
      .from('marketplace_warehouses')
      .update({ xero_contact_id: null })
      .not('xero_contact_id', 'is', null);
  }

  return { changed };
}

/**
 * Loads + refreshes-if-needed the Xero credential row. Refreshes when the
 * access token expires within 60 seconds (matches Chem Connect's pattern).
 * Returns the fresh access token + tenant id.
 */
export async function getValidXeroCreds(supabaseAdmin: any): Promise<{
  accessToken: string;
  tenantId: string;
  tenantName: string | null;
  revenueAccountCode: string | null;
  freightAccountCode: string | null;
  gstTaxType: string;
  brandingThemeId: string | null;
  poSenderEmail: string | null;
}> {
  const { data: row, error } = await supabaseAdmin
    .from('marketplace_xero_credentials')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  if (!row || !row.access_token || !row.refresh_token || !row.tenant_id) {
    throw new Error('Xero not connected. An admin must connect Xero from the Integrations page first.');
  }

  const now = Date.now();
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  let accessToken = row.access_token as string;
  let refreshToken = row.refresh_token as string;

  if (expiresAt - now < 60_000) {
    // Refresh
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token;
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in - 30) * 1000).toISOString();
      await supabaseAdmin
        .from('marketplace_xero_credentials')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: newExpiresAt,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', 1);
      await supabaseAdmin.from('marketplace_xero_sync_log').insert({
        operation: 'refresh_token',
        status: 'success',
      });
    } catch (e: any) {
      await supabaseAdmin.from('marketplace_xero_sync_log').insert({
        operation: 'refresh_token',
        status: 'failed',
        error_message: e?.message ?? String(e),
      });
      throw e;
    }
  }

  return {
    accessToken,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    revenueAccountCode: row.revenue_account_code,
    freightAccountCode: row.freight_account_code,
    gstTaxType: row.gst_tax_type ?? 'OUTPUT',
    brandingThemeId: row.branding_theme_id,
    poSenderEmail: row.po_sender_email,
  };
}

/**
 * Logs a Xero API call with status + payload + response into
 * marketplace_xero_sync_log.
 */
export async function logXeroSync(
  supabaseAdmin: any,
  fields: {
    order_id?: string | null;
    operation: string;
    status: 'success' | 'failed' | 'pending';
    http_status?: number;
    xero_object_id?: string | null;
    request_payload?: any;
    response_payload?: any;
    error_message?: string;
  },
) {
  await supabaseAdmin.from('marketplace_xero_sync_log').insert(fields);
}

// ---------------------------------------------------------------------------
// Invoice / PO builders + sender
// ---------------------------------------------------------------------------

export async function postToXero(
  accessToken: string,
  tenantId: string,
  endpoint: string,
  body: any,
): Promise<{ status: number; data: any }> {
  const resp = await fetch(`${XERO_API_BASE}${endpoint}?summarizeErrors=false`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));

  // -----------------------------------------------------------------------
  // Per-record validation detection.
  //
  // With summarizeErrors=false (set above), Xero returns HTTP 200 even when
  // a record fails validation. The failing record carries HasErrors=true
  // (or ValidationErrors[] / StatusAttributeString=ERROR) and the response
  // ID is an all-zeros UUID. Without this check we'd persist that bogus id
  // (`00000000-0000-0000-0000-000000000000`) onto marketplace_orders and
  // every "Open in Xero" link would 404 — exactly the bug we hit.
  //
  // Treat such records as a non-2xx so callers (and the auto-logging
  // wrapper) raise an error and DON'T write the bogus id.
  // -----------------------------------------------------------------------
  if (resp.ok) {
    const recordKeys = ['Invoices', 'Contacts', 'PurchaseOrders', 'CreditNotes', 'Payments'];
    for (const key of recordKeys) {
      const records = data?.[key];
      if (!Array.isArray(records)) continue;
      for (const r of records) {
        const hasError =
          r?.HasErrors === true ||
          r?.StatusAttributeString === 'ERROR' ||
          (Array.isArray(r?.ValidationErrors) && r.ValidationErrors.length > 0);
        if (hasError) {
          const messages = (r.ValidationErrors ?? [])
            .map((v: { Message?: string }) => v?.Message)
            .filter(Boolean)
            .join(' | ');
          return {
            status: 422,
            data: {
              Message: messages || `Xero ${endpoint} record validation failed`,
              Elements: [{ ValidationErrors: r.ValidationErrors ?? [] }],
              _raw: data,
            },
          };
        }
      }
    }
  }

  return { status: resp.status, data };
}

// ---------------------------------------------------------------------------
// Build a Xero /Contacts payload from a buyer company OR supplier warehouse
// row + its xero_contact_details JSONB blob. Returns one Contact object
// (the caller wraps it in `{ Contacts: [...] }`).
//
// `kind`:
//   - 'customer' (default) — sets IsCustomer:true on the payload (buyer companies)
//   - 'supplier'           — sets IsSupplier:true on the payload (third-party warehouses)
// ---------------------------------------------------------------------------
function buildXeroContactPayload(entity: {
  id: string;
  name: string;
  marketplace_invoice_email?: string | null;
  marketplace_default_address?: any;
  xero_contact_details?: any;
}, opts: { contactId?: string | null; kind?: 'customer' | 'supplier' } = {}): any {
  const kind = opts.kind ?? 'customer';
  const d = (entity.xero_contact_details ?? {}) as any;
  const fallbackAddr = entity.marketplace_default_address ?? null;

  const addresses: any[] = [];
  if (d.billing_address && (d.billing_address.line1 || d.billing_address.city || d.billing_address.postcode)) {
    addresses.push({
      AddressType: 'POBOX',
      AddressLine1: d.billing_address.line1 ?? '',
      AddressLine2: d.billing_address.line2 ?? '',
      City: d.billing_address.city ?? d.billing_address.suburb ?? '',
      Region: d.billing_address.region ?? d.billing_address.state ?? '',
      PostalCode: d.billing_address.postcode ?? '',
      Country: d.billing_address.country ?? 'Australia',
    });
  }
  if (d.delivery_address && (d.delivery_address.line1 || d.delivery_address.city || d.delivery_address.postcode)) {
    addresses.push({
      AddressType: 'STREET',
      AddressLine1: d.delivery_address.line1 ?? '',
      AddressLine2: d.delivery_address.line2 ?? '',
      City: d.delivery_address.city ?? d.delivery_address.suburb ?? '',
      Region: d.delivery_address.region ?? d.delivery_address.state ?? '',
      PostalCode: d.delivery_address.postcode ?? '',
      Country: d.delivery_address.country ?? 'Australia',
    });
  } else if (fallbackAddr && (fallbackAddr.line1 || fallbackAddr.postcode)) {
    // Fall back to the marketplace default delivery address.
    addresses.push({
      AddressType: 'STREET',
      AddressLine1: fallbackAddr.line1 ?? '',
      AddressLine2: fallbackAddr.line2 ?? '',
      City: fallbackAddr.suburb ?? '',
      Region: fallbackAddr.state ?? '',
      PostalCode: fallbackAddr.postcode ?? '',
      Country: 'Australia',
    });
  }

  const phones: any[] = [];
  if (d.phone && (d.phone.number || d.phone.area_code)) {
    phones.push({
      PhoneType: 'DEFAULT',
      PhoneCountryCode: d.phone.country_code ?? '61',
      PhoneAreaCode: d.phone.area_code ?? '',
      PhoneNumber: d.phone.number ?? '',
    });
  }
  if (d.mobile && d.mobile.number) {
    phones.push({
      PhoneType: 'MOBILE',
      PhoneCountryCode: d.mobile.country_code ?? '61',
      PhoneAreaCode: d.mobile.area_code ?? '',
      PhoneNumber: d.mobile.number ?? '',
    });
  }

  const contact: any = {
    Name: entity.name,
    DefaultCurrency: d.currency ?? 'AUD',
  };
  if (kind === 'supplier') contact.IsSupplier = true;
  else contact.IsCustomer = true;
  if (opts.contactId) contact.ContactID = opts.contactId;
  if (d.first_name) contact.FirstName = d.first_name;
  if (d.last_name) contact.LastName = d.last_name;
  const email = d.email_address ?? entity.marketplace_invoice_email ?? null;
  if (email) contact.EmailAddress = email;
  if (d.tax_number) contact.TaxNumber = String(d.tax_number).replace(/\s+/g, '');
  if (d.website) contact.Website = d.website;
  if (d.account_number) contact.AccountNumber = d.account_number;
  if (addresses.length > 0) contact.Addresses = addresses;
  if (phones.length > 0) contact.Phones = phones;
  if (Array.isArray(d.contact_persons) && d.contact_persons.length > 0) {
    contact.ContactPersons = d.contact_persons.slice(0, 5).map((p: any) => ({
      FirstName: p.first_name ?? '',
      LastName: p.last_name ?? '',
      EmailAddress: p.email_address ?? '',
      IncludeInEmails: p.include_in_emails ?? true,
    }));
  }
  return contact;
}

export async function upsertContact(
  supabaseAdmin: any,
  creds: Awaited<ReturnType<typeof getValidXeroCreds>>,
  buyerCompany: {
    id: string;
    name: string;
    xero_contact_id?: string | null;
    marketplace_invoice_email?: string | null;
    marketplace_default_address?: any;
    xero_contact_details?: any;
  },
): Promise<string> {
  if (buyerCompany.xero_contact_id) return buyerCompany.xero_contact_id;

  const payload = {
    Contacts: [buildXeroContactPayload(buyerCompany)],
  };
  const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/Contacts', payload);
  if (status >= 300) {
    await logXeroSync(supabaseAdmin, {
      operation: 'create_contact',
      status: 'failed',
      http_status: status,
      request_payload: payload,
      response_payload: data,
      error_message: data?.Message ?? `HTTP ${status}`,
    });
    throw new Error(`Xero contact create failed: ${data?.Message ?? `HTTP ${status}`}`);
  }
  const contact = data?.Contacts?.[0];
  if (!contact?.ContactID) throw new Error('Xero contact response missing ContactID');

  await supabaseAdmin.from('companies').update({ xero_contact_id: contact.ContactID }).eq('id', buyerCompany.id);
  await logXeroSync(supabaseAdmin, {
    operation: 'create_contact',
    status: 'success',
    http_status: status,
    xero_object_id: contact.ContactID,
    request_payload: payload,
    response_payload: contact,
  });
  return contact.ContactID;
}

/**
 * Push an UPDATE to an already-linked Xero contact. Used when the admin
 * edits the buyer's Xero contact details (ABN, addresses, phone, …) in
 * Customer Marketplace Access. POST to /Contacts with a ContactID acts as
 * upsert in Xero.
 */
export async function updateContact(
  supabaseAdmin: any,
  creds: Awaited<ReturnType<typeof getValidXeroCreds>>,
  buyerCompany: {
    id: string;
    name: string;
    xero_contact_id: string;
    marketplace_invoice_email?: string | null;
    marketplace_default_address?: any;
    xero_contact_details?: any;
  },
): Promise<void> {
  const payload = {
    Contacts: [buildXeroContactPayload(buyerCompany, { contactId: buyerCompany.xero_contact_id })],
  };
  const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/Contacts', payload);
  if (status >= 300) {
    await logXeroSync(supabaseAdmin, {
      operation: 'update_contact',
      status: 'failed',
      http_status: status,
      xero_object_id: buyerCompany.xero_contact_id,
      request_payload: payload,
      response_payload: data,
      error_message: data?.Message ?? `HTTP ${status}`,
    });
    throw new Error(`Xero contact update failed: ${data?.Message ?? `HTTP ${status}`}`);
  }
  await logXeroSync(supabaseAdmin, {
    operation: 'update_contact',
    status: 'success',
    http_status: status,
    xero_object_id: buyerCompany.xero_contact_id,
    request_payload: payload,
    response_payload: data?.Contacts?.[0] ?? data,
  });
}

// ---------------------------------------------------------------------------
// Supplier-side equivalents: third-party warehouses that fulfil orders for
// Elora need their own Xero supplier contact so the Purchase Order lands
// against the right record (with ABN, address, primary person populated).
// Same upsert pattern as buyer-company contacts, but writes back to
// marketplace_warehouses.xero_contact_id and sets IsSupplier=true.
// ---------------------------------------------------------------------------

/** Adapt a warehouse row into the entity shape buildXeroContactPayload wants. */
function warehouseAsEntity(w: any) {
  // Map the warehouse address columns into the same shape as
  // companies.marketplace_default_address so address fallback works.
  const defaultAddr = (w.address_line1 || w.suburb || w.postcode)
    ? {
        line1: w.address_line1 ?? '',
        line2: w.address_line2 ?? '',
        suburb: w.suburb ?? '',
        state: w.state ?? '',
        postcode: w.postcode ?? '',
      }
    : null;
  return {
    id: w.id,
    name: w.name,
    marketplace_invoice_email: w.contact_email ?? null,
    marketplace_default_address: defaultAddr,
    xero_contact_details: w.xero_contact_details ?? {},
  };
}

export async function upsertSupplierContact(
  supabaseAdmin: any,
  creds: Awaited<ReturnType<typeof getValidXeroCreds>>,
  warehouse: {
    id: string;
    name: string;
    xero_contact_id?: string | null;
    contact_email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    xero_contact_details?: any;
  },
): Promise<string> {
  if (warehouse.xero_contact_id) return warehouse.xero_contact_id;

  const payload = {
    Contacts: [buildXeroContactPayload(warehouseAsEntity(warehouse), { kind: 'supplier' })],
  };
  const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/Contacts', payload);
  if (status >= 300) {
    await logXeroSync(supabaseAdmin, {
      operation: 'create_supplier_contact',
      status: 'failed',
      http_status: status,
      request_payload: payload,
      response_payload: data,
      error_message: data?.Message ?? `HTTP ${status}`,
    });
    throw new Error(`Xero supplier contact create failed: ${data?.Message ?? `HTTP ${status}`}`);
  }
  const contact = data?.Contacts?.[0];
  if (!contact?.ContactID) throw new Error('Xero contact response missing ContactID');

  await supabaseAdmin.from('marketplace_warehouses')
    .update({ xero_contact_id: contact.ContactID })
    .eq('id', warehouse.id);
  await logXeroSync(supabaseAdmin, {
    operation: 'create_supplier_contact',
    status: 'success',
    http_status: status,
    xero_object_id: contact.ContactID,
    request_payload: payload,
    response_payload: contact,
  });
  return contact.ContactID;
}

export async function updateSupplierContact(
  supabaseAdmin: any,
  creds: Awaited<ReturnType<typeof getValidXeroCreds>>,
  warehouse: {
    id: string;
    name: string;
    xero_contact_id: string;
    contact_email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    xero_contact_details?: any;
  },
): Promise<void> {
  const payload = {
    Contacts: [buildXeroContactPayload(warehouseAsEntity(warehouse), {
      contactId: warehouse.xero_contact_id,
      kind: 'supplier',
    })],
  };
  const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/Contacts', payload);
  if (status >= 300) {
    await logXeroSync(supabaseAdmin, {
      operation: 'update_supplier_contact',
      status: 'failed',
      http_status: status,
      xero_object_id: warehouse.xero_contact_id,
      request_payload: payload,
      response_payload: data,
      error_message: data?.Message ?? `HTTP ${status}`,
    });
    throw new Error(`Xero supplier contact update failed: ${data?.Message ?? `HTTP ${status}`}`);
  }
  await logXeroSync(supabaseAdmin, {
    operation: 'update_supplier_contact',
    status: 'success',
    http_status: status,
    xero_object_id: warehouse.xero_contact_id,
    request_payload: payload,
    response_payload: data?.Contacts?.[0] ?? data,
  });
}

// Xero requires every invoice/PO line to specify an AccountCode and TaxType.
// Most Xero orgs ship with these standard chart-of-accounts codes preconfigured:
//   200 = Sales (revenue)
//   300 = Purchases (cost of goods sold)
// And the AU GST tax types:
//   OUTPUT2 = "GST on Income"   (sales invoices)
//   INPUT2  = "GST on Expenses" (purchase orders)
// Demo / non-AU orgs typically DON'T have these tax types — use NONE there.
//
// Override precedence:
//   marketplace_xero_credentials column → env var → hardcoded default
//
// Chem Connect's exact pattern.
const DEFAULT_REVENUE_ACCOUNT = '200';
const DEFAULT_PURCHASE_ACCOUNT = '300';
const DEFAULT_SALES_TAX_TYPE = 'OUTPUT2';
const DEFAULT_PURCHASE_TAX_TYPE = 'INPUT2';

function resolveRevenueAccount(creds: any): string {
  return creds?.revenueAccountCode || Deno.env.get('XERO_REVENUE_ACCOUNT_CODE') || DEFAULT_REVENUE_ACCOUNT;
}
function resolveFreightAccount(creds: any): string {
  return creds?.freightAccountCode
    || Deno.env.get('XERO_FREIGHT_ACCOUNT_CODE')
    || resolveRevenueAccount(creds);
}
function resolvePurchaseAccount(): string {
  return Deno.env.get('XERO_PURCHASE_ACCOUNT_CODE') || DEFAULT_PURCHASE_ACCOUNT;
}
function resolveSalesTaxType(creds: any): string {
  return Deno.env.get('XERO_SALES_TAX_TYPE')
    || creds?.gstTaxType
    || DEFAULT_SALES_TAX_TYPE;
}
function resolvePurchaseTaxType(): string {
  return Deno.env.get('XERO_PURCHASE_TAX_TYPE') || DEFAULT_PURCHASE_TAX_TYPE;
}
/**
 * Returns the CurrencyCode to put on the invoice/PO, or undefined to omit
 * (Xero then uses the org's base currency). XERO_CURRENCY=AUTO maps to
 * undefined; any other value (AUD/USD/etc.) is used verbatim.
 */
function resolveCurrencyCode(): string | undefined {
  const raw = Deno.env.get('XERO_CURRENCY') || 'AUD';
  return raw.toUpperCase() === 'AUTO' ? undefined : raw;
}

function buildInvoiceLineItems(order: any, items: any[], creds: any) {
  const revenueAcct = resolveRevenueAccount(creds);
  const freightAcct = resolveFreightAccount(creds);
  const taxType = resolveSalesTaxType(creds);
  const lines: any[] = [];
  for (const it of items) {
    lines.push({
      Description: `${it.product_name} — ${it.packaging_size_name}`,
      Quantity: it.quantity,
      UnitAmount: Number(it.unit_price_ex_gst),
      AccountCode: revenueAcct,
      TaxType: taxType,
      LineAmount: Number(it.line_subtotal_ex_gst),
    });
  }
  if (Number(order.freight_ex_gst) > 0) {
    lines.push({
      Description: 'Freight',
      Quantity: 1,
      UnitAmount: Number(order.freight_ex_gst),
      AccountCode: freightAcct,
      TaxType: taxType,
      LineAmount: Number(order.freight_ex_gst),
    });
  }
  // When TaxType is NONE (demo / non-AU orgs), Xero won't auto-calculate
  // GST. Add an explicit GST line so the Xero invoice total matches the
  // platform total. In production AU orgs with OUTPUT2 the GST is rolled
  // into each line automatically and this branch is skipped.
  if (taxType === 'NONE' && Number(order.gst_amount) > 0) {
    lines.push({
      Description: 'GST (10%)',
      Quantity: 1,
      UnitAmount: Number(order.gst_amount),
      AccountCode: revenueAcct,
      TaxType: 'NONE',
      LineAmount: Number(order.gst_amount),
    });
  }
  return lines;
}

export async function createInvoiceForOrder(
  supabaseAdmin: any,
  order: any,
  items: any[],
): Promise<{ invoice_id: string; invoice_number: string; status: string }> {
  const creds = await getValidXeroCreds(supabaseAdmin);
  const contactId = await upsertContact(supabaseAdmin, creds, order.buyer_company);

  const currencyCode = resolveCurrencyCode();
  const invoicePayload = {
    Invoices: [{
      Type: 'ACCREC',
      Contact: { ContactID: contactId },
      Date: new Date().toISOString().slice(0, 10),
      DueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      LineAmountTypes: 'Exclusive',
      Reference: order.order_number,
      InvoiceNumber: undefined,
      Status: 'AUTHORISED',
      BrandingThemeID: creds.brandingThemeId ?? undefined,
      LineItems: buildInvoiceLineItems(order, items, creds),
      ...(currencyCode ? { CurrencyCode: currencyCode } : {}),
    }],
  };

  const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/Invoices', invoicePayload);
  if (status >= 300) {
    await logXeroSync(supabaseAdmin, {
      order_id: order.id,
      operation: 'create_invoice',
      status: 'failed',
      http_status: status,
      request_payload: invoicePayload,
      response_payload: data,
      error_message: data?.Message ?? `HTTP ${status}`,
    });
    throw new Error(`Xero invoice create failed: ${data?.Message ?? `HTTP ${status}`}`);
  }
  const inv = data?.Invoices?.[0];
  if (!inv?.InvoiceID) throw new Error('Xero invoice response missing InvoiceID');

  await supabaseAdmin
    .from('marketplace_orders')
    .update({
      xero_invoice_id: inv.InvoiceID,
      xero_invoice_number: inv.InvoiceNumber,
      xero_invoice_status: inv.Status,
    })
    .eq('id', order.id);

  await logXeroSync(supabaseAdmin, {
    order_id: order.id,
    operation: 'create_invoice',
    status: 'success',
    http_status: status,
    xero_object_id: inv.InvoiceID,
    request_payload: invoicePayload,
    response_payload: inv,
  });

  return { invoice_id: inv.InvoiceID, invoice_number: inv.InvoiceNumber, status: inv.Status };
}

export async function createPurchaseOrderForOrder(
  supabaseAdmin: any,
  order: any,
  items: any[],
  warehouse:
    | {
        id?: string | null;
        name?: string | null;
        contact_email?: string | null;
        is_supplier_managed?: boolean | null;
        xero_contact_id?: string | null;
        xero_contact_details?: any;
      }
    | null,
): Promise<{ po_id: string | null; po_number?: string; status: string }> {
  // Skip the Xero PO when the warehouse is Elora's own (not a third-party
  // supplier). A PO from Elora to itself has no business meaning — Xero
  // POs are only relevant when we're purchasing inventory or fulfilment
  // services from an external supplier. Log a "skipped" row so an admin
  // can see why the PO did NOT appear in Xero.
  if (warehouse && warehouse.is_supplier_managed === false) {
    await logXeroSync(supabaseAdmin, {
      operation: 'create_po',
      status: 'skipped',
      error_message: `Skipped: warehouse "${warehouse.name ?? warehouse.id ?? 'unknown'}" is Elora's own — no PO sent to self.`,
      request_payload: { order_id: order?.id, warehouse_id: warehouse?.id },
    });
    return { po_id: null, status: 'SKIPPED' };
  }

  const creds = await getValidXeroCreds(supabaseAdmin);

  // Resolve the supplier's Xero contact:
  //   1. If the warehouse already has xero_contact_id stored, use it directly.
  //   2. Otherwise lazily upsert a supplier contact from whatever fields we
  //      have on the warehouse row (name, email, address — but no ABN or
  //      primary person). Admin can register the warehouse properly via the
  //      Customer Marketplace Access / Warehouses UI to populate the rich
  //      fields on Xero.
  //   3. As a last-ditch fallback, post the PO with a bare Name so it doesn't
  //      get blocked — admin can attach the contact later in Xero UI.
  let supplierContactId: string | undefined = (warehouse as any)?.xero_contact_id ?? undefined;
  if (!supplierContactId && warehouse) {
    try {
      supplierContactId = await upsertSupplierContact(supabaseAdmin, creds, {
        id: warehouse.id ?? '',
        name: warehouse.name ?? 'Warehouse',
        xero_contact_id: null,
        contact_email: (warehouse as any).contact_email ?? null,
        xero_contact_details: (warehouse as any).xero_contact_details ?? {},
      });
    } catch (e: any) {
      // Don't abort the PO over a contact issue — log + continue with Name.
      console.warn('Lazy supplier-contact upsert failed:', e?.message ?? e);
    }
  }

  const poCurrencyCode = resolveCurrencyCode();
  const poTaxType = resolvePurchaseTaxType();
  const poAccount = resolvePurchaseAccount();
  const poPayload = {
    PurchaseOrders: [{
      Contact: supplierContactId ? { ContactID: supplierContactId } : { Name: warehouse?.name ?? 'Warehouse' },
      Date: new Date().toISOString().slice(0, 10),
      Reference: order.order_number,
      LineAmountTypes: 'Exclusive',
      Status: 'AUTHORISED',
      DeliveryAddress: [
        order.delivery_address?.line1,
        order.delivery_address?.line2,
        order.delivery_address?.suburb,
        order.delivery_address?.state,
        order.delivery_postcode,
      ].filter(Boolean).join('\n'),
      LineItems: items.map((it: any) => ({
        Description: `${it.product_name} — ${it.packaging_size_name}`,
        Quantity: it.quantity,
        UnitAmount: Number(it.unit_price_ex_gst),
        AccountCode: poAccount,
        TaxType: poTaxType,
      })),
      ...(poCurrencyCode ? { CurrencyCode: poCurrencyCode } : {}),
    }],
  };

  const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/PurchaseOrders', poPayload);
  if (status >= 300) {
    await logXeroSync(supabaseAdmin, {
      order_id: order.id,
      operation: 'create_po',
      status: 'failed',
      http_status: status,
      request_payload: poPayload,
      response_payload: data,
      error_message: data?.Message ?? `HTTP ${status}`,
    });
    throw new Error(`Xero PO create failed: ${data?.Message ?? `HTTP ${status}`}`);
  }
  const po = data?.PurchaseOrders?.[0];
  if (!po?.PurchaseOrderID) throw new Error('Xero PO response missing PurchaseOrderID');

  await supabaseAdmin
    .from('marketplace_orders')
    .update({
      xero_po_id: po.PurchaseOrderID,
      xero_po_number: po.PurchaseOrderNumber ?? null,
      xero_po_status: po.Status,
    })
    .eq('id', order.id);

  await logXeroSync(supabaseAdmin, {
    order_id: order.id,
    operation: 'create_po',
    status: 'success',
    http_status: status,
    xero_object_id: po.PurchaseOrderID,
    request_payload: poPayload,
    response_payload: po,
  });

  return { po_id: po.PurchaseOrderID, po_number: po.PurchaseOrderNumber, status: po.Status };
}
