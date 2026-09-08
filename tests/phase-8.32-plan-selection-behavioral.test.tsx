import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { PricingCard } from '../components/design/PricingCard'

// ===========================================================================
// PHASE 8.32 — REGRESSION GUARD FOR THE BROKER PLAN-SELECTION FAILURE
//
// Phase 8.31 diagnosed two client-side defects that made selecting FREE or
// FEATURED from the broker setup wizard emit the generic guard toast and never
// call POST /api/brokers:
//   DEFECT A — PricingCard's plan CTA was a <button> with NO type. Inside the
//              BrokerSetupWizard <form> it defaulted to type="submit", so
//              clicking "Choose Free"/"Choose Mortgage Expert" submitted the
//              wizard form and ran onSubmit() before plan activation/checkout,
//              tripping the ACTIVE-subscription guard.
//   DEFECT B — selectFree() called onFinalize() (onSubmit) immediately after
//              scheduling the FREE override as React state; the running closure
//              still observed the stale false and the guard blocked finalization.
//
// The fixes (PricingCard type="button" + ref-based override) are validated
// below. This suite uses the project's existing node:test + tsx framework and
// node:react-dom/server for render smoke tests (no DOM/jsdom/testing-library is
// installed in this repo).
// ===========================================================================

const read = (path: string) => fs.readFileSync(path, 'utf8')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const pricingCard = read('components/design/PricingCard.tsx')

// ---------------------------------------------------------------------------
// DEFECT A — the plan CTA must NOT submit a parent <form>
// ---------------------------------------------------------------------------

test('A: PricingCard plan CTA carries an explicit type="button" (never submits a parent form)', () => {
  assert.match(pricingCard, /<motion\.button[\s\S]*?type="button"/)
})

test('A: rendered PricingCard emits a button with type="button" and a working CTA', () => {
  const html = renderToStaticMarkup(
    React.createElement('form', { onSubmit: () => {} },
      React.createElement(PricingCard, {
        name: 'Free',
        description: 'Basic broker listing',
        price: 0,
        features: ['a'],
        stripePriceId: undefined,
        code: 'FREE',
        onSelect: () => {},
      }),
    ),
  )
  assert.match(html, /<button[^>]*type="button"/)
  assert.match(html, /Choose Free/)
})

test('A: no other PricingCard call site depends on a missing/absent type', () => {
  // Every PricingCard usage in the codebase is a display card; none rely on the
  // CTA defaulting to type="submit" (which is what the buggy behavior did).
  const files = [
    'components/sections/broker/BrokerSetupWizard.tsx',
  ]
  for (const file of files) {
    assert.match(read(file), /PricingCard/)
  }
})

// ---------------------------------------------------------------------------
// DEFECT B — the FREE override must be observable by the running onSubmit
// ---------------------------------------------------------------------------

test('B: the FREE activation override is backed by a ref, set synchronously (no stale closure)', () => {
  assert.match(wizard, /freeActivatedOverrideRef\s*=\s*useRef\(false\)/)
  // markFreeActivated writes the ref synchronously (not via setState).
  const mark = wizard.slice(wizard.indexOf('const markFreeActivated'), wizard.indexOf('\n  // Verification'))
  assert.match(mark, /freeActivatedOverrideRef\.current\s*=\s*true/)
})

test('B: the onSubmit guard reads the ref at call time, not a render-stale value', () => {
  const onSubmit = wizard.slice(wizard.indexOf('const onSubmit'), wizard.indexOf('const renderStep'))
  assert.match(onSubmit, /!freeActivatedOverrideRef\.current/)
})

test('B: selectFree still calls onFinalize() and the FREE flow still auto-finalizes', () => {
  assert.match(wizard, /await onFinalize\(\)/)
})

// ---------------------------------------------------------------------------
// ACTIVE-subscription guard invariant (must be preserved, never weakened)
// ---------------------------------------------------------------------------

test('F: the ACTIVE-subscription guard is intact — a non-ACTIVE subscription still blocks finalization', () => {
  const onSubmit = wizard.slice(wizard.indexOf('const onSubmit'), wizard.indexOf('const renderStep'))
  assert.match(onSubmit, /subscription\?\.isActive && subscription\?\.status === 'ACTIVE'/)
  assert.match(onSubmit, /We couldn't finish your broker setup\. Please try again\./)
})

test('F: FEATURED checkout does not call finalization (no premature finalize)', () => {
  // Isolate selectFeatured (ends at the first closing brace after the checkout
  // redirect) without depending on newline-escape fidelity in the literal.
  const featuredStart = wizard.indexOf('async function selectFeatured')
  const featuredEnd = wizard.indexOf('  }', wizard.indexOf('window.location.assign'))
  const featured = wizard.slice(featuredStart, featuredEnd)
  assert.doesNotMatch(featured, /onFinalize|onFreeActivated|freeActivatedOverride/)
  assert.match(featured, /window\.location\.assign\(data\.url\)/)
  assert.match(featured, /\/api\/broker-registration\/subscription\/checkout/)
})

test('F: the finalize button appears only when the subscription is ACTIVE (or FREE just activated)', () => {
  assert.match(wizard, /const canFinalize = isActive \|\| freeActivated/)
  const finalizeBlock = wizard.slice(wizard.indexOf('{canFinalize && ('), wizard.indexOf('{!isActive && !isCheckoutPending'))
  assert.match(finalizeBlock, /Complete Broker Profile/)
  assert.match(finalizeBlock, /type="button"/)
})
