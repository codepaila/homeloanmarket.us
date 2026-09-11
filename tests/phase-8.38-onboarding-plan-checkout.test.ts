import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const onboarding = read('app/company/onboarding/CompanyOnboarding.tsx')
const planCoupon = read('components/company/CompanyPlanAndCoupon.tsx')
const selectPage = read('app/company/subscription/select/CompanySubscriptionSelect.tsx')
const selectPageServer = read('app/company/subscription/select/page.tsx')

// ===========================================================================
// PHASE — INTEGRATE COMPANY PLAN + COUPON + CHECKOUT INTO ONBOARDING
// ===========================================================================

// ---------- Wizard structure ----------

test('onboarding is now a 5-step wizard ending at Review & Checkout', () => {
  assert.match(onboarding, /const steps = \['Company Information', 'Contact Information', 'Advertisement Information', 'Advertising Plan', 'Review & Checkout'\]/)
})

test('Steps 1-3 profile fields are preserved unchanged', () => {
  assert.match(onboarding, /label="Company name"/)
  assert.match(onboarding, /Home Loan Company/)
  assert.match(onboarding, /HELOC Company/)
  assert.match(onboarding, /DSCR Loan Company/)
  assert.match(onboarding, /Title Company/)
  assert.match(onboarding, /Home Insurance Company/)
  assert.match(onboarding, /label="Company address"/)
  assert.match(onboarding, /label="Your name"/)
  assert.match(onboarding, /label="Your position"/)
  assert.match(onboarding, /label="Your phone"/)
  assert.match(onboarding, /bannerAddress/)
  assert.match(onboarding, /bannerPhone/)
})

// ---------- Step 4: plan + coupon ----------

test('Step 4 renders the shared CompanyPlanAndCoupon component', () => {
  assert.match(onboarding, /step === 3 && \(/)
  assert.match(onboarding, /<CompanyPlanAndCoupon/)
})

test('Step 4 keeps the selected plan and applied coupon while navigating', () => {
  // Plan + coupon live in parent wizard state (survive Step 4 -> Step 5 -> Step 4).
  assert.match(onboarding, /const \[selectedPlan, setSelectedPlan\] = useState/)
  assert.match(onboarding, /const \[appliedCouponCode, setAppliedCouponCode\] = useState/)
  assert.match(onboarding, /const \[couponPreview, setCouponPreview\] = useState/)
  assert.match(onboarding, /selectedPlanId=\{selectedPlan\?\.id \?\? null\}/)
  assert.match(onboarding, /onSelectPlan=\{\(plan\) => setSelectedPlan\(plan\)\}/)
  assert.match(onboarding, /onCouponChange=\{\(code, preview\) =>/)
})

test('shared component loads the canonical plan API and validates coupons server-side', () => {
  assert.match(planCoupon, /\/api\/company\/subscription\/plans/)
  assert.match(planCoupon, /\/api\/company\/subscription\/coupon\/validate/)
  // No client-side price/IDs are authoritative.
  assert.doesNotMatch(planCoupon, /stripePriceId|stripeProductId|promotionCodeId|companyId|userId/)
})

// ---------- Step 5: review & checkout ----------

test('Step 5 renders the review summary and a preview-only total', () => {
  assert.match(onboarding, /step === 4 && \(/)
  assert.match(onboarding, /Advertising Plan/)
  assert.match(onboarding, /Coupon/)
  assert.match(onboarding, /Subtotal/)
  assert.match(onboarding, /Discount/)
  assert.match(onboarding, /Set at Stripe checkout/)
  assert.match(onboarding, /preview only/)
  // The browser never computes an authoritative final amount.
  assert.doesNotMatch(onboarding, /finalPrice|priceAfterCoupon|discountedPrice|total =/)
})

// ---------- Critical checkout ordering ----------

test('final checkout PATCHes onboarding FIRST, then calls checkout only after success', () => {
  const patchIndex = onboarding.indexOf("fetch('/api/company/onboarding'")
  const checkoutIndex = onboarding.indexOf("fetch('/api/company/subscription/checkout'")
  assert.ok(patchIndex !== -1, 'onboarding PATCH exists')
  assert.ok(checkoutIndex !== -1, 'checkout API call exists')
  assert.ok(patchIndex < checkoutIndex, 'PATCH precedes checkout in the handler')
  // The checkout call only runs inside the same try block AFTER the PATCH ok-guard.
  assert.match(onboarding, /if \(!patchResponse\.ok\) throw new Error/)
  assert.match(onboarding, /setPhase\('checkout'\)/)
})

test('checkout receives selected planId and applied coupon code only', () => {
  assert.match(onboarding, /body: JSON\.stringify\(\{ planId: selectedPlan\.id, couponCode: appliedCouponCode \}\)/)
  // The browser only sends the canonical plan id + human coupon code.
  assert.doesNotMatch(onboarding, /planId: body\.|body\.price|body\.stripePriceId|body\.promotionCodeId|body\.companyId/)
})

test('no plan selected blocks checkout and returns the user to Step 4', () => {
  assert.match(onboarding, /Please select an advertising plan\./)
  assert.match(onboarding, /setStep\(3\)/)
})

test('a missing Stripe URL is treated as an error (never navigates to undefined)', () => {
  assert.match(onboarding, /Stripe checkout is unavailable\. Please try again\./)
  assert.match(onboarding, /window\.location\.assign\(checkoutResult\.url\)/)
})

test('duplicate final checkout submissions are prevented (loading/disabled pattern)', () => {
  assert.match(onboarding, /loading=\{phase !== 'idle'\}/)
  assert.match(onboarding, /phase !== 'idle'/)
})

// ---------- Subscription select remains as recovery (not the normal path) ----------

test('subscription select page remains available as recovery and reuses the shared component', () => {
  assert.match(selectPage, /CompanyPlanAndCoupon/)
  assert.match(selectPage, /\/api\/company\/subscription\/checkout/)
  assert.match(selectPage, /couponCode: appliedCouponCode/)
  // The normal onboarding flow no longer routes through select.
  assert.match(selectPageServer, /getCompanyOnboardingStatus/)
  assert.match(selectPageServer, /PROFILE_INCOMPLETE/)
})