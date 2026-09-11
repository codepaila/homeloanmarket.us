# PHASE 8.42 — BROKER + COMPANY SUBSCRIPTION DEEP AUDIT

---

## Overall Verdict

🟢 **PASS WITH FINDINGS**

All billing correctness paths (activation, cancellation, webhook ordering, re-subscription) are structurally sound. No critical or high findings. Two medium findings (defensive consistency gaps) and two low findings (legacy residue / cosmetic) are documented.

---

## Executive Summary

This audit traces the full production call path for **two independent subscription products** operating in the same codebase:

1. **Broker Subscription** — "Mortgage Expert" paid plan; targets `BrokerSubscription` model; manages commercial placement (featuredRank)
2. **Company Advertising Subscription** — "ADVERTISING" plan; targets `CompanySubscription` model; manages advertising entitlement

A third lifecycle — **Broker Registration Subscription** (`BrokerRegistrationSubscription`) — is an onboarding-only bridge that folds into the normal Broker Subscription at finalization.

**Key architectural invariants confirmed:**
- Stripe is the billing authority; DB is the authorization authority
- Locking prevents concurrent checkout/webhook per subscription scope
- Every webhook event is deduped and ordering-guarded
- Purchase emails are durable (dual-write to MongoDB log + sendEmail) with exactly-once semantics
- Re-subscription after cancellation is safe: stale-sub guard prevents superseded events from overwriting a live subscription

---

## Architecture Separation

| Aspect | Broker Product | Company Product |
|---|---|---|
| Subscription model | `BrokerSubscription` (schema:383) | `CompanySubscription` (schema:586) |
| Plan model | `BrokerSubscriptionPlan` (schema:445) | `CompanyAdvertisingPlan` (schema:693) |
| Email log | `BrokerSubscriptionEmailLog` (schema:419) | `CompanySubscriptionEmailLog` (schema:616) |
| Payment failure log | `BrokerSubscriptionPaymentFailureLog` (schema:647) | `CompanySubscriptionPaymentFailureLog` (schema:670) |
| Checkout route | `/api/subscription/checkout` | `/api/company/subscription/checkout` |
| Cancel route | `/api/subscription/cancel` | `/api/company/subscription/cancel` |
| Portal route | `/api/subscription/portal` | `/api/company/subscription/portal` |
| Owner gate | `getCurrentUser()` + `brokerProfile` | `getCurrentCompany()` |
| Lock scope | `broker:<brokerId>` (checkout) | `company:<companyId>` (checkout) |
| Webhook lock | `subscription:<stripeSubId>` | `subscription:<stripeSubId>` |
| Auth ownership | `assertStripeCustomerOwnership` | customer.metadata.companyId check |
| Plan code enum | `SubscriptionPlan` {FREE, FEATURED, PREMIUM} | `CompanyAdvertisingPlan` (dynamic, by name) |
| Registration bridge | `BrokerRegistrationSubscription` → `BrokerSubscription` at finalization | N/A |

**Cross-product isolation confirmed:** The webhook dispatch (`updateSubscriptionFromStripe`, lib/subscription.ts:378–436) routes by `ownerType` metadata first, then falls back to customer-id product ambiguity detection. An ambiguous customer (matching both products) is refused rather than silently picking one. A COMPANY event can never mutate a BrokerSubscription and vice versa.

---

## Broker Subscription Lifecycle

### State Machine

```
FREE ──checkout──► CHECKOUT_PENDING (not used for broker)
                    │
                    ├──webhook completed──► ACTIVE (FEATURED)
                    │                            │
                    │                            ├──webhook deleted──► INACTIVE (plan=FREE)
                    │                            ├──webhook past_due──► INACTIVE (plan=FREE)
                    │                            └──cancelSubscription──► INACTIVE (plan=FREE)
                    │
                    └──getSubscription(): syncs local with Stripe status
```

**Note:** The `BrokerSubscription` model has no `status` field — authorization is derived from `isActive`, `plan`, and `endDate`. The `effectiveSubscription` helper normalizes any non-FREE, non-FEATURED, inactive, or expired state to plan=FREE (lib/subscription.ts:189–203).

