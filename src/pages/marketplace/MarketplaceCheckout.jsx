import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, ArrowRight, CreditCard, Upload, FileText, Check, AlertTriangle,
  Loader2, ShoppingCart, Bookmark, Trash2, MapPin, ShieldCheck, ListChecks,
  Paperclip, X, Mail, Forklift, Receipt,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  cartOptions,
  buyerCatalogOptions,
  savedAddressesOptions,
  marketplaceSettingsOptions,
} from '@/query/options/marketplace';
import {
  useFreightQuote,
  useCreateOrder,
  useUploadPOPdf,
  useSaveDeliveryAddress,
  useDeleteSavedAddress,
} from '@/query/mutations/marketplace';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/hooks/useConfirm';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatAUD, calculateLineSubtotal } from '@/lib/marketplaceFormat';
import { HazardBadge } from '@/components/marketplace/HazardBadge';
import { getStripe } from '@/lib/stripeClient';
import {
  validateAuPostcode,
  isPostcodeQuotable,
} from '@/lib/marketplacePostcodeValidation';

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const STEP_LABELS = ['Delivery', 'Site access', 'Payment', 'Review'];

const PO_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';

/**
 * Four-step checkout — modelled on the CQVS Chem Connect flow.
 *
 *  1. Delivery       address + forklift + saved-address book
 *  2. Site access    rendered from product checkout_questions (skipped if none)
 *  3. Payment        card-style toggle + Stripe Payment Element OR PO upload
 *  4. Review         summary cards + final submit
 *
 * Stripe is integrated INLINE via the Payment Element. When the buyer picks
 * "Card payment" the backend creates a PaymentIntent and returns its
 * client_secret; we wrap that step in `<Elements>` and confirm with
 * `stripe.confirmPayment({ redirect: 'if_required' })` — the buyer never
 * leaves the page. The webhook materialises the order on
 * payment_intent.succeeded (deferred-creation contract preserved).
 *
 * PO orders are inserted immediately (status pending_approval); Stripe orders
 * only materialise after a successful PaymentIntent.
 */
