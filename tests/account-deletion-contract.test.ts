import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const service = read('lib/account-deletion.ts')
const brokerSelfRoute = read('app/api/account/broker/route.ts')
const companySelfRoute = read('app/api/account/company/route.ts')
const userSelfRoute = read('app/api/account/user/route.ts')
const adminBrokerDeleteRoute = read('app/api/admin/brokers/[id]/delete/route.ts')
const adminCompanyDeleteRoute = read('app/api/admin/companies/[id]/delete/route.ts')
const rateLimit = read('lib/rateLimit.ts')
const schema = read('prisma/schema.prisma')

// ---------------------------------------------------------------------------
// Canonical service
// ---------------------------------------------------------------------------

test('a single canonical AccountDeletionService exists and exposes the required methods', () => {
  assert.match(service, /class AccountDeletionService/)
  assert.match(service, /static async deleteBrokerAccount/)
  assert.match(service, /static async deleteCompanyAccount/)
  assert.match(service, /static async deleteUserAccount/)
  // Stripe cancellation is a shared, idempotent primitive within the service.
  assert.match(service, /export async function cancelStripeSubscription/)
})

test('local destruction is executed inside a single Prisma transaction', () => {
  // MongoDB has no interactive transactions; the service uses the supported
  // sequential-operations form and must never perform bare user.delete().
  assert.match(service, /prisma\.\$transaction\(ops\)/)
  assert.doesNotMatch(service, /prisma\.user\.delete\(/)
  assert.doesNotMatch(service, /prisma\.broker\.delete\(/)
  assert.doesNotMatch(service, /prisma\.company\.delete\(/)
})

test('Stripe cancellation happens BEFORE any local destructive deletion', () => {
  const brokerMethod = service.slice(service.indexOf('static async deleteBrokerAccount'))
  const brokerTxIndex = brokerMethod.indexOf('prisma.$transaction(ops)')
  const brokerCancelIndex = brokerMethod.indexOf('cancelStripeSubscription(')
  assert.ok(brokerCancelIndex !== -1, 'broker deletion calls cancelStripeSubscription')
  assert.ok(brokerTxIndex !== -1, 'broker deletion uses a transaction')
  assert.ok(brokerCancelIndex < brokerTxIndex, 'Stripe cancellation precedes the transaction')

  const companyMethod = service.slice(service.indexOf('static async deleteCompanyAccount'))
  const companyTxIndex = companyMethod.indexOf('prisma.$transaction(ops)')
  const companyCancelIndex = companyMethod.indexOf('cancelStripeSubscription(')
  assert.ok(companyCancelIndex !== -1, 'company deletion calls cancelStripeSubscription')
  assert.ok(companyTxIndex !== -1, 'company deletion uses a transaction')
  assert.ok(companyCancelIndex < companyTxIndex, 'Stripe cancellation precedes the transaction')
})

test('failed Stripe cancellation aborts with a safe error and never deletes the account', () => {
  assert.match(service, /AccountDeletionStripeError/)
  assert.match(service, /class AccountDeletionStripeError extends AccountDeletionError/)
  assert.match(service, /STRIPE_CANCELLATION_FAILED/)
  // Idempotent: already-canceled and resource-missing subscriptions continue.
  assert.match(service, /already-cancelled/)
  assert.match(service, /outcome: 'missing'/)
  assert.match(service, /isTerminalStripeStatus\(subscription\.status\)/)
})

// ---------------------------------------------------------------------------
// NoAction / Restrict relationship handling
// ---------------------------------------------------------------------------

test('claim lifecycle (NoAction) is explicitly cleaned in dependency order', () => {
  const opsSection = service.slice(service.indexOf('export function buildBrokerDeletionOps'))
  const eventIdx = opsSection.indexOf('brokerClaimEvent.deleteMany')
  const invitationIdx = opsSection.indexOf('brokerClaimInvitation.deleteMany')
  const claimIdx = opsSection.indexOf('brokerClaim.deleteMany')
  assert.ok(eventIdx !== -1 && invitationIdx !== -1 && claimIdx !== -1)
  // events -> invitations -> claim
  assert.ok(eventIdx < invitationIdx && invitationIdx < claimIdx, 'claim children deleted before the claim row')
})

test('broker-owned Restrict rows and the Broker row itself are deleted explicitly', () => {
  const opsSection = service.slice(service.indexOf('export function buildBrokerDeletionOps'))
  for (const token of [
    'brokerBank.deleteMany',
    'contactMessage.deleteMany',
    'review.deleteMany',
    'brokerSubscription.deleteMany',
    'broker.deleteMany',
  ]) {
    assert.ok(opsSection.includes(token), `expected ${token} in broker deletion ops`)
  }
  // The Broker row is removed only after its Restrict dependents.
  assert.ok(opsSection.indexOf('broker.deleteMany') > opsSection.indexOf('brokerBank.deleteMany'))
})

test('User-owned records are explicitly removed before the User row', () => {
  const ops = service.slice(service.indexOf('function userDeletionOps'))
  for (const token of [
    'notification.deleteMany',
    'supportMessage.deleteMany',
    'supportTicket.deleteMany',
    'message.deleteMany',
    'contactMessage.deleteMany',
    'review.deleteMany',
    'companyAdRequest.deleteMany',
    'secureConfig.updateMany',
    'user.deleteMany',
  ]) {
    assert.ok(ops.includes(token), `expected ${token} in user deletion ops`)
  }
  assert.ok(ops.indexOf('user.deleteMany') > ops.indexOf('notification.deleteMany'))
  assert.ok(ops.indexOf('user.deleteMany') > ops.indexOf('supportTicket.deleteMany'))
  assert.ok(ops.indexOf('user.deleteMany') > ops.indexOf('message.deleteMany'))
})

test('BrokerRegistration (registration flow) is removed with the broker account', () => {
  const ops = service.slice(service.indexOf('export function buildBrokerDeletionOps'))
  assert.match(ops, /brokerRegistration\.deleteMany/)
})

test('company deletion removes advertisements, requests, subscription, and memberships', () => {
  const ops = service.slice(service.indexOf('export function buildCompanyDeletionOps'))
  for (const token of [
    'advertisement.deleteMany',
    'companyAdRequest.deleteMany',
    'companySubscription.deleteMany',
    'companyMembership.deleteMany',
    'company.deleteMany',
  ]) {
    assert.ok(ops.includes(token), `expected ${token} in company deletion ops`)
  }
})

test('CompanyAdvertisingPlan is never deleted or mutated', () => {
  assert.doesNotMatch(service, /companyAdvertisingPlan\.delete/)
  assert.doesNotMatch(service, /advertisingPlan\.delete/)
  // The schema keeps the plan->subscription relation as SetNull, so deleting a
  // company subscription never deletes the global plan.
  assert.match(schema, /advertisingPlan CompanyAdvertisingPlan\? @relation\(fields: \[planId\], references: \[id\], onDelete: SetNull\)/)
})

test('media cleanup is reference-aware and never blindly deletes uploads', () => {
  assert.match(service, /planMediaCleanup/)
  assert.match(service, /assetIdsToDelete/)
  assert.match(service, /desktopMediaId: asset\.id/)
  assert.match(service, /mobileMediaId: asset\.id/)
  assert.match(service, /advertisementCreative\.count/)
  assert.match(service, /desktopRefs \+ mobileRefs \+ creativeRefs === 0/)
  // Ads being deleted in the same transaction are excluded from the reference
  // count so their media is still cleaned up without touching shared assets.
  assert.match(service, /notInAds/)
})

test('broker deletion never orphans a Broker when the User is deleted', () => {
  // The Broker -> User relation is NoAction in the schema, so deleting a User
  // alone would leave the Broker behind; the service deletes the Broker row
  // explicitly regardless of whether the User row survives.
  assert.match(schema, /user\s+User\?\s+@relation\(fields: \[userId\], references: \[id\], onDelete: NoAction\)/)
  assert.match(service, /broker\.deleteMany\(\{ where: \{ id: brokerId \} \}\)/)
})

// ---------------------------------------------------------------------------
// User deletion policy
// ---------------------------------------------------------------------------

test('a User is only deleted when they have no remaining independent context', () => {
  assert.match(service, /userHasIndependentContext/)
  assert.match(service, /canDeleteUser/)
  assert.match(service, /companyMembership\.findFirst/)
  assert.match(service, /broker\.findFirst/)
  assert.match(service, /excludeBrokerId/)
  assert.match(service, /excludeCompanyId/)
})

test('ADMIN accounts can never be deleted through broker/company endpoints', () => {
  assert.match(service, /ADMIN_DELETION_FORBIDDEN/)
  assert.match(service, /SELF_ADMIN_DELETION_FORBIDDEN/)
  assert.match(service, /user\.role === 'ADMIN'/)
  assert.match(service, /member\.role === 'ADMIN'/)
})

// ---------------------------------------------------------------------------
// Self-service routes
// ---------------------------------------------------------------------------

test('self-service routes resolve the target from the authenticated session, never the client', () => {
  for (const route of [brokerSelfRoute, companySelfRoute, userSelfRoute]) {
    assert.match(route, /getCurrentUser\(\)/)
  }
  assert.match(brokerSelfRoute, /broker\.findFirst\(\{\s*where: \{ userId: user\.id \}/)
  assert.match(companySelfRoute, /companyMembership\.findFirst\(\{\s*where: \{ userId: user\.id, role: 'OWNER', isActive: true \}/)
  assert.match(userSelfRoute, /userId: user\.id/)
  // No arbitrary /api/account/:userId style client-controlled targets.
  assert.doesNotMatch(brokerSelfRoute, /userId\??: request\./)
  assert.doesNotMatch(companySelfRoute, /userId\??: request\./)
})

test('self-service routes reject unauthenticated requests and admin self-deletion', () => {
  for (const route of [brokerSelfRoute, companySelfRoute, userSelfRoute]) {
    assert.match(route, /Authentication required/)
    assert.match(route, /user\.role === 'ADMIN'/)
    assert.match(route, /403/)
  }
})

test('self-service company deletion verifies OWNER membership server-side', () => {
  assert.match(companySelfRoute, /role: 'OWNER'/)
  assert.match(companySelfRoute, /Only the company owner can delete the company account/)
})

test('all deletion routes require explicit confirmation and are rate limited', () => {
  for (const route of [brokerSelfRoute, companySelfRoute, userSelfRoute, adminBrokerDeleteRoute, adminCompanyDeleteRoute]) {
    assert.match(route, /confirm !== true/)
    assert.match(route, /accountDeletionRateLimit/)
    assert.match(route, /429/)
  }
  assert.match(rateLimit, /accountDeletionRateLimit/)
})

test('self-service routes are origin-checked and invalidate the session on success', () => {
  for (const route of [brokerSelfRoute, companySelfRoute, userSelfRoute]) {
    assert.match(route, /isSameOriginRequest/)
  }
  // The client signs out after a successful self-service deletion (JWT strategy).
  const dialog = read('components/account/DeleteAccountDialog.tsx')
  assert.match(dialog, /signOutAfterSuccess/)
  assert.match(dialog, /signOut\(\{ callbackUrl: '\/' \}\)/)
  // Server-side defense-in-depth: a session whose user row was deleted is
  // cleared by the JWT refresh callback on its next use.
  const authConfig = read('lib/auth.config.ts')
  assert.match(authConfig, /The account no longer exists in the database/)
  assert.match(authConfig, /return \{\} as any;/)
})

test('self-service routes never accept a user-supplied target id', () => {
  // No request-body / query id is used to select the deletion target.
  assert.doesNotMatch(brokerSelfRoute, /body\.userId/)
  assert.doesNotMatch(companySelfRoute, /body\.companyId/)
  assert.doesNotMatch(userSelfRoute, /body\.userId/)
})

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

test('admin deletion routes require the ADMIN role server-side', () => {
  for (const route of [adminBrokerDeleteRoute, adminCompanyDeleteRoute]) {
    assert.match(route, /admin\.role !== 'ADMIN'/)
    assert.match(route, /Forbidden/)
    assert.match(route, /401/)
    assert.match(route, /403/)
  }
})

test('admin deletion targets come only from validated route parameters', () => {
  assert.match(adminBrokerDeleteRoute, /params: Promise<\{ id: string \}>/)
  assert.match(adminBrokerDeleteRoute, /brokerId: id/)
  assert.match(adminCompanyDeleteRoute, /companyId: id/)
  // The client can never supply ownership/claim information.
  assert.doesNotMatch(adminBrokerDeleteRoute, /body\.brokerId/)
  assert.doesNotMatch(adminCompanyDeleteRoute, /body\.companyId/)
})

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

test('self-service and admin deletion entry points are wired in the UI', () => {
  const brokerDashboard = read('app/broker/dashboard/page.tsx')
  const companyDashboard = read('app/company/dashboard/page.tsx')
  const adminBrokerActions = read('app/admin/brokers/[id]/AdminBrokerActions.tsx')
  const adminCompanies = read('app/admin/companies/page.tsx')

  assert.match(brokerDashboard, /DeleteAccountDialog/)
  assert.match(brokerDashboard, /\/api\/account\/broker/)
  assert.match(companyDashboard, /DeleteAccountDialog/)
  assert.match(companyDashboard, /\/api\/account\/company/)
  assert.match(adminBrokerActions, /\/api\/admin\/brokers\/\$\{broker\.id\}\/delete/)
  assert.match(adminCompanies, /\/api\/admin\/companies\/\$\{company\.id\}\/delete/)
})

test('confirmation UX requires typing a phrase, not a single click', () => {
  const dialog = read('components/account/DeleteAccountDialog.tsx')
  assert.match(dialog, /confirmPhrase/)
  assert.match(dialog, /to confirm\s+this permanent action/)
  assert.match(dialog, /enabled = phrase\.trim\(\)\.toUpperCase\(\) === confirmPhrase/)
  assert.match(dialog, /disabled=\{!enabled \|\| busy\}/)
})