### Checkout Flow
1. `getCurrentUser()` → auth gate (session cookie, SameSite=lax)
2. `validateBrokerPlanForCheckout(plan, priceId)` → DB plan must exist, be active, and carry exact Stripe priceId
3. `withCheckoutLock(brokerId)` → Redis SET NX EX on `homeloanmarket:billing:broker:<brokerId>`
4. Create or reuse Stripe customer (idempotency: `stripe_customer_<userId>`)
5. `assertStripeCustomerOwnership` → DB + Stripe metadata match
6. `findCheckoutConflict` → local row + Stripe subscriptions probe
7. `stripe.checkout.sessions.create` with `ownerType: 'BROKER'`
8. Success page → `/api/subscription/verify` → `updateSubscriptionFromStripe`

### Stale-Subscription Guard (lib/subscription.ts:437–445)
When local `stripeSubId` differs from incoming:
- Retrieve current Stripe subscription
- Only honor the switch if current is terminal (`canceled`/`incomplete_expired`) AND incoming is active
- If current is active and incoming is inactive: return existing unchanged (ignore superseded cancel)

### Re-subscription after Cancel
Cancel → local `isActive=false` → Stripe cancel webhook → `stripeSubId` retained → new checkout → new `stripeSubId` → webhook `checkout.session.completed` → guard allows switch (current=terminal, incoming=active) → purchase email fires → old `stripeSubId` superseded.

---

## Company Subscription Lifecycle

### State Machine

```
CHECKOUT_PENDING ──webhook completed──► ACTIVE
       │                                    │
       │──checkout.session.expired──► EXPIRED   ├──webhook deleted──► CANCELED
       │                                    ├──webhook past_due──► PAST_DUE
       │                                    ├──reconcileStale (belt+suspenders)──► EXPIRED
       │                                    └──cancel route──► CANCELED
       │
       └──company delete──► cascade deleted
```

### Checkout Flow
1. `getCurrentCompany()` → auth gate + email verified + company not suspended
2. `isCompanyProfileComplete` → hard prerequisite (403 if incomplete)
3. `resolveCompanyPlanForCheckout` + `getCanonicalCompanyAdvertisingPlan` → exactly one customer-facing plan
4. `validateCompanyCoupon` → Stripe promotion code server-side only (never trusts client)
5. `withBillingLock('company:<companyId>')` → Redis lock
6. Bounded stale-checkout reconciliation (`reconcileStaleCompanyCheckout`) — this company only, no full-DB scan
7. `companySubscription.upsert` → `CHECKOUT_PENDING`
8. FREE path: immediately activate (no Stripe, no email)
9. Paid path: create Stripe customer (idempotency) or reuse + verify ownership
10. `stripe.checkout.sessions.create` with `ownerType: 'COMPANY'`
11. Success → `/company/dashboard?subscription=success` → dashboard self-heals CHECKOUT_PENDING

### Free Path
- `plan.price <= 0` → upsert to `CHECKOUT_PENDING` → immediately update to `ACTIVE` + `isActive=true` + `company.status='ACTIVE'`
- No Stripe customer, no checkout session, no webhook needed, no email
- Safe to repeat: upsert to CHECKOUT_PENDING, then update to ACTIVE

### Stale-Subscription Guard (lib/subscription.ts:753–762)
Identical structure to broker guard. Switch only allowed when current subscription is terminal and incoming is active.

---

## Stripe Authority Matrix

| Stripe Identity | Used By | Stored Where |
|---|---|---|
| `Customer.id` | Both products | `stripeCustomerId` on both subscription models |
| `Subscription.id` | Both products | `stripeSubId` on both subscription models |
| `Checkout.Session.id` | Both products | Ephemeral (used for verify/reuse only) |
| `Price.id` | Both products | `stripePriceId` on plan models; resolved server-side from DB |
| `Product.id` | Admin plan setup | `stripeProductId` on plan models; validated, not used at runtime |
| `PromotionCode.id` | Company only | `stripePromotionCodeId` on CompanySubscription (server-side only, never to client) |
| `Invoice.id` | Both products | Payment failure idempotency: `payment_failure_broker_<subId>_<invoiceId>` |

**Webhook event ownership signal:** `ownerType` metadata on Stripe Customer + Subscription + Checkout Session. The three values are:
- `'BROKER'` — normal broker subscription
- `'BROKER_REGISTRATION'` — onboarding-only subscription
- `'COMPANY'` — company advertising subscription

---

## State Machine Matrix

### Broker States (no `status` field — derived from `isActive` + `plan` + `endDate`)

