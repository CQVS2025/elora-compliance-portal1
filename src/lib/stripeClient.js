import { loadStripe } from '@stripe/stripe-js';

/**
 * Singleton loader for the Stripe JS SDK. The publishable key comes from the
 * VITE_STRIPE_PUBLISHABLE_KEY env var (safe to expose — only the secret key
 * is sensitive, and that lives in Supabase Edge Function secrets).
 *
 * Returns a Promise<Stripe | null>. Returns null (and logs a warning) when
 * the key isn't configured, so the caller can render a fallback UI instead
 * of crashing.
 */
let stripePromise = null;

export function getStripe() {
  if (stripePromise) return stripePromise;
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.warn(
      'VITE_STRIPE_PUBLISHABLE_KEY is not set. Card checkout will not work — add it to .env.local and reload.',
    );
    stripePromise = Promise.resolve(null);
    return stripePromise;
  }
  stripePromise = loadStripe(key);
  return stripePromise;
}
