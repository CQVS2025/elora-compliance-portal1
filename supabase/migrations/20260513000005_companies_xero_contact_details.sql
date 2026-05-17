-- ============================================================================
-- Marketplace · Per-buyer Xero contact details
--
-- Background
-- ----------
-- Xero contacts hold significantly more than Name + Email — invoices and POs
-- look professional only when the contact has the ABN, postal address,
-- phone, primary person, website, etc. We were previously sending only:
--   { Name, EmailAddress }
-- so every contact was missing all of that.
--
-- This migration adds a single jsonb column on companies that captures the
-- structured Xero contact payload (mapped to the Xero API shape). The shared
-- marketplaceXero.ts client reads it before POSTing /Contacts.
--
-- Schema of xero_contact_details (matches Xero's POST /Contacts body, all
-- fields optional — Name comes from companies.name, EmailAddress falls back
-- to companies.marketplace_invoice_email, address fallback to
-- companies.marketplace_default_address):
-- {
--   "first_name": "Jane",
--   "last_name": "Doe",
--   "email_address": "ap@buyer.com",
--   "tax_number": "12 345 678 901",        // ABN
--   "phone": { "country_code": "61", "area_code": "02", "number": "9000 0000" },
--   "website": "https://buyer.com.au",
--   "account_number": "BUYER-100",         // optional cross-ref
--   "billing_address": {
--     "line1": "PO Box 123", "line2": "", "city": "Sydney", "region": "NSW",
--     "postcode": "2000", "country": "Australia"
--   },
--   "delivery_address": { ... same shape ... },
--   "contact_persons": [
--     { "first_name": "John", "last_name": "Smith",
--       "email_address": "john@buyer.com", "include_in_emails": true }
--   ]
-- }
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS xero_contact_details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN companies.xero_contact_details IS
  'Structured Xero contact payload (ABN, phone, primary person, billing + delivery addresses, website). Read by marketplaceXero.ts upsertContact() when registering/updating the company in Xero. Empty object {} means "fall back to the minimal Name + invoice email".';