| Local State | Stripe | isActive | plan | Effective |
|---|---|---|---|---|
| No row | — | — | — | FREE |
| `plan=FREE, isActive=true` | — | true | FREE | FREE |
| `plan=FEATURED, isActive=true, endDate=null` | active | true | FEATURED | FEATURED |
| `plan=FEATURED, isActive=false` | canceled | false | FREE | FREE |
| `plan=FEATURED, isActive=true, endDate<past` | — | true (stale) | FEATURED | FREE (expired) |

### Company States (`status` enum + `isActive`)

| `status` | `isActive` | Effective |
|---|---|---|
| CHECKOUT_PENDING | false | No access |
| ACTIVE | true | Full advertising |
| PAST_DUE | false | No access |
| INCOMPLETE | false | No access |
| INCOMPLETE_EXPIRED | false | No access |
| UNPAID | false | No access |
| PAUSED | false | No access |
| CANCELED | false | No access |
| EXPIRED | false | No access |

### Registration States (`BrokerRegistrationSubscription.status`)

| `status` | `isActive` | On finalization |
|---|---|---|
| PENDING | false | Blocks finalize |
| CHECKOUT_PENDING | false | Blocks finalize |
| ACTIVE | true | Proceeds (copies plan/stripeCustomerId) |
| CANCELED | — | Blocks finalize |
| EXPIRED | — | Blocks finalize |

---

## Re-subscription Matrix

| Product | Cancel → Re-subscribe Path | Purchase Email? | Lock |
|---|---|---|---|
| **Broker** | cancelSubscription → new checkout → webhook completed → stale-sub guard allows switch | Yes (always — idempotency key `subscription_purchase_<brokerSubId>` is one-shot; re-subscription fires new email on same key, sent=SENT → skipped for first cancel+re-sub) — see Finding F-1 | `broker:<id>` (checkout) / `subscription:<subId>` (webhook) |
| **Company** | cancel route → new checkout → webhook completed → stale-sub guard allows switch | Yes (per Stripe sub id: key = `company_subscription_activation_<companySubId>_<stripeSubId>`) | `company:<id>` (checkout) / `subscription:<subId>` (webhook) |
| **Registration** | free path overwrites FEATURED registration subscription → finalization copies | No email | `broker-registration:<registrationId>` |

---

## Payment Failure / Recovery Matrix

| Event | Lock | Action | Email | Durable Idempotency |
|---|---|---|---|---|
| `invoice.payment_failed` (broker) | `subscription:<subId>` | `updateSubscriptionFromStripe` → past_due, isActive=false | `sendBrokerPaymentFailureEmail(subId, invoiceId)` | `payment_failure_broker_<subId>_<invoiceId>` |
| `invoice.payment_failed` (company) | `subscription:<subId>` | `updateCompanySubscriptionFromStripe` → PAST_DUE, isActive=false | `sendCompanyPaymentFailureEmail(subId, invoiceId)` | `payment_failure_company_<subId>_<invoiceId>` |
| `invoice.payment_succeeded` (broker) | `subscription:<subId>` | `updateSubscriptionFromStripe` → subscription.status (from Stripe) | No email | N/A |
| `invoice.payment_succeeded` (company) | `subscription:<subId>` | `updateCompanySubscriptionFromStripe` → subscription.status (from Stripe) | No email | N/A |

---

## Cancellation / Expiration Matrix

| Trigger | Broker | Company | Registration |
|---|---|---|---|
| `cancelSubscription` (user-initiated) | `cancel` Stripe sub (idempotency: `cancel_<customerId>_<subId>`) → local isActive=false, endDate=now → `applySubscriptionFeatures` (featuredRank=null) | `cancel` Stripe sub (idempotency: `company_cancel_<companyId>_<subId>`) → `updateCompanySubscriptionFromStripe` → CANCELED | N/A (no cancel route) |
| `checkout.session.expired` | Not handled (no CHECKOUT_PENDING for broker) | `reconcileCompanyCheckoutExpired` → EXPIRED (only if no live sub + no open checkout) | `reconcileBrokerRegistrationCheckoutExpired` → EXPIRED (gated on existing.stripeSubId) |
| `customer.subscription.deleted` | `updateSubscriptionFromStripe` → isActive=false, endDate=now, applySubscriptionFeatures | `updateCompanySubscriptionFromStripe` → CANCELED | `updateRegistrationSubscriptionFromStripe` → CANCELED, registration.status stays |
| Admin plan deactivation | N/A | `deactivateCompanyAdvertisingPlan` → per-subscription Stripe cancel (idempotency: `company_plan_deactivate_<planId>_<subId>`) → PENDING rows reconciled locally → plan.isActive=false | N/A |
| Stale-checkout reconcile (belt+suspenders) | N/A | `reconcileStaleCompanyCheckout` — same company only, no full-DB scan; probes live subs + open checkouts | N/A |

