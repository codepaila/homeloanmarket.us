import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const page = read('app/admin/billing/broker-plans/[id]/page.tsx')
const detailApi = read('app/api/admin/broker-plans/[id]/route.ts')

// ---------------------------------------------------------------------------
// Stale-state fix: feature edits must NOT auto-save; Save plan is the boundary
// ---------------------------------------------------------------------------

test('addFeature updates local state only and does NOT auto-save', () => {
  assert.match(page, /function addFeature\(\)/)
  // No void save() immediately after setPlan inside addFeature.
  const addFeature = page.slice(page.indexOf('function addFeature()'), page.indexOf('function removeFeature'))
  assert.doesNotMatch(addFeature, /void save\(\)|await save\(\)/)
  // It builds a fresh features array with the new row.
  assert.match(addFeature, /features: \[\.\.\.plan\.features, \{ id: newClientFeatureId\(\)/)
  assert.match(addFeature, /setNewFeature\(''\)/)
})

test('removeFeature updates local state only and does NOT auto-save', () => {
  const removeFeature = page.slice(page.indexOf('function removeFeature('), page.indexOf('\n\n\n  return ('))
  assert.doesNotMatch(removeFeature, /void save\(\)|await save\(\)/)
  // Targets by stable id, not display index.
  assert.match(removeFeature, /filter\(\(f\) => f\.id !== featureId\)/)
})

test('toggleFeature updates local state only and does NOT auto-save', () => {
  const toggleFeature = page.slice(page.indexOf('function toggleFeature('), page.indexOf('function deactivate'))
  assert.doesNotMatch(toggleFeature, /void save\(\)|await save\(\)/)
  // Targets by stable id.
  assert.match(toggleFeature, /plan\.features\.map\(\(f\) => \(f\.id === featureId/)
})

test('only Save plan persists feature edits to the server', () => {
  // The PATCH with features array lives exclusively inside save().
  assert.match(page, /method: 'PATCH'/)
  assert.match(page, /features: trimmedFeatures\.map\(/)
})

// ---------------------------------------------------------------------------
// Stable feature identity (client temp id for new; DB id for persisted)
// ---------------------------------------------------------------------------

test('new features get a stable client-only temporary id', () => {
  assert.match(page, /newClientFeatureId\(\)/)
  // The temp id is template-interpolated from a monotonic seq + random suffix.
  assert.match(page, /return\s+`new-\$\{clientFeatureSeq\}-\$\{rand\}`/)
})

test('new features never send their temp id as a DB id to the server', () => {
  // Persisted rows carry DB id; new rows (prefixed "new-") omit id entirely.
  assert.match(page, /f\.id && !f\.id\.startsWith\('new-'\)/)
  assert.match(page, /\? \{ id: f\.id \} : \{\}\)/)
})

test('mutation handlers never target the sorted display index', () => {
  assert.doesNotMatch(page, /plan\.features\.map\(\(f, i\) => i === index/)
  assert.doesNotMatch(page, /\.filter\(\(_, i\) => i !== index\)/)
  // UI wires handlers with the feature id.
  assert.match(page, /removeFeature\(feature\.id\)/)
  assert.match(page, /updateFeature\(feature\.id,/)
  assert.match(page, /toggleFeature\(feature\.id,/)
})

test('feature list key is the stable id, never a derivable new-index', () => {
  assert.doesNotMatch(page, /key=\{feature\.id \|\| `new-\$/)
  assert.match(page, /key=\{feature\.id\}/)
})

// ---------------------------------------------------------------------------
// Save plan persistence boundary + validation
// ---------------------------------------------------------------------------

test('Save validates non-empty trimmed labels, max length, and duplicates', () => {
  assert.match(page, /f\.label\.trim\(\)/)
  assert.match(page, /Every feature needs a non-empty display label/)
  assert.match(page, /120 characters or fewer/)
  assert.match(page, /Duplicate feature label on this plan/)
})

test('Save refetches canonical server state only after a successful save', () => {
  assert.match(page, /if \(!response\.ok\) throw new Error\(data\.message/)
  assert.match(page, /await fetchPlan\(planId\)/)
})

test('Save failure preserves local edits (no refetch overwrite)', () => {
  assert.match(page, /catch \(error\) \{[\s\S]*?toast\.error\(error/)
  // The only fetchPlan after save sits in the success path, not the catch block.
  assert.match(page, /if \(!response\.ok\) throw new Error/)
  assert.doesNotMatch(page, /catch \(error\) \{[\s\S]*?await fetchPlan/)
})

// ---------------------------------------------------------------------------
// fetchPlan error handling
// ---------------------------------------------------------------------------

test('fetchPlan distinguishes 401/403/404/malformed/network instead of empty plan', () => {
  assert.match(page, /if \(!response\.ok\) \{/)
  assert.match(page, /data\?\.message \|\| `Unable to load plan/)
  assert.match(page, /Unable to load plan: unexpected response/)
  assert.match(page, /setLoadError\(error instanceof Error \? error\.message/)
})

// ---------------------------------------------------------------------------
// Debug logging removed
// ---------------------------------------------------------------------------

test('no debug console.log of the entire plan object remains', () => {
  assert.doesNotMatch(page, /console\.log\(plan\)/)
})

// ---------------------------------------------------------------------------
// Server-side contract stays display-only and plan-scoped
// ---------------------------------------------------------------------------

test('API rejects features that do not belong to the edited plan', () => {
  assert.match(detailApi, /One or more features do not belong to this plan/)
})

test('API handles create/update/delete of features via sync (id?/label/enabled/sortOrder)', () => {
  assert.match(detailApi, /syncPlanFeatures/)
  assert.match(detailApi, /sanitizeFeatureDrafts/)
  assert.match(detailApi, /Features must be an array of \{ id\?, label, enabled, sortOrder/)
})

test('no feature code is requested from BrokerSubscriptionPlanFeature', () => {
  assert.doesNotMatch(page, /features: \{ select: \{ code/)
  assert.doesNotMatch(detailApi, /features: \{ select: \{ code/)
  assert.doesNotMatch(page, /featureCode|entitlementCode|code: true/)
})