export default function MarketplaceCheckout() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const userId = user?.id;

  const { data: cartItems = [], isLoading: cartLoading } = useQuery(cartOptions(companyId, userId));
  const { data: catalog = [] } = useQuery(buyerCatalogOptions(companyId));
  const { data: savedAddresses = [] } = useQuery(savedAddressesOptions(companyId, userId));
  const { data: marketplaceSettings } = useQuery(marketplaceSettingsOptions());

  const gstRate = Number(marketplaceSettings?.gst_rate ?? 0.10);
  const gstPercentLabel = `${(gstRate * 100).toFixed(gstRate * 100 % 1 === 0 ? 0 : 1)}%`;

  const freightQuote = useFreightQuote();
  const createOrder = useCreateOrder(companyId, userId);
  const uploadPO = useUploadPOPdf(companyId);
  const saveAddress = useSaveDeliveryAddress(companyId, userId);
  const deleteAddress = useDeleteSavedAddress(companyId, userId);
  const { confirm, ConfirmDialog } = useConfirm();

  // ---- Step state ----
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ---- Delivery ----
  const [delivery, setDelivery] = useState({
    line1: '',
    line2: '',
    suburb: '',
    state: '',
    postcode: '',
    contact_name: userProfile?.full_name ?? '',
    contact_phone: '',
    delivery_notes: '',
    forklift_available: '', // 'yes' | 'no' | ''
  });
  const [saveAddressChecked, setSaveAddressChecked] = useState(false);
  const [saveAddressLabel, setSaveAddressLabel] = useState('');

  // Prefill from company default address (once on mount).
  useEffect(() => {
    const def = userProfile?.company?.marketplace_default_address ?? userProfile?.marketplace_default_address;
    if (def && typeof def === 'object' && !delivery.postcode) {
      setDelivery((d) => ({
        ...d,
        line1: def.line1 ?? d.line1,
        line2: def.line2 ?? d.line2,
        suburb: def.suburb ?? d.suburb,
        state: def.state ?? d.state,
        postcode: def.postcode ?? d.postcode,
      }));
    }
  }, [userProfile, delivery.postcode]);

  // ---- Site-access answers ----
  const productIdsInCart = useMemo(
    () => Array.from(new Set(cartItems.map((i) => i.product_id))),
    [cartItems]
  );
  const { data: questionsData } = useQuery({
    queryKey: ['marketplace', 'checkout-questions', productIdsInCart],
    queryFn: async () => {
      if (productIdsInCart.length === 0) return [];
      const { data, error } = await supabase
        .from('marketplace_product_checkout_questions')
        .select('id, product_id, packaging_size_id, question_text, question_type, options, is_required, display_order')
        .in('product_id', productIdsInCart)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: productIdsInCart.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const questions = questionsData ?? [];
  const [siteAnswers, setSiteAnswers] = useState({});

  // ---- Payment ----
  const [paymentMethod, setPaymentMethod] = useState('purchase_order');
  const [poNumber, setPoNumber] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [poAttachments, setPoAttachments] = useState([]); // [{ storage_path, file_name, file_size, file_type }]
  const [termsAccepted, setTermsAccepted] = useState(false);
  const poInputRef = useRef(null);
  const [poUploading, setPoUploading] = useState(false);

  // Stripe state — populated when create_order resolves on the Stripe path.
  const [stripeClientSecret, setStripeClientSecret] = useState(null);
  const [stripeCheckoutSessionId, setStripeCheckoutSessionId] = useState(null);

  // Pre-fill invoice email from the user's email / the company default.
  useEffect(() => {
    if (!invoiceEmail) {
      const companyEmail = userProfile?.company?.marketplace_invoice_email;
      const userEmail = user?.email ?? userProfile?.email;
      const candidate = companyEmail || userEmail;
      if (candidate) setInvoiceEmail(candidate);
    }
  }, [user, userProfile, invoiceEmail]);

  // ---- Pricing + live freight ----
  const priceLookup = useMemo(() => {
    const m = new Map();
    catalog.forEach((p) => {
      (p.prices ?? []).forEach((row) => {
        m.set(`${p.id}::${row.packaging_size_id}`, row);
      });
    });
    return m;
  }, [catalog]);

  const enrichedLines = useMemo(
    () =>
      cartItems.map((item) => {
        const priceRow = priceLookup.get(`${item.product_id}::${item.packaging_size_id}`);
        const subtotal = priceRow
          ? calculateLineSubtotal({
              priceType: priceRow.price_type,
              pricePerLitre: priceRow.price_per_litre,
              fixedPrice: priceRow.fixed_price,
              volumeLitres: item.packaging_size?.volume_litres ?? priceRow.packaging_size?.volume_litres,
              quantity: item.quantity,
            })
          : null;
        return { ...item, priceRow, subtotal };
      }),
    [cartItems, priceLookup]
  );

  const subtotalExGst = enrichedLines.reduce((s, l) => s + (l.subtotal?.lineSubtotalExGst ?? 0), 0);

  // Re-fetch freight when address fields change (debounced).
  const cartSig = useMemo(
    () => JSON.stringify((cartItems ?? []).map((c) => [c.product_id, c.packaging_size_id, c.quantity])),
    [cartItems],
  );
  const [liveQuote, setLiveQuote] = useState(null);
  useEffect(() => {
    const pc = String(delivery.postcode ?? '').trim();
    // Short-circuit on unquotable postcodes: empty, too short, non-numeric, or
    // a known LVR / PO-box range. Saves a Google Distance Matrix call per
    // keystroke and prevents a stale stub quote from sitting under the form.
    if (!isPostcodeQuotable(pc) || cartItems.length === 0) {
      setLiveQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const result = await freightQuote.mutateAsync({
          lines: cartItems.map((c) => ({
            product_id: c.product_id,
            packaging_size_id: c.packaging_size_id,
            quantity: c.quantity,
          })),
          delivery_postcode: pc,
          delivery_address: {
            line1: delivery.line1 || null,
            line2: delivery.line2 || null,
            suburb: delivery.suburb || null,
            state: delivery.state || null,
          },
        });
        setLiveQuote(result);
      } catch {
        // surfaced via UI state — no toast here, the warning banner shows it
      }
    }, 400);
    return () => clearTimeout(t);
    // Stability: include cartSig (memoised stable string of cart contents)
    // but NOT freightQuote — its identity flips on isPending changes and
    // would re-trigger the effect into an infinite loop.
  }, [delivery.postcode, delivery.line1, delivery.line2, delivery.suburb, delivery.state, cartSig]);

  const freightExGst = liveQuote?.total_freight_ex_gst ?? 0;
  const gst = (subtotalExGst + freightExGst) * gstRate;
  const total = subtotalExGst + freightExGst + gst;

  // ---- Validation ----
  const postcodeError = validateAuPostcode(delivery.postcode);
  const deliveryValid = !!(
    delivery.line1.trim() &&
    delivery.suburb.trim() &&
    delivery.state.trim() &&
    /^\d{4}$/.test(String(delivery.postcode).trim()) &&
    !postcodeError &&
    delivery.contact_name.trim() &&
    (delivery.forklift_available === 'yes' || delivery.forklift_available === 'no') &&
    !liveQuote?.blocked &&
    !freightQuote.isPending // wait for the live quote so we never advance with a stale stub
  );

  const siteAccessValid = useMemo(() => {
    if (questions.length === 0) return true;
    return questions.filter((q) => q.is_required).every((q) => {
      const a = siteAnswers[q.id];
      if (q.question_type === 'boolean') return a === true || a === false;
      if (q.question_type === 'number') return a != null && String(a).length > 0;
      if (q.question_type === 'single_select') return !!a;
      return typeof a === 'string' && a.trim().length > 0;
    });
  }, [questions, siteAnswers]);

  const paymentValid =
    paymentMethod === 'stripe'
      ? true
      : !!(poNumber.trim() && invoiceEmail.trim() && poAttachments.length > 0 && termsAccepted);

  // ---- PO file handlers ----
  const handlePOSelect = async (files) => {
    if (!files || files.length === 0) return;
    setPoUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const result = await uploadPO.mutateAsync({ file });
        uploaded.push(result);
      }
      setPoAttachments((prev) => [...prev, ...uploaded]);
      toastSuccess('upload', `${uploaded.length} file${uploaded.length === 1 ? '' : 's'}`);
    } catch (err) {
      toastError(err, 'uploading attachment');
    } finally {
      setPoUploading(false);
      if (poInputRef.current) poInputRef.current.value = '';
    }
  };

  const removeAttachment = (path) =>
    setPoAttachments((prev) => prev.filter((a) => a.storage_path !== path));

  // ---- Step navigation ----
  const goNext = useCallback(async () => {
    if (step === 0) {
      if (!deliveryValid) return;
      // If "save address" was ticked, persist before advancing.
      if (saveAddressChecked) {
        try {
          await saveAddress.mutateAsync({
            label: saveAddressLabel,
            line1: delivery.line1,
            line2: delivery.line2,
            suburb: delivery.suburb,
            state: delivery.state,
            postcode: delivery.postcode,
            contact_name: delivery.contact_name,
            contact_phone: delivery.contact_phone,
          });
          toastSuccess('Address saved to your address book');
          setSaveAddressChecked(false);
          setSaveAddressLabel('');
        } catch (e) {
          toastError(e?.message ?? 'Could not save address');
        }
      }
      setStep(questions.length > 0 ? 1 : 2);
      return;
    }
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (!paymentValid) return;
      // If Stripe selected and we don't have a clientSecret yet, create the
      // checkout session + PaymentIntent now so the Review step can mount
      // the Payment Element inline.
      if (paymentMethod === 'stripe' && !stripeClientSecret) {
        try {
          setSubmitting(true);
          const payload = buildCreateOrderPayload();
          const result = await createOrder.mutateAsync(payload);
          if (!result?.client_secret) {
            throw new Error('Stripe payment could not be initialised. Try again.');
          }
          setStripeClientSecret(result.client_secret);
          setStripeCheckoutSessionId(result.checkout_session_id);
        } catch (e) {
          toastError(e, 'preparing card payment');
          setSubmitting(false);
          return;
        } finally {
          setSubmitting(false);
        }
      }
      setStep(3);
      return;
    }
    // step 3 is the final review — submit handled by its own button
  }, [step, deliveryValid, paymentValid, paymentMethod, stripeClientSecret, questions.length, saveAddressChecked, saveAddressLabel, delivery, saveAddress, createOrder]);

  const goBack = () => {
    if (step === 0) navigate('/marketplace/cart');
    else if (step === 1) setStep(0);
    else if (step === 2) setStep(questions.length > 0 ? 1 : 0);
    else if (step === 3) setStep(2);
  };

  // ---- Submit ----
  const buildCreateOrderPayload = useCallback(() => ({
    delivery_address: {
      line1: delivery.line1,
      line2: delivery.line2 || null,
      suburb: delivery.suburb,
      state: delivery.state,
      postcode: delivery.postcode,
    },
    delivery_postcode: String(delivery.postcode).trim(),
    delivery_contact_name: delivery.contact_name,
    delivery_contact_phone: delivery.contact_phone || null,
    delivery_notes: delivery.delivery_notes || null,
    forklift_available: delivery.forklift_available === 'yes',
    invoice_email: paymentMethod === 'purchase_order' ? invoiceEmail.trim() || null : null,
    site_access_answers: siteAnswers,
    payment_method: paymentMethod,
    po_number: paymentMethod === 'purchase_order' ? poNumber.trim() : null,
    po_attachments: paymentMethod === 'purchase_order' ? poAttachments.map((a) => ({
      path: a.storage_path,
      name: a.file_name,
      size: a.file_size,
      type: a.file_type,
    })) : null,
    po_pdf_path: paymentMethod === 'purchase_order' ? poAttachments[0]?.storage_path ?? null : null,
    terms_accepted: paymentMethod === 'purchase_order' ? termsAccepted : null,
  }), [delivery, paymentMethod, poNumber, poAttachments, invoiceEmail, siteAnswers, termsAccepted]);

  const handleSubmitPO = useCallback(async () => {
    if (submitting) return;
    if (liveQuote?.blocked) {
      toastError(new Error(liveQuote.notes?.[0] ?? 'Order blocked by freight rules.'), 'submitting order');
      return;
    }
    const ok = await confirm({
      title: 'Submit this order?',
      description: `${cartItems.length} item${cartItems.length === 1 ? '' : 's'} • ${formatAUD(total)} incl. GST. Order will sit in "Pending Approval" until Elora confirms.`,
      confirmLabel: 'Submit order',
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const result = await createOrder.mutateAsync(buildCreateOrderPayload());
      toastSuccess('create', `order ${result.order_number}`);
      navigate(`/marketplace/orders/${result.order_id}`);
    } catch (err) {
      toastError(err, 'submitting order');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, liveQuote, confirm, cartItems.length, total, createOrder, buildCreateOrderPayload, navigate]);

  // ---- Render guards ----
  if (cartLoading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!cartLoading && cartItems.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-medium mb-1">Your cart is empty.</p>
            <p className="text-sm text-muted-foreground mb-4">Add items to the cart before checking out.</p>
            <Button asChild>
              <a href="/marketplace">Browse marketplace</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Which steps are visible (we skip "Site access" entirely when no questions).
  const visibleSteps = questions.length > 0 ? STEP_LABELS : STEP_LABELS.filter((_l, i) => i !== 1);
  const visibleIndex = step <= 0 ? 0 : (questions.length > 0 ? step : step - 1);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace/cart')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to cart
      </Button>

      <div className="mb-6 flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-xs text-muted-foreground">
          {visibleSteps[visibleIndex]} · step {visibleIndex + 1} of {visibleSteps.length}
        </p>
      </div>

      <Stepper labels={visibleSteps} activeIndex={visibleIndex} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {step === 0 && (
            <StepWrap key="delivery">
              <DeliveryStep
                delivery={delivery}
                setDelivery={setDelivery}
                savedAddresses={savedAddresses}
                onApplySavedAddress={(a) => {
                  if (!a) return;
                  setDelivery((d) => ({
                    ...d,
                    line1: a.line1 ?? '',
                    line2: a.line2 ?? '',
                    suburb: a.suburb ?? '',
                    state: a.state ?? '',
                    postcode: a.postcode ?? '',
                    contact_name: a.contact_name || d.contact_name,
                    contact_phone: a.contact_phone || d.contact_phone,
                  }));
                }}
                onDeleteSavedAddress={async (id) => {
                  const ok = await confirm({
                    title: 'Remove this saved address?',
                    description: 'It will no longer appear in your address book.',
                    confirmLabel: 'Remove',
                    destructive: true,
                  });
                  if (!ok) return;
                  try {
                    await deleteAddress.mutateAsync(id);
                    toastSuccess('Address removed');
                  } catch (e) {
                    toastError(e?.message ?? 'Could not remove address');
                  }
                }}
                saveAddressChecked={saveAddressChecked}
                setSaveAddressChecked={setSaveAddressChecked}
                saveAddressLabel={saveAddressLabel}
                setSaveAddressLabel={setSaveAddressLabel}
                savingAddress={saveAddress.isPending}
                freightLoading={freightQuote.isPending}
                liveQuote={liveQuote}
                postcodeError={postcodeError}
                onContinue={goNext}
                continueValid={deliveryValid}
              />
            </StepWrap>
          )}

          {step === 1 && questions.length > 0 && (
            <StepWrap key="site-access">
              <SiteAccessStep
                questions={questions}
                answers={siteAnswers}
                setAnswers={setSiteAnswers}
                valid={siteAccessValid}
                onBack={goBack}
                onContinue={goNext}
              />
            </StepWrap>
          )}

          {step === 2 && (
            <StepWrap key="payment">
              <PaymentStep
                paymentMethod={paymentMethod}
                setPaymentMethod={(m) => {
                  setPaymentMethod(m);
                  // Drop any half-prepared Stripe state so the next attempt
                  // re-creates the PaymentIntent with the right method.
                  setStripeClientSecret(null);
                  setStripeCheckoutSessionId(null);
                }}
                poNumber={poNumber}
                setPoNumber={setPoNumber}
                invoiceEmail={invoiceEmail}
                setInvoiceEmail={setInvoiceEmail}
                poAttachments={poAttachments}
                onUploadFiles={handlePOSelect}
                onRemoveFile={removeAttachment}
                poInputRef={poInputRef}
                poUploading={poUploading}
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                valid={paymentValid}
                preparing={submitting && paymentMethod === 'stripe'}
                onBack={goBack}
                onContinue={goNext}
                blocked={liveQuote?.blocked}
                blockedReason={liveQuote?.notes?.[0]}
              />
            </StepWrap>
          )}

          {step === 3 && (
            <StepWrap key="review">
              <ReviewStep
                delivery={delivery}
                cartItems={enrichedLines}
                paymentMethod={paymentMethod}
                poNumber={poNumber}
                invoiceEmail={invoiceEmail}
                poAttachments={poAttachments}
                liveQuote={liveQuote}
                total={total}
                gstPercentLabel={gstPercentLabel}
                onBack={goBack}
                onSubmitPO={handleSubmitPO}
                stripeClientSecret={stripeClientSecret}
                stripeCheckoutSessionId={stripeCheckoutSessionId}
                submitting={submitting}
                blocked={liveQuote?.blocked}
                blockedReason={liveQuote?.notes?.[0]}
              />
            </StepWrap>
          )}
        </div>

        <OrderSummary
          lines={enrichedLines}
          subtotalExGst={subtotalExGst}
          freightExGst={freightExGst}
          gst={gst}
          gstPercentLabel={gstPercentLabel}
          total={total}
          liveQuote={liveQuote}
          freightLoading={freightQuote.isPending}
        />
      </div>
      {ConfirmDialog}
    </div>
  );
}

// ============================================================================
// Step indicator (round chips with check-marks + progress line)
// ============================================================================
function Stepper({ labels, activeIndex }) {
  return (
    <div className="flex items-center justify-center flex-wrap gap-y-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`flex w-8 h-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                i < activeIndex
                  ? 'bg-primary text-primary-foreground'
                  : i === activeIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < activeIndex ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`hidden sm:inline text-sm font-medium ${
                i <= activeIndex ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div
              className={`mx-3 sm:mx-4 h-px w-8 sm:w-16 transition-colors ${
                i < activeIndex ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function StepWrap({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Step 0 — Delivery
// ============================================================================
function DeliveryStep({
  delivery, setDelivery, savedAddresses, onApplySavedAddress, onDeleteSavedAddress,
  saveAddressChecked, setSaveAddressChecked, saveAddressLabel, setSaveAddressLabel,
  savingAddress, freightLoading, liveQuote, postcodeError, onContinue, continueValid,
}) {
  const update = (k, v) => setDelivery((d) => ({ ...d, [k]: v }));
  // Postcode handler: strip non-digits and cap at 4 chars so a buyer can't
  // type "12345" or "ab12". Anything semantically wrong (PO-box range, etc.)
  // is caught by postcodeError downstream and shown inline.
  const onPostcodeChange = (raw) => {
    const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 4);
    update('postcode', digits);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> Delivery details</CardTitle>
        <CardDescription>
          Where should this order be delivered? The full address is used to quote freight via Google Maps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedAddresses.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Your saved addresses</Label>
            <div className="flex flex-wrap gap-2">
              <Select onValueChange={(id) => onApplySavedAddress(savedAddresses.find((a) => a.id === id))}>
                <SelectTrigger className="max-w-xs"><SelectValue placeholder="Use a saved address…" /></SelectTrigger>
                <SelectContent>
                  {savedAddresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label || `${a.line1}, ${a.suburb}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {savedAddresses.map((a) => (
                <Badge key={a.id} variant="outline" className="text-xs flex items-center gap-1">
                  <Bookmark className="w-3 h-3" /> {a.label || a.line1}
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-rose-600"
                    onClick={() => onDeleteSavedAddress(a.id)}
                    aria-label="Remove saved address"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="line1">Street address <span className="text-rose-600">*</span></Label>
          <Input id="line1" placeholder="42 Industrial Drive" value={delivery.line1} onChange={(e) => update('line1', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="line2">Address line 2 <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="line2" placeholder="Suite, building, etc." value={delivery.line2} onChange={(e) => update('line2', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="suburb">Suburb / City <span className="text-rose-600">*</span></Label>
            <Input id="suburb" placeholder="Mildura" value={delivery.suburb} onChange={(e) => update('suburb', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State <span className="text-rose-600">*</span></Label>
            <Select value={delivery.state} onValueChange={(v) => update('state', v)}>
              <SelectTrigger id="state"><SelectValue placeholder="VIC" /></SelectTrigger>
              <SelectContent>
                {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode <span className="text-rose-600">*</span></Label>
            <Input
              id="postcode"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              placeholder="3500"
              value={delivery.postcode}
              onChange={(e) => onPostcodeChange(e.target.value)}
              aria-invalid={postcodeError ? true : undefined}
              aria-describedby={postcodeError ? 'postcode-error' : undefined}
              className={postcodeError ? 'border-rose-400 focus-visible:ring-rose-400' : undefined}
            />
            {postcodeError && (
              <p id="postcode-error" className="text-[11px] text-rose-600 dark:text-rose-400 leading-snug">
                <strong>{postcodeError.title}</strong> {postcodeError.detail}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="forklift" className="flex items-center gap-1.5">
              <Forklift className="w-3.5 h-3.5" /> Forklift on site <span className="text-rose-600">*</span>
            </Label>
            <Select value={delivery.forklift_available} onValueChange={(v) => update('forklift_available', v)}>
              <SelectTrigger id="forklift"><SelectValue placeholder="Select forklift availability" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Forklift available on site</SelectItem>
                <SelectItem value="no">No forklift on site (tailgate truck required)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Tailgate trucks are more expensive, so let us know which one to dispatch.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact name <span className="text-rose-600">*</span></Label>
            <Input id="contact_name" placeholder="Jane Smith" value={delivery.contact_name} onChange={(e) => update('contact_name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact phone</Label>
            <Input id="contact_phone" placeholder="+61 4xx xxx xxx" value={delivery.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delivery_notes">Delivery notes</Label>
          <Textarea id="delivery_notes" rows={3} placeholder="Gate code, call on arrival, etc." value={delivery.delivery_notes} onChange={(e) => update('delivery_notes', e.target.value)} />
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={saveAddressChecked} onCheckedChange={(v) => setSaveAddressChecked(!!v)} disabled={savingAddress} />
            <span className="text-sm flex items-center gap-1.5"><Bookmark className="w-3.5 h-3.5" /> Save this address for future orders</span>
          </label>
          {saveAddressChecked && (
            <div className="pl-6">
              <Input placeholder='Label (e.g. "Head office")' value={saveAddressLabel} onChange={(e) => setSaveAddressLabel(e.target.value)} />
            </div>
          )}
        </div>

        {liveQuote?.blocked && (
          <FreightWarn message={liveQuote.notes?.[0] ?? 'This order cannot proceed with the current address.'} />
        )}
        {freightLoading && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Refreshing freight quote…
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={onContinue} disabled={!continueValid}>
            Continue <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Step 1 — Site access
// ============================================================================
function SiteAccessStep({ questions, answers, setAnswers, valid, onBack, onContinue }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5" /> Site access</CardTitle>
        <CardDescription>
          A few questions from the products in your cart so the driver can deliver safely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q) => (
          <QuestionField key={q.id} question={q} answer={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        ))}
        <div className="flex justify-between pt-1">
          <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
          <Button onClick={onContinue} disabled={!valid}>Continue <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionField({ question, answer, onChange }) {
  const required = question.is_required ? <span className="text-rose-600">*</span> : null;
  if (question.question_type === 'boolean') {
    return (
      <div className="space-y-1.5">
        <Label>{question.question_text} {required}</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={answer === true ? 'default' : 'outline'} onClick={() => onChange(true)}>Yes</Button>
          <Button type="button" size="sm" variant={answer === false ? 'default' : 'outline'} onClick={() => onChange(false)}>No</Button>
        </div>
      </div>
    );
  }
  if (question.question_type === 'number') {
    return (
      <div className="space-y-1.5">
        <Label>{question.question_text} {required}</Label>
        <Input type="number" value={answer ?? ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (question.question_type === 'single_select') {
    const options = Array.isArray(question.options) ? question.options : [];
    return (
      <div className="space-y-1.5">
        <Label>{question.question_text} {required}</Label>
        <Select value={answer ?? ''} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{question.question_text} {required}</Label>
      <Textarea rows={2} value={answer ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ============================================================================
// Step 2 — Payment
// ============================================================================
function PaymentStep({
  paymentMethod, setPaymentMethod,
  poNumber, setPoNumber, invoiceEmail, setInvoiceEmail,
  poAttachments, onUploadFiles, onRemoveFile, poInputRef, poUploading,
  termsAccepted, setTermsAccepted, valid, preparing,
  onBack, onContinue, blocked, blockedReason,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Payment method</CardTitle>
        <CardDescription>Choose how you'd like to pay for this order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PaymentMethodCard
            active={paymentMethod === 'stripe'}
            onClick={() => setPaymentMethod('stripe')}
            icon={<CreditCard className="w-5 h-5 text-muted-foreground" />}
            title="Card Payment"
            subtitle="Visa, Mastercard, Amex"
          />
          <PaymentMethodCard
            active={paymentMethod === 'purchase_order'}
            onClick={() => setPaymentMethod('purchase_order')}
            icon={<FileText className="w-5 h-5 text-muted-foreground" />}
            title="Purchase Order"
            subtitle="30-day terms, on account"
          />
        </div>

        {paymentMethod === 'stripe' && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground space-y-1">
            <p>You'll enter your card details on the next step. The form is rendered inline by Stripe, so your card data never touches our servers.</p>
            <p className="text-[11px]">Powered by Stripe · 3D Secure handled automatically when required.</p>
          </div>
        )}

        {paymentMethod === 'purchase_order' && (
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="po-number">Purchase order number <span className="text-rose-600">*</span></Label>
              <Input id="po-number" placeholder="PO-2026-00482" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-email" className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Send invoice to <span className="text-rose-600">*</span>
              </Label>
              <Input id="invoice-email" type="email" placeholder="accounts@company.com" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Your invoice will be sent here. Defaults to the email on your account.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Attach purchase order <span className="text-rose-600">*</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Upload your signed PO. PDF, Word, Excel, or images accepted (max 10 MB each).
                Files are attached to the Xero invoice on approval.
              </p>

              {poAttachments.length > 0 && (
                <div className="space-y-1.5">
                  {poAttachments.map((a) => (
                    <div key={a.storage_path} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                      <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{a.file_name}</p>
                        <p className="text-[11px] text-muted-foreground">{(a.file_size / 1024).toFixed(0)} KB</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveFile(a.storage_path)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={poInputRef}
                type="file"
                accept={PO_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => onUploadFiles(e.target.files)}
              />
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => poInputRef.current?.click()} disabled={poUploading}>
                {poUploading
                  ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Uploading…</>
                  : <><Upload className="w-4 h-4 mr-1.5" /> {poAttachments.length > 0 ? 'Add more files' : 'Attach files'}</>}
              </Button>
            </div>

            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <Checkbox checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(!!v)} className="mt-0.5" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I accept Elora's <strong>30-day payment terms</strong> and confirm the PO above authorises this purchase.
              </span>
            </label>
          </div>
        )}

        {blocked && <FreightWarn message={blockedReason ?? 'This order cannot proceed.'} />}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={preparing}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
          <Button onClick={onContinue} disabled={!valid || preparing || blocked}>
            {preparing
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Preparing card payment…</>
              : <>Review order <ArrowRight className="w-4 h-4 ml-1.5" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentMethodCard({ active, onClick, icon, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-muted-foreground/40'
      }`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {active && <Check className="w-4 h-4 text-primary" />}
    </button>
  );
}

// ============================================================================
// Step 3 — Review (and inline Payment Element for Stripe)
// ============================================================================
function ReviewStep({
  delivery, cartItems, paymentMethod, poNumber, invoiceEmail, poAttachments,
  total, gstPercentLabel, onBack, onSubmitPO,
  stripeClientSecret, stripeCheckoutSessionId, submitting,
  blocked, blockedReason, liveQuote,
}) {
  return (
    <div className="space-y-5">
      {/* Delivery summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="w-4 h-4" /> Delivery address</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-0.5">
          <p className="font-medium text-foreground">{delivery.line1}</p>
          {delivery.line2 && <p>{delivery.line2}</p>}
          <p>{delivery.suburb}, {delivery.state} {delivery.postcode}</p>
          <p className="pt-1">Contact: <span className="text-foreground">{delivery.contact_name}</span>{delivery.contact_phone ? ` · ${delivery.contact_phone}` : ''}</p>
          <p>Forklift: <span className="text-foreground">{delivery.forklift_available === 'yes' ? 'Available on site' : 'Not available (tailgate truck required)'}</span></p>
          {delivery.delivery_notes && <p className="italic pt-1">Notes: {delivery.delivery_notes}</p>}
        </CardContent>
      </Card>

      {/* Payment summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {paymentMethod === 'stripe' ? <CreditCard className="w-4 h-4" /> : <FileText className="w-4 h-4" />} Payment method
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {paymentMethod === 'stripe' ? (
            <p>Card Payment via Stripe</p>
          ) : (
            <div className="space-y-1">
              <p>Purchase Order · <span className="font-medium text-foreground">{poNumber}</span></p>
              <p>Invoice to <span className="text-foreground">{invoiceEmail}</span></p>
              {poAttachments.length > 0 && (
                <p className="inline-flex items-center gap-1 text-xs">
                  <Paperclip className="w-3 h-3" /> {poAttachments.length} file{poAttachments.length === 1 ? '' : 's'} attached
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="w-4 h-4" /> Order items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{item.product?.name ?? 'Untitled item'}</p>
                <p className="text-xs text-muted-foreground">
                  {item.packaging_size?.name ?? ''} × {item.quantity}
                </p>
              </div>
              <p className="text-sm shrink-0">{formatAUD(item.subtotal?.lineSubtotalExGst ?? 0)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stripe Payment Element + Submit */}
      {paymentMethod === 'stripe' && stripeClientSecret ? (
        <StripePaymentBlock
          clientSecret={stripeClientSecret}
          checkoutSessionId={stripeCheckoutSessionId}
          total={total}
          gstPercentLabel={gstPercentLabel}
          onBack={onBack}
          blocked={blocked}
          blockedReason={blockedReason}
        />
      ) : paymentMethod === 'stripe' ? (
        // Should not normally hit — step 2 ensures clientSecret is loaded before
        // advancing. Surface a recovery affordance just in case.
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto" />
            <p className="text-sm">We couldn't load the card form. Please go back and reselect your payment method.</p>
            <Button variant="outline" onClick={onBack}>Back to payment step</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4 space-y-3">
            {liveQuote?.blocked && <FreightWarn message={liveQuote.notes?.[0] ?? 'This order cannot proceed.'} />}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={onBack} disabled={submitting}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
              <Button onClick={onSubmitPO} disabled={submitting || blocked}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting…</> : <><Receipt className="w-4 h-4 mr-1.5" /> Place order ({formatAUD(total)})</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Stripe Payment Element wrapper — mounts only when clientSecret resolves
// ============================================================================
function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function buildStripeAppearance(isDark) {
  // Stripe ships two built-in themes; we layer Elora's token palette on top
  // via the `variables` block so the card form blends in with the page.
  if (isDark) {
    return {
      theme: 'night',
      variables: {
        colorPrimary: 'hsl(210 40% 96%)',
        colorBackground: 'hsl(222 47% 6%)',
        colorText: 'hsl(210 40% 96%)',
        colorTextSecondary: 'hsl(215 20% 65%)',
        colorTextPlaceholder: 'hsl(215 16% 47%)',
        colorIconTab: 'hsl(210 40% 96%)',
        colorDanger: 'hsl(0 72% 51%)',
        borderRadius: '6px',
        spacingUnit: '4px',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      rules: {
        '.Input': {
          backgroundColor: 'hsl(222 47% 11%)',
          color: 'hsl(210 40% 96%)',
          border: '1px solid hsl(217 33% 18%)',
          boxShadow: 'none',
        },
        '.Input:focus': {
          borderColor: 'hsl(217 33% 36%)',
          boxShadow: '0 0 0 2px hsl(217 33% 18% / 0.5)',
        },
        '.Input--invalid': { borderColor: 'hsl(0 72% 51%)' },
        '.Label': {
          color: 'hsl(215 20% 75%)',
          fontWeight: '500',
        },
        '.Tab': {
          backgroundColor: 'hsl(222 47% 11%)',
          border: '1px solid hsl(217 33% 18%)',
          color: 'hsl(210 40% 96%)',
        },
        '.Tab--selected': {
          backgroundColor: 'hsl(222 47% 14%)',
          borderColor: 'hsl(210 40% 60%)',
          color: 'hsl(210 40% 96%)',
        },
        '.TabIcon, .TabLabel': {
          color: 'hsl(210 40% 96%)',
        },
        '.Block': {
          backgroundColor: 'hsl(222 47% 11%)',
          border: '1px solid hsl(217 33% 18%)',
        },
      },
    };
  }
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: 'hsl(222.2 47.4% 11.2%)',
      borderRadius: '6px',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
  };
}

function StripePaymentBlock({ clientSecret, checkoutSessionId, total, gstPercentLabel, onBack, blocked, blockedReason }) {
  const [stripePromise, setStripePromise] = useState(null);
  const isDark = useIsDarkMode();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stripe = await getStripe();
      if (!cancelled) setStripePromise(Promise.resolve(stripe));
    })();
    return () => { cancelled = true; };
  }, []);

  if (!stripePromise || !clientSecret) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading secure card form…
        </CardContent>
      </Card>
    );
  }

  const options = {
    clientSecret,
    appearance: buildStripeAppearance(isDark),
  };

  return (
    // The `key` swaps the underlying Elements provider when the theme flips
    // so Stripe rebuilds its iframe with the new appearance instead of
    // keeping the stale one.
    <Elements key={isDark ? 'dark' : 'light'} stripe={stripePromise} options={options}>
      <StripeForm
        checkoutSessionId={checkoutSessionId}
        total={total}
        gstPercentLabel={gstPercentLabel}
        onBack={onBack}
        blocked={blocked}
        blockedReason={blockedReason}
      />
    </Elements>
  );
}

function StripeForm({ checkoutSessionId, total, onBack, blocked, blockedReason }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/marketplace/checkout/success?session=${checkoutSessionId}`,
        },
        redirect: 'if_required',
      });
      if (result.error) {
        toastError(new Error(result.error.message ?? 'Payment could not be completed.'), 'paying with Stripe');
        setPaying(false);
        return;
      }
      const intent = result.paymentIntent;
      if (intent?.status === 'succeeded' || intent?.status === 'processing') {
        toastSuccess('Payment confirmed. Order placed.');
        navigate(`/marketplace/checkout/success?session=${checkoutSessionId}`);
      } else {
        toastError(new Error(`Payment status: ${intent?.status ?? 'unknown'}`), 'paying with Stripe');
        setPaying(false);
      }
    } catch (err) {
      toastError(err, 'paying with Stripe');
      setPaying(false);
    }
  }, [stripe, elements, checkoutSessionId, navigate]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Pay by card</CardTitle>
        <CardDescription>Your card details are entered into Stripe's secure form below. They never touch our servers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border p-4">
          <PaymentElement
            onReady={() => setStripeReady(true)}
            onChange={(e) => setCardComplete(e.complete)}
            options={{ layout: 'tabs' }}
          />
        </div>
        {blocked && <FreightWarn message={blockedReason ?? 'This order cannot proceed.'} />}
        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" onClick={onBack} disabled={paying}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <Button onClick={handlePay} disabled={!stripe || !stripeReady || !cardComplete || paying || blocked}>
            {paying
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Processing payment…</>
              : <>Pay {formatAUD(total)} <ArrowRight className="w-4 h-4 ml-1.5" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Order summary (sticky on the right)
// ============================================================================
function OrderSummary({ lines, subtotalExGst, freightExGst, gst, gstPercentLabel, total, liveQuote, freightLoading }) {
  return (
    <div className="lg:sticky lg:top-4 self-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order summary</CardTitle>
          <CardDescription className="text-xs">{lines.length} item{lines.length === 1 ? '' : 's'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {lines.map((item) => (
            <div key={item.id} className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-medium truncate">{item.product?.name ?? 'Untitled item'}</p>
                  {item.product?.hazard_class && <HazardBadge value={item.product.hazard_class} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.packaging_size?.name ?? ''} × {item.quantity}
                </p>
              </div>
              <span className="shrink-0">{formatAUD(item.subtotal?.lineSubtotalExGst ?? 0)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between">
            <span>Subtotal (ex-GST)</span>
            <span>{formatAUD(subtotalExGst)}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1.5">
              Freight (ex-GST)
              {freightLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </span>
            <span>{formatAUD(freightExGst)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST ({gstPercentLabel})</span>
            <span>{formatAUD(gst)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>{formatAUD(total)}</span>
          </div>
          {liveQuote?.distance_km != null && (
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Quoted from warehouse postcode {liveQuote.warehouse_postcode} • {Number(liveQuote.distance_km).toFixed(0)} km
            </p>
          )}
          {(() => {
            const visibleNotes = (liveQuote?.notes ?? []).filter((n) => !isInternalFreightNote(n));
            if (visibleNotes.length === 0) return null;
            return (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-2.5 space-y-1.5">
                {visibleNotes.map((note, i) => <FreightNoteRow key={i} note={note} />)}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

function FreightWarn({ message }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-sm">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message ?? 'Freight rules prevent this order from proceeding.'}</span>
    </div>
  );
}

function FreightNoteRow({ note }) {
  const friendly = humaniseFreightNote(note);
  return (
    <div className="flex items-start gap-2 text-[12px] text-amber-800 dark:text-amber-300">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <div className="space-y-0.5">
        <p className="font-medium leading-snug">{friendly.title}</p>
        {friendly.detail && <p className="opacity-90 leading-snug">{friendly.detail}</p>}
      </div>
    </div>
  );
}

function isInternalFreightNote(note) {
  const text = String(note ?? '');
  return /^Distance:\s.+\svia\s/i.test(text);
}

function humaniseFreightNote(note) {
  const text = String(note ?? '');
  // LVR / PO-box postcode (the engine emits a "Large Volume Receiver" note now).
  const lvrMatch = text.match(/Postcode (\d+) is in the (\w+) Large Volume Receiver range[^]+?(?:for example, ([^.]+)\.)?/i);
  if (lvrMatch) {
    const [, pc, region, suggestion] = lvrMatch;
    return {
      title: `Postcode ${pc} is a PO Box range, not a street address.`,
      detail: suggestion
        ? `Postcodes in the ${region} LVR range can't accept deliveries. Try ${suggestion} instead.`
        : `Postcodes in the ${region} LVR range can't accept deliveries. Use the buyer's actual street-address postcode.`,
    };
  }
  // Generic "couldn't find a route" — emitted for valid-format but unroutable codes.
  const noRoute = text.match(/We couldn't find a delivery route to postcode (\S+?)\b/i);
  if (noRoute) {
    return {
      title: `We couldn't find a delivery route to postcode ${noRoute[1]}.`,
      detail: 'Double-check the street, suburb, state and postcode on the delivery form. If the address is correct, contact Elora to arrange freight manually.',
    };
  }
  // Pre-existing "Unable to compute" matcher (kept for back-compat with older quotes in flight).
  const unableTo = text.match(/Unable to compute a road distance to postcode (\S+?)\b/i);
  if (unableTo) {
    const pc = unableTo[1];
    return {
      title: `We couldn't compute freight to postcode ${pc}.`,
      detail: "Please double-check the street, suburb, state and postcode on the delivery form. If the address is correct, contact Elora to arrange freight manually.",
    };
  }
  const unknownPc = text.match(/Unknown postcode (\S+?);/i);
  if (unknownPc) {
    return {
      title: `We couldn't quote freight to postcode ${unknownPc[1]}.`,
      detail: 'Double-check the postcode against the delivery address, or contact Elora to arrange freight manually.',
    };
  }
  if (/No rate sheet mapped/i.test(text)) {
    return {
      title: 'Freight not yet configured for one of your items.',
      detail: "We'll confirm the freight charge with you separately before dispatching.",
    };
  }
  if (/out[-\s]?of[-\s]?range|exceed/i.test(text)) {
    return {
      title: 'Your delivery address is outside our standard freight zones.',
      detail: 'Please contact Elora for a custom quote on this order.',
    };
  }
  return { title: 'Freight note', detail: text };
}