---

## Checkout Security Matrix

| Check | Broker Checkout | Company Checkout | Registration Checkout |
|---|---|---|---|
| Auth gate | `getCurrentUser()` | `getCurrentCompany()` + email verified | `getCurrentUser()` + role=BROKER + no brokerProfile |
| Origin check | **None** (see F-3) | `isSameOriginRequest()` | `isSameOriginRequest()` |
| Plan validation | `validateBrokerPlanForCheckout` (DB plan, active, exact priceId match) | `resolveCompanyPlanForCheckout` + `getCanonicalCompanyAdvertisingPlan` (exactly one canonical plan) | `validateBrokerPlanForCheckout` |
| Profile completeness | `user.brokerProfile` must exist | `isCompanyProfileComplete` (hard prerequisite) | N/A (registration is the profile completion path) |
| Price trust | Resolved from DB `stripePriceId` | Resolved from DB `plan.stripePriceId` (never from client) | Resolved from DB |
| Coupon handling | N/A | Server-side only: `validateCompanyCoupon` → Stripe PromotionCode; `discounts` param sent to Checkout; `allow_promotion_codes: false` when no coupon | N/A |
| Customer ownership | `assertStripeCustomerOwnership` (DB + metadata) | Stripe customer.metadata.companyId check | metadata.userId + metadata.brokerRegistrationId check |
| Conflict guard | `findCheckoutConflict` (local + Stripe) | Early return if `isActive && stripeSubId` | Early return if `status=ACTIVE && isActive && stripeSubId` |
| Idempotency key | `checkout_<userId>_<customerId>_<plan>_<priceId>` | Content-fingerprinted (`buildCompanyCheckoutIdempotencyKey`) | `registration_checkout_<regId>_<customerId>_FEATURED_<priceId>` |
| Managed Payments | Disabled per-session | Disabled per-session | Disabled per-session |

---

## Authorization Matrix

| Action | Broker | Company | Registration |
|---|---|---|---|
| View subscription | `getCurrentUser()` + brokerProfile | `getCurrentCompany()` + membership + not SUSPENDED | N/A |
| Create checkout | `getCurrentUser()` + brokerProfile + plan validation | `getCurrentCompany()` + email verified + profile complete | `getCurrentUser()` + role=BROKER + no brokerProfile |
| Cancel | `cancelSubscription(brokerId)` — no further auth (assumes caller owns broker) | `getCurrentCompany()` + subscription exists + Stripe ownership verification | N/A |
| Portal | `assertStripeCustomerOwnership(userId, brokerId, customerId)` | `getCurrentCompany()` + customer metadata.companyId check | N/A |
| Admin deactivation | N/A | `SubscriptionService.deactivateCompanyAdvertisingPlan` — no auth gate visible (assumes admin middleware) | N/A |

---

## Dashboard/UI Matrix

| Surface | Broker | Company |
|---|---|---|
| Main dashboard | `getCurrentUser()` → effectiveSubscription | `getCurrentCompany()` + self-heal CHECKOUT_PENDING → subscription state passed to client |
| Subscription management | `/broker/subscription` (page.tsx) | `CompanyDashboardClient` — shows plan, status, billing actions |
| Success/verify | `/broker/subscription/success` → calls `/api/subscription/verify` → `updateSubscriptionFromStripe` | `/company/dashboard?subscription=success` → dashboard self-heals via reconcile |
| Billing portal | `/api/subscription/portal` — asserts ownership, creates Stripe portal | `/api/company/subscription/portal` — verifies customer ownership |
| Cancel button | Client-side calls `POST /api/subscription/cancel` | Client-side calls `POST /api/company/subscription/cancel` |

---

## Email Lifecycle Matrix

### Broker Purchase Email

| Property | Value |
|---|---|
| Trigger | `checkout.session.completed` → `sendSubscriptionPurchaseEmail(updated.id)` |
| Idempotency key | `subscription_purchase_<brokerSubscriptionId>` |
| Durable log | `BrokerSubscriptionEmailLog` (unique on `idempotencyKey`) |
| Lease | 5 minutes (`CLAIM_LEASE_MS`) |
| State machine | PENDING → PROCESSING (leased) → SENT / FAILED |
| Recipient | `broker.email || broker.user.email` |
| Template | `emailTemplates.subscriptionPurchased(...)` |
| Concurrency safety | Atomic `updateMany` with status+lease guard; exactly one winner |

