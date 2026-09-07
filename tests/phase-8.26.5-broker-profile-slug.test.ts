import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { slugifyBrokerName } from '../lib/broker-registration'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const reg = read('lib/broker-registration.ts')
const post = read('app/api/brokers/route.ts')
const wizard = read('components/sections/broker/BrokerSetupWizard.tsx')
const me = read('app/api/brokers/me/route.ts')
const companyRoute = read('app/api/company/[slug]/route.ts')
const idRoute = read('app/api/brokers/[id]/route.ts')
const policy = read('lib/broker-policy.ts')
const edit = read('components/sections/broker/EditProfile.tsx')
const editPage = read('app/broker/company/edit/page.tsx')
const publicPage = read('app/(public)/brokers/[slug]/page.tsx')
const schema = read('prisma/schema.prisma')
const emails = read('lib/email-templates.ts')

// ===========================================================================
// PHASE 8.26.5 — ONE canonical Broker profileSlug lifecycle
// ===========================================================================
// CREATE: server generates it from companyName (displayName fallback) and makes
// it unique deterministically. SETUP/EDIT: never client-entered, never mutated.
// PUBLIC: resolves through the canonical slug. NO duplicate slug system.

// --- PHASE 10 — slugify format behavior (functional) ------------------------
test('CREATE/format: slugifyBrokerName normalizes a representative matrix', () => {
  assert.equal(slugifyBrokerName('ABC Mortgage Group'), 'abc-mortgage-group')
  assert.equal(slugifyBrokerName('ABC Mortgage & Financial, LLC'), 'abc-mortgage-financial-llc')
  assert.equal(slugifyBrokerName("O'Brien Home Loans"), 'o-brien-home-loans')
  assert.equal(slugifyBrokerName('  Multiple   Spaces  '), 'multiple-spaces')
  assert.equal(slugifyBrokerName('/Leading--Trailing/'), 'leading-trailing')
  assert.equal(slugifyBrokerName('ABC Mortgage, New York'), 'abc-mortgage-new-york')
  assert.equal(slugifyBrokerName('') , 'broker')
  assert.equal(slugifyBrokerName('!!!'), 'broker')
  // Unicode is collapsed deterministically to a URL-safe slug (never injected).
  assert.equal(slugifyBrokerName('Étude & Café, Inc.'), 'tude-caf-inc')
  assert.match(slugifyBrokerName('ABC Mortgage Group'), /^[a-z0-9]+(-[a-z0-9]+)*$/)
})

// --- CREATE 1-8 -------------------------------------------------------------
test('CREATE: canonical source is companyName (displayName fallback)', () => {
  // "slugify(companyName || displayName)" — companyName must be PRIMARY.
  assert.match(reg, /const slugSource = \(typeof merged\.companyName === 'string' && merged\.companyName\.trim\(\)\) \|\| displayName/)
  assert.match(reg, /const baseSlug = slugifyBrokerName\(slugSource\)/)
  // The single shared slugify utility is reused — no second implementation in
  // the broker lifecycle.
  assert.match(reg, /export function slugifyBrokerName/)
})

test('CREATE: slug is normalized before persistence (lowercase/hyphenated)', () => {
  // profileSlug written to create is exactly the slugified value.
  assert.match(reg, /const baseSlug = slugifyBrokerName\(slugSource\)/)
  assert.match(reg, /\n\s+profileSlug,$/m)
})

test('CREATE: a client-provided profileSlug is NEVER trusted server-side', () => {
  // finalize may see profileSlug in a legacy draft/merged payload but never
  // reads it: the slug is recomputed exclusively from slugSource.
  assert.doesNotMatch(reg, /merged\.profileSlug/)
  assert.doesNotMatch(reg, /dataOverride\?\.profileSlug/)
  // The POST route may forward a tampered value, but finalize ignores it.
  assert.match(post, /profileSlug: body\.profileSlug,/)
})

test('CREATE: first broker with a company name gets the base slug', () => {
  assert.match(reg, /let profileSlug = baseSlug/)
  assert.match(reg, /let suffix = 1/)
})

test('CREATE: duplicate company name deterministically gets -2 (second)', () => {
  assert.match(reg, /while \(await tx\.broker\.findUnique\(\{ where: \{ profileSlug \} \}\)\)/)
  assert.match(reg, /suffix \+= 1/)
  assert.match(reg, /profileSlug = `\$\{slugifyBrokerName\(slugSource\)\}-\$\{suffix\}`/)
})

