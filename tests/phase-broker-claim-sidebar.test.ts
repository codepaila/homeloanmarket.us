import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

const read = (path: string) => fs.readFileSync(path, 'utf8')

// ---------------------------------------------------------------------------
// Phase: Admin-Created Broker -> Invite -> Claim -> Broker Account
// Regression guard for the broker-sidebar source-of-truth fix.
//
// Root cause: the broker sidebar derived its role from the JWT client session
// (useSession()/useSidebarData), while the broker pages derive it from the
// authoritative database (getCurrentUser()). On a fresh client navigation the
// session role can be null/stale, so the broker navigation would vanish even
// though the page (DB) says BROKER -- the reported "dashboard shows but broker
// nav is missing" symptom.
//
// Fix: the broker server layout resolves the user from the database and feeds
// it into the sidebar, falling back to the JWT session only when unavailable.
// These assertions lock that contract so a future change cannot silently
// reintroduce the JWT-only source.
// ---------------------------------------------------------------------------

test('broker layout resolves the user from the database, not the JWT session', () => {
  const layout = read('app/broker/layout.tsx')

  assert.match(
    layout,
    /import\s*\{\s*getCurrentUser\s*\}\s*from\s*['"]@\/lib\/currentUser['"]/,
    'broker layout must import getCurrentUser from the database-backed source',
  )
  assert.match(
    layout,
    /const user = await getCurrentUser\(\)/,
    'broker layout must fetch the authenticated user from the database',
  )
  assert.match(
    layout,
    /<BrokerLayoutClient user=\{user \?\? null\}>/,
    'broker layout must pass the DB-backed user into the sidebar client',
  )
})

test('BrokerLayoutClient builds the sidebar from the DB user, not the JWT session', () => {
  const client = read('components/layout/admin/BrokerLayoutClient.tsx')

  assert.match(
    client,
    /import\s*\{\s*appSidebarData[^}]*\}\s*from\s*['"]@\/components\/layout\/admin\/sideBarData['"]/,
    'BrokerLayoutClient must import appSidebarData to build nav from the DB user',
  )
  // The DB-backed branch is used when the server-provided user exists...
  assert.match(
    client,
    /const sidebarData = user \? buildServerSidebarData\(user\) : fallbackData/,
    'when the DB user is present, the sidebar must be built from it',
  )
  // ...and appSidebarData is fed that DB user (not the JWT session).
  assert.match(
    client,
    /appSidebarData\(user as unknown as SidebarUserInput\)/,
    'the DB user must be the input to appSidebarData',
  )
  // The JWT session is only a fallback when no DB user is available.
  assert.match(
    client,
    /const fallbackData = useSidebarData\(\)/,
    'useSidebarData (JWT session) must only be the fallback',
  )
})

test('broker navigation is gated solely on role === BROKER in the DB-backed builder', () => {
  const sb = read('components/layout/admin/sideBarData.ts')

  assert.match(sb, /const isBroker = user\?\.role === "BROKER"/)
  assert.match(
    sb,
    /const brokerNavItems: SidebarItem\[\] = isBroker \? \[/,
    'broker nav must render whenever the (DB) role is BROKER',
  )

  // The broker nav array must not be suppressed by a brokerStatus /
  // verificationStatus / subscription gate, which would hide navigation for a
  // valid BROKER whose profile is FREE or pending verification.
  const brokerBlock = sb.slice(sb.indexOf('const brokerNavItems'))
  assert.doesNotMatch(
    brokerBlock,
    /isBroker \? \[\s*\{[\s\S]*?verificationStatus[\s\S]*?\}\s*:\s*\[\]/,
    'broker nav must not be gated on verificationStatus',
  )
  assert.doesNotMatch(
    brokerBlock,
    /isBroker \? \[\s*\{[\s\S]*?brokerStatus[\s\S]*?\}\s*:\s*\[\]/,
    'broker nav must not be gated on brokerStatus',
  )
})