### Company Purchase Email

| Property | Value |
|---|---|
| Trigger | `checkout.session.completed` → `sendCompanySubscriptionPurchaseEmail(updated.id, subscription.id)` |
| Idempotency key | `company_subscription_activation_<companySubscriptionId>_<stripeSubscriptionId>` |
| Durable log | `CompanySubscriptionEmailLog` (unique on `idempotencyKey`) |
| Lease | 5 minutes |
| State machine | PENDING → PROCESSING (leased) → SENT / FAILED |
| Recipient | Active OWNER membership → `user.email` |
| Template | `emailTemplates.companySubscriptionPurchased(...)` |
| Concurrency safety | Same atomic claim pattern |

**Key asymmetry (Finding F-1):** Company purchase email is scoped to `(companySubscriptionId, stripeSubscriptionId)` so cancel+re-subscribe produces a NEW email. Broker purchase email is scoped to `brokerSubscriptionId` only so cancel+re-subscribe suppresses the re-subscription email (already_sent). This is a durability design difference, not a correctness bug.

### Payment Failure Emails

| Property | Broker | Company |
|---|---|---|
| Trigger | `invoice.payment_failed` | `invoice.payment_failed` |
| Idempotency key | `payment_failure_broker_<subId>_<invoiceId>` | `payment_failure_company_<subId>_<invoiceId>` |
| Durable log | `BrokerSubscriptionPaymentFailureLog` | `CompanySubscriptionPaymentFailureLog` |
| Recipient | `broker.email \|\| broker.user.email` | OWNER membership → `user.email` |
| Template | `emailTemplates.paymentFailure(name, 'Broker', billingUrl)` | `emailTemplates.paymentFailure(name, 'Company Advertising', dashboardUrl)` |

---

## Concurrency / Race Findings

| Race | Mitigation | Status |
|---|---|---|
| Duplicate Stripe webhook retry | `StripeWebhookEvent.eventId` unique constraint → `P2002` → `duplicate: true` | ✅ Safe |
| Concurrent webhook events for same subscription | `withWebhookSubscriptionLock('subscription:<subId>')` — serialized | ✅ Safe |
| Stale webhook event arriving after newer one | `hasNewerAppliedEvent` ordering guard → `stale: true`, skip processing | ✅ Safe |
| Webhook event stuck in PROCESSING | 5-minute stale-claim recovery: retry if `updatedAt > 5 min ago` | ✅ Safe |
| Concurrent company checkout submissions | `withBillingLock('company:<id>')` — serialized | ✅ Safe |
| Checkout vs webhook race (company) | Checkout writes CHECKOUT_PENDING; webhook writes ACTIVE; stale-sub guard prevents overwrite | ✅ Safe |
| Email send crash between send and SENT write | Residual duplicate possible (documented in broker-subscription-email.ts:24–27); Resend has no server-side idempotency key | ✅ Documented, low risk |
| CHECKOUT_PENDING stuck (abandoned session) | Webhook `checkout.session.expired` handler + dashboard belt-and-suspenders `reconcileStaleCompanyCheckout` | ✅ Safe |
| Re-subscription concurrent with old-sub cancel | Stale-sub guard: if current active and incoming cancel → ignore cancel | ✅ Safe |

---

## Database / Schema Findings

| Area | Detail |
|---|---|
| BrokerSubscription | `brokerId` unique (one per broker); `plan` + `planId` (code from enum, id from DB); `isActive` + `endDate` derive entitlement; `stripeCustomerId` + `stripeSubId` (both nullable, required for paid) |
| CompanySubscription | `companyId` unique; `status` enum (9 states); `plan` + `planId` (name+FK); `stripeCustomerId` + `stripeSubId` + `stripePromotionCodeId` (all nullable) |
| BrokerRegistrationSubscription | `registrationId` unique; bridges to `BrokerSubscription` at `finalizeBrokerRegistration` (copies plan, stripeCustomerId, stripeSubId, isActive, startDate, endDate) |
| StripeWebhookEvent | `eventId` unique; `status` enum {PROCESSING, PROCESSED, FAILED}; `stripeSubId` + `eventCreatedAt` compound index for ordering guard |
| Email logs | Both use idempotencyKey unique + status/lease/claimedAt pattern; `onDelete: Cascade` on FK |
| Payment failure logs | Both use idempotencyKey unique + `(subscriptionId, invoiceId)` compound unique + status/lease pattern |
| Indexes | `BrokerSubscription`: index on `planId`; `CompanySubscription`: indexes on `planId`, `status`, `stripeCustomerId`, `stripeSubId`; `StripeWebhookEvent`: indexes on `(stripeSubId, eventCreatedAt)`, `(status, createdAt)` |
| `SubscriptionPlan` enum | Contains FREE, FEATURED, PREMIUM — PREMIUM is legacy-only, never offered, never selected at checkout; kept for schema compatibility |

