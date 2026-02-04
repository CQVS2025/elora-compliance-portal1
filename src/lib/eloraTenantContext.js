/**
 * Elora (ACATC) tenant context for API calls.
 * Used by query options to apply tenant isolation:
 * - APIs that support customer/site filter: inject customer_id/customerRef in request.
 * - APIs that don't support filter (Customers, Sites): filter response on client by this ref.
 *
 * Set by AuthContext when profile loads; cleared on logout.
 */

let companyEloraCustomerRef = null;
let isSuperAdmin = false;

/**
 * Set tenant context (call from AuthContext when profile loads).
 * @param {{ companyEloraCustomerRef: string | null, isSuperAdmin: boolean }} ctx
 */
export function setEloraTenantContext(ctx) {
  companyEloraCustomerRef = ctx?.companyEloraCustomerRef?.trim() || null;
  isSuperAdmin = !!ctx?.isSuperAdmin;
}

/**
 * Clear tenant context (call on logout).
 */
export function clearEloraTenantContext() {
  companyEloraCustomerRef = null;
  isSuperAdmin = false;
}

/**
 * Get current tenant context (sync, for use in query options).
 * @returns {{ companyEloraCustomerRef: string | null, isSuperAdmin: boolean }}
 */
export function getEloraTenantContext() {
  return { companyEloraCustomerRef, isSuperAdmin };
}