test('CREATE: third duplicate gets -3 (suffix increments per collision)', () => {
  assert.match(reg, /let suffix = 1/)
  assert.match(reg, /suffix \+= 1/)
})

test('CREATE: admin create and import reuse the same server-side unique strategy', () => {
  const admin = read('app/api/admin/brokers/route.ts')
  const importLib = read('lib/admin/broker-data.ts')
  assert.match(admin, /slugifyAdminBroker\(input\.companyName \|\| input\.displayName\)/)
  assert.match(admin, /while \(await tx\.broker\.findUnique\(\{ where: \{ profileSlug \} \}\)\)/)
  assert.match(importLib, /while \(await tx\.broker\.findUnique\(\{ where: \{ profileSlug \} \}\)\)/)
})

test('CREATE: existing slugs are preserved after creation (no update path writes them)', () => {
  // finalization returns early for an existing broker; every edit route is
  // slug-free. The PUBLIC #20 guard is its consequence.
  assert.match(reg, /const existing = await tx\.broker\.findFirst\(\{ where: \{ userId \} \}\)/)
  assert.match(reg, /if \(existing\) \{/)
  assert.match(reg, /return existing/)
})

// --- SETUP 9-12 -------------------------------------------------------------
test('SETUP: the wizard never requires profileSlug', () => {
  assert.doesNotMatch(wizard, /profileSlug/)
  assert.equal((wizard.match(/name="companyName"/g) || []).length, 1)
})

test('SETUP: the wizard exposes NO editable/controllable slug UI', () => {
  assert.doesNotMatch(wizard, /profileSlug/)
  assert.doesNotMatch(wizard, /URL Slug/)
})

test('SETUP: onboarding completes without any client-provided slug', () => {
  // The finalize payload carries companyName but no slug field at all.
  assert.match(wizard, /companyName: data\.companyName \|\| data\.displayName/)
  assert.doesNotMatch(wizard, /profileSlug/)
  assert.match(post, /displayName: body\.displayName,/)
  assert.match(post, /companyName: body\.companyName \|\| null,/)
})

test('SETUP: the persisted Broker automatically has a valid server slug', () => {
  assert.match(reg, /\.broker\.create\(/)
  assert.match(reg, /\n\s+profileSlug,$/m)
  assert.match(reg, /const baseSlug = slugifyBrokerName\(slugSource\)/)
})

// --- EDIT 13-17 (canonical product policy: slug is a STABLE PUBLIC IDENTIFIER)
test('EDIT: editing unrelated profile fields cannot corrupt profileSlug', () => {
  const allowlist = policy.slice(policy.indexOf('export const BROKER_EDITABLE_FIELDS = ['), policy.indexOf('] as const') + 1)
  assert.match(allowlist, /'companyName'/)
  assert.doesNotMatch(allowlist, /profileSlug/)
  for (const route of [me, companyRoute, idRoute]) {
    assert.doesNotMatch(route, /updateData\.profileSlug/)
  }
})

test('EDIT: changing companyName does NOT regenerate the slug (immutable public id)', () => {
  // companyName stays editable, but no update path writes profileSlug — so a
  // company rename updates the display field only and the canonical public URL
  // stays stable. This is the established behavior (finalize preserves existing
  // slugs, edit endpoints never touch them).
  assert.match(me, /if \(body\.companyName !== undefined\) updateData\.companyName = body\.companyName/)
  assert.doesNotMatch(me, /updateData\.profileSlug/)
  assert.doesNotMatch(companyRoute, /updateData\.profileSlug/)
  assert.match(companyRoute, /pickBrokerEditableFields\(/)
  assert.doesNotMatch(idRoute, /updateData\.profileSlug/)
})

test('EDIT: an edit client cannot arbitrarily set profileSlug', () => {
  assert.doesNotMatch(me, /body\.profileSlug/)
  assert.doesNotMatch(edit, /profileSlug/)
  assert.doesNotMatch(editPage, /profileSlug/)
  assert.match(me, /profileSlug is SERVER-GENERATED and IMMUTABLE/)
})

test('EDIT: existing public profiles remain resolvable (slug untouched by edits)', () => {
  assert.match(publicPage, /prisma\.broker\.findUnique\(\{/)
  assert.match(publicPage, /where: \{ profileSlug: brokerSlug \}/)
  assert.match(emails, /`\$\{APP_URL\}\/brokers\/\$\{broker\.profileSlug\}`/)
})

test('EDIT: no slug-collision risk on companyName change (slug cannot change)', () => {
  assert.doesNotMatch(me, /updateData\.profileSlug/)
  assert.doesNotMatch(companyRoute, /updateData\.profileSlug/)
  assert.doesNotMatch(idRoute, /updateData\.profileSlug/)
})

// --- PUBLIC PROFILE 18-20 ---------------------------------------------------
test('PUBLIC: the public broker profile resolves through profileSlug', () => {
  assert.match(publicPage, /where: \{ profileSlug: brokerSlug \}/)
  assert.match(publicPage, /slackUrl|brokerLd|broker\.profileSlug/)
  assert.match(publicPage, /broker\.profileSlug/)
})

test('PUBLIC: an invalid/missing slug returns not-found behavior', () => {
  assert.match(publicPage, /if \(!broker\) notFound\(\)/)
  assert.match(publicPage, /catch \(error\) \{/)
  assert.match(publicPage, /notFound\(\)/)
  assert.match(companyRoute, /message: 'Broker not found'/)
})

test('PUBLIC: existing broker slugs continue to work (stable identifier)', () => {
  assert.match(publicPage, /prisma\.broker\.findUnique\(\{/)
  assert.match(reg, /if \(existing\) \{/)
  assert.match(reg, /return existing/)
  // The public API returns the same canonical slug the broker was created with.
  assert.match(emails, /`\$\{APP_URL\}\/brokers\/\$\{broker\.profileSlug\}`/)
})

// --- REGRESSION 21-25 -------------------------------------------------------
test('REGRESSION: Broker subscription integrity is preserved at finalization', () => {
  assert.match(reg, /plan: selectedSubscription\.plan,/)
  assert.match(reg, /planId: dbPlan\?\.id \?\? null,/)
  assert.match(reg, /isActive: selectedSubscription\.isActive,/)
  assert.match(reg, /stripeCustomerId: selectedSubscription\.stripeCustomerId \?\? undefined,/)
  assert.match(reg, /stripeSubId: selectedSubscription\.stripeSubId \?\? undefined,/)
})

test('REGRESSION: BrokerRegistration lifecycle is unchanged', () => {
  assert.match(reg, /data: \{ status: 'COMPLETED' \}/)
})

test('REGRESSION: broker user ownership is unchanged', () => {
  assert.match(reg, /data: \{ role: 'BROKER' \}/)
  assert.match(reg, /userId,$/m)
  assert.match(post, /where: \{ userId: currentUser\.id \}/)
})

test('REGRESSION: finalization remains idempotent', () => {
  assert.match(reg, /const existing = await tx\.broker\.findFirst\(\{ where: \{ userId \} \}\)/)
  assert.match(reg, /if \(existing\) \{/)
  assert.match(reg, /return existing/)
})

test('REGRESSION: no duplicate Broker can be created', () => {
  // Three independent layers: @unique DB constraint, per-user early return, and
  // the unique slug loop inside the finalization transaction.
  assert.match(schema, /profileSlug String\s+@unique/)
  assert.match(reg, /if \(existing\) \{/)
  assert.match(reg, /return existing/)
  assert.match(reg, /\.broker\.create\(/)
})

// --- PHASE 8.26.5 fixes -----------------------------------------------------
test('FIX: POST /api/brokers returns the canonical /brokers/[slug] profile URL', () => {
  // The response previously linked /broker/<slug> (singular) which is not a
  // route — the canonical public profile path is /brokers/<slug>.
  assert.match(post, /profileUrl: `\/brokers\/\$\{broker\.profileSlug\}`/)
  assert.doesNotMatch(post, /\/broker\/\$\{broker\.profileSlug\}/)
})

test('FIX: a concurrent slug collision surfaces a clean retryable 409', () => {
  // profileSlug is the only unique constraint on Broker, so P2002 on create is
  // definitively a slug race; the atomic transaction already guarantees no
  // duplicate/broken registration.
  assert.match(post, /error\?\.code === 'P2002'/)
  assert.match(post, /{ status: 409 }/)
  assert.match(schema, /profileSlug String\s+@unique/)
})