---

## Test Coverage

### Existing Test Suites (Related)

| Suite | Count | Coverage |
|---|---|---|
| `phase-8.1-subscription.test.ts` | 6 | effectiveSubscription, SUPPORTED_BROKER_PLAN_CODES, DEFAULT_BROKER_PLANS |
| `phase-8.1-subscription.integration.test.ts` | 4 | effectiveSubscription PREMIUM→FREE normalization |
| `phase-6-fixed-plans.test.ts` | 6 | isSupportedBrokerPlanCode, getBrokerPlanDisplayName, PREMIUM legacy |
| `broker-mortgage-expert.test.ts` | 4 | brokerSubscriptionHasProfileBadge, SubscriptionPlan enum |
| `broker-listing-badge-final.test.ts` | 3 | Badge entitlement from plan tier |
| `phase-9.1-dashboard.test.ts` | 4 | effectiveSubscription in dashboard context |
| `broker-subscription-checkout.test.ts` | 8 | Full checkout flow, conflict detection, registration checkout |
| `registration-flow-security.test.ts` | 6 | Origin check, plan injection prevention |
| `phase-8.25-step6-plan-selection.test.ts` | 3 | Step filters FREE/FEATURED only |
| `phase-8.21-canonical-broker-flow.test.ts` | 5 | Invalid plan rejection |
| `admin-broker-plans-navigation.test.ts` | 5 | No hard-coded plan branching in admin |
| `broker-claim-subscription-lifecycle.test.ts` | 4 | Claim completion, no hard-coded plans |
| `phase-13.5-demo-data.test.ts` | 3 | No PREMIUM subscriptions in seed |
| `phase-13.8-clean-seed.test.ts` | 2 | No PREMIUM in seed |
| `phase-13.9b-admin-ads-lifecycle.test.ts` | 3 | Admin ads lifecycle |
| `phase-8.41.3-company-resubscription-activation-email.test.ts` | 12 | Company re-subscription activation email (new) |

### Static Consistency Scan

**PREMIUM references in production code:**
- `lib/broker-policy.ts:25` — comment only: "FREE/FEATURED/PREMIUM or admin-created"
- `components/admin/dashboard/AdminDashboard.tsx:76` — UI label: "PREMIUM is not an active product" (informational)

**PREMIUM in tests:** All references are assertions that PREMIUM is NOT selected/active/offered — correct defensive tests.

**No runtime entitlement paths branch on `plan === 'PREMIUM'`.** All plan-gating uses dynamic DB-driven `displayOrder` (broker) or `getCanonicalCompanyAdvertisingPlan` (company).

---

## Findings

### F-1 — MEDIUM — Broker Re-subscription Does Not Emit New Purchase Email

**Location:** `lib/broker-subscription-email.ts:42` — `idempotencyKey = 'subscription_purchase_${brokerSubscriptionId}'`

**Exact behavior:** After first purchase email is SENT, all subsequent activation events (including cancel+re-subscribe) hit `already_sent` in the durable log and skip the email.

**Why it matters:** The company product was specifically hardened (Phase 8.41.3) to scope activation emails per Stripe subscription (`company_subscription_activation_<companySubId>_<stripeSubId>`). The broker product still keys on `brokerSubscriptionId` only. A broker who cancels and re-subscribes never receives a fresh activation confirmation email — the durable log returns "already_sent" forever.

**Reproduction:** (1) Broker subscribes to FEATURED → purchase email sent. (2) Broker cancels. (3) Broker re-subscribes → `checkout.session.completed` webhook fires → `sendSubscriptionPurchaseEmail(brokerSubscriptionId)` → durable log finds existing row with status=SENT → returns `{status:'skipped', reason:'already_sent'}` → no email.

