/**
 * Australian postcode validation for the marketplace checkout.
 *
 * Three postcode ranges look like normal 4-digit codes but aren't routable to
 * a street address — they're Large Volume Receiver (LVR) / PO-box-only ranges:
 *
 *   1000–1999  NSW LVR     ← real CBD is 2000 (Sydney)
 *   8000–8999  VIC LVR     ← real CBD is 3000 (Melbourne)
 *   9000–9999  QLD LVR     ← real CBD is 4000 (Brisbane)
 *
 * Letting one of these reach the freight engine wastes a Google Distance
 * Matrix call (ZERO_RESULTS / NOT_FOUND every time) and shows the buyer a
 * "we couldn't quote" message with no actionable suggestion. We catch it on
 * the client first AND on the server as defence in depth.
 */

const LVR_RANGES = [
  { test: /^1\d{3}$/, region: 'NSW', cbd: '2000 (Sydney CBD)' },
  { test: /^8\d{3}$/, region: 'VIC', cbd: '3000 (Melbourne CBD)' },
  { test: /^9\d{3}$/, region: 'QLD', cbd: '4000 (Brisbane CBD)' },
];

export function isPoBoxPostcode(postcode) {
  const s = String(postcode ?? '').trim();
  return LVR_RANGES.some((r) => r.test.test(s));
}

/**
 * Returns `null` when the postcode is valid for delivery, or a structured
 * error when it's not.
 *
 * Note: this does NOT verify a real street address exists at the postcode —
 * Google handles that via ZERO_RESULTS. This just rejects the three ranges
 * we know with certainty are PO-box-only.
 */
export function validateAuPostcode(postcode) {
  const s = String(postcode ?? '').trim();
  if (s.length === 0) return null; // empty is "not yet entered", not invalid
  if (!/^\d{1,4}$/.test(s)) {
    return {
      code: 'not_numeric',
      title: 'Postcode must be 4 digits.',
      detail: 'Australian postcodes are 4 numeric digits, e.g. 2000.',
    };
  }
  if (s.length < 4) {
    return {
      code: 'too_short',
      title: 'Postcode must be 4 digits.',
      detail: 'Keep typing — Australian postcodes are 4 digits long.',
    };
  }
  const lvr = LVR_RANGES.find((r) => r.test.test(s));
  if (lvr) {
    return {
      code: 'po_box_range',
      title: `Postcode ${s} is a PO Box range, not a street address.`,
      detail: `Postcodes in the ${lvr.region} LVR range can't accept freight deliveries. Use the buyer's actual street-address postcode — for example, ${lvr.cbd}.`,
    };
  }
  return null;
}

/**
 * Pre-flight check before firing the freight-quote network call. Returns
 * true when the postcode is safe to send to Google.
 */
export function isPostcodeQuotable(postcode) {
  const s = String(postcode ?? '').trim();
  return /^\d{4}$/.test(s) && !isPoBoxPostcode(s);
}