**Affected system:** Broker notification only — billing state is correct; only the confirmation email is missing.

**Recommended next phase:** Either scope the broker purchase email idempotency key to `(brokerSubscriptionId, stripeSubscriptionId)` (matching the company pattern), or document the one-email-per-subscription design as intentional.

---

### F-2 — MEDIUM — Broker Registration Checkout-Expired Reconcile Probes Stripe Conditionally (Unlike Company)

**Location:** `lib/subscription.ts:585–592` — `reconcileBrokerRegistrationCheckoutExpired`

**Exact behavior:** The broker registration reconcile only probes Stripe for a live subscription when `existing.stripeSubId` is non-null:
```ts
let liveSubscription = false
if (existing.stripeSubId) {
  const subs = await stripe.subscriptions.list(...)
  liveSubscription = subs.data.some(...)
}
```

**Why it matters:** The company product's analogous method (`reconcileCompanyCheckoutExpired`, lib/subscription.ts:546) probes unconditionally because "after a successful payment the webhook may not have recorded the subscription ID yet" — the exact race documented in the comments. The broker registration path has the identical race but does NOT probe unconditionally. During the window between a successful payment and the activation webhook, a stale `checkout.session.expired` event could mark the registration subscription EXPIRED despite a live paid subscription existing.

**Reproduction:** (1) Registration user starts FEATURED checkout (Stripe customer created, stripeCustomerId set on row, stripeSubId=null, status=CHECKOUT_PENDING). (2) Payment succeeds; Stripe fires `checkout.session.completed`. (3) Before that webhook runs, an `expired` event for the same session (or a prior superseded session) runs first. (4) `reconcileBrokerRegistrationCheckoutExpired` finds `stripeSubId=null` → skips probe → marks EXPIRED. (5) The `checkout.session.completed` webhook then sets ACTIVE (eventual consistency restored). During the EXPIRED window, if `finalizeBrokerRegistration` runs, it fails with "An active broker subscription is required before onboarding."

**Affected system:** Broker registration finalization only; transient; self-heals when the activation webhook arrives.

**Recommended next phase:** Change the probe to unconditional (matching the company pattern) in `reconcileBrokerRegistrationCheckoutExpired`.

---

### F-3 — MEDIUM — Broker Subscription Endpoints Lack Same-Origin Check (Defense-in-Depth Gap)

**Location:** `app/api/subscription/cancel/route.ts`, `app/api/subscription/portal/route.ts`, `app/api/subscription/checkout/route.ts`

**Exact behavior:** The broker subscription cancel, portal, and checkout endpoints do not call `isSameOriginRequest()`. The company checkout, cancel, portal, and registration checkout/verify endpoints all do.

**Why it matters:** This is a defense-in-depth asymmetry. NextAuth v5 session cookies default to `SameSite=Lax`, which prevents cross-site form POSTs from carrying the session cookie. So a CSRF form POST to `/api/subscription/cancel` would not include the session cookie and would fail authentication. However:
- If the auth cookie is ever configured to `SameSite=None` (e.g., for cross-domain SSRF or subdomain scenarios), the CSRF attack becomes viable.
- The cancel endpoint requires no body — it cancels the broker's subscription on a plain POST with no JSON parsing, making it the most attackable surface.
- Company and registration routes enforce the check; broker routes do not — inconsistent security posture.

**Reproduction (hypothetical):** If `SameSite=None` on the auth cookie: a malicious page on `evil.com` could embed `<form action="https://app.com/api/subscription/cancel" method="POST">` and auto-submit; the broker's paid subscription is canceled.

**Affected system:** Broker subscription cancel/portal/checkout endpoints.

**Recommended next phase:** Add `isSameOriginRequest()` guard to all broker subscription endpoints for defense-in-depth parity with company and registration routes.

---

### F-4 — LOW — `effectiveSubscription` Normalizes All Non-FREE Non-FEATURED Plans to FREE

**Location:** `lib/subscription.ts:191`

**Exact behavior:** `effectiveSubscription` returns plan=FREE when `subscription.plan !== 'FEATURED'`, regardless of whether the plan is a legitimate admin-created paid plan. Meanwhile `brokerSubscriptionHasProfileBadge` (broker-plans.ts:205) returns `subscription.plan !== 'FREE'` — checking the raw DB plan, not the effective plan.

**Why it matters:** If an admin creates a non-FREE, non-FEATURED plan (e.g., "GOLD") and assigns it to a broker, `effectiveSubscription` returns `plan: FREE` (entitlement: no access), but `brokerSubscriptionHasProfileBadge` on the raw row returns `true` (paid badge displayed). The two paths diverge.

**Current impact:** No admin-created non-FREE/non-FEATURED plans exist in production (only FREE and FEATURED). The legacy PREMIUM enum value is explicitly not offered at checkout. This is a latent inconsistency rather than an active bug.

**Recommended next phase:** Decide whether admin-created plans should be treated as paid (in which case `effectiveSubscription` should check `plan !== 'FREE'` instead of `plan === 'FEATURED'`), or document that only FEATURED grants paid entitlement and admin-created plans are informational only.

---

### F-5 — LOW — `applySubscriptionFeatures` / `calculateFeaturedRank` Never Uses Lead Conversion Bonus

**Location:** `lib/subscription.ts:245–267, 272–298`

**Exact behavior:** `applySubscriptionFeatures` loads the broker with `include: { subscription: true }` but does not include the `leads` relation. `calculateFeaturedRank` computes `broker.leads?.filter(...).length`, which evaluates to `undefined` (optional chaining short-circuits the member chain), so `convertedLeads` is always `0` and the 15-point lead conversion bonus is never applied.

**Why it matters:** The lead conversion bonus in `calculateFeaturedRank` is dead code in the context of `applySubscriptionFeatures`. The feature's advertised behavior (ranking based on lead conversion) is not realized.

**Current impact:** Feature ranking is slightly lower than designed for high-conversion brokers (up to 15 points missing). Not a billing or access correctness issue.

**Recommended next phase:** Add `leads: { select: { status: true } }` to the broker include in `applySubscriptionFeatures`, or remove the dead bonus code.

---

## Positive Confirmations

1. **No cross-product contamination:** COMPANY webhook events cannot mutate BrokerSubscription and vice versa (ownerType dispatch + ambiguity detection).
2. **Checkout origin checks enforced** on company and registration routes.
3. **All checkout endpoints validate plans server-side** — client-supplied priceId is cross-checked against DB `stripePriceId`.
4. **Coupons are server-side only** — Stripe Promotion Codes used via `discounts` param; `allow_promotion_codes: false` when no coupon.
5. **Managed Payments disabled per-session** — not globally; account defaults preserved.
6. **Every webhook event is deduped** (`eventId` unique) and **ordering-guarded** (`hasNewerAppliedEvent`).
7. **Purchase emails are durable** — dual-write to MongoDB log + sendEmail; SENT only after provider acceptance.
8. **Payment failure emails are durable** — same pattern, per-invoice idempotency.
9. **Stale-subscription guard prevents superseded events** from overwriting live subscriptions (both products).
10. **Belt-and-suspenders CHECKOUT_PENDING reconcile** at both dashboard load and checkout time (company).
11. **Broker free path is clean** — no Stripe customer, no checkout session, no email, immediate activation.
12. **Broker registration → finalization bridge** copies subscription state cleanly (plan, stripeCustomerId, stripeSubId, isActive, startDate, endDate).
13. **Effective subscription expiry check** correctly treats `endDate <= now()` as expired.
14. **Stripe webhook secret verification** enforced (POST handler).
15. **No PREMIUM plan is selectable at checkout** — `isSupportedBrokerPlanCode('PREMIUM') === false`.

---

## Recommended Next Phase

1. **F-1 fix (MEDIUM):** Scope broker purchase email idempotency key to `(brokerSubscriptionId, stripeSubscriptionId)` to match the company pattern — or document the one-email-per-subscription design as intentional.
2. **F-2 fix (MEDIUM):** Make the broker registration checkout-expired probe unconditional in `reconcileBrokerRegistrationCheckoutExpired` (matching `reconcileCompanyCheckoutExpired`).
3. **F-3 fix (MEDIUM):** Add `isSameOriginRequest()` guard to `/api/subscription/cancel`, `/api/subscription/portal`, and `/api/subscription/checkout`.
4. **F-4 decision (LOW):** Decide whether admin-created plans grant paid entitlement or are informational only; align `effectiveSubscription` with `brokerSubscriptionHasProfileBadge`.
5. **F-5 fix (LOW):** Include `leads` in `applySubscriptionFeatures` broker query, or remove the dead lead-conversion bonus from `calculateFeaturedRank`.
