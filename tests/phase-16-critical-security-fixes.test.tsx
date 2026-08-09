import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { toPublicBrokerRecord } from '../lib/public-broker'
import EditPersonalProfile from '../components/sections/broker/EditPersonalProfile'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

const mockRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => Promise.resolve(),
  fastRefresh: () => Promise.resolve(),
}

// =============================================================
// C1 — JWT session.update() privilege escalation
// =============================================================

test('C1: the JWT callback never merges client-supplied session.user into the token', () => {
  const source = read('lib/auth.config.ts')
  assert.equal(source.includes('...session.user'), false, 'client session.user must never be spread into the token')
  assert.equal(/trigger === "update" && session/.test(source), false, 'client-update merge branch must not exist')
})

test('C1: identity claims are only re-derived from the trusted database', () => {
  const source = read('lib/auth.config.ts')
  assert.ok(source.includes('prisma.user.findUnique'), 'database identity refresh must remain')
  assert.ok(source.includes('token.email as string'), 'refresh must key off the server-issued token email')
})

test('C1: every legitimate session refresh call is no-argument (removing the merge preserves them)', () => {
  const consumers = [
    'app/claim-broker/continue/page.tsx',
    'app/claim-broker/[token]/page.tsx',
    'components/sections/broker/BrokerSetupWizard.tsx',
  ]
  for (const file of consumers) {
    const source = read(file)
    assert.equal(source.includes('refreshSession({'), false, `${file}: refreshSession must not be called with data`)
    const matches = source.match(/refreshSession\(/g) || []
    assert.ok(matches.length > 0, `${file}: expected a refreshSession() consumer`)
    // every call site must be `refreshSession()` with no arguments
    let from = 0
    for (let i = 0; i < matches.length; i++) {
      const index = source.indexOf('refreshSession(', from)
      const rest = source.slice(index + 'refreshSession('.length).trimStart()
      assert.ok(rest.startsWith(')'), `${file}: refreshSession must be called with no arguments`)
      from = index + 'refreshSession('.length
    }
  }
})

// =============================================================
// C2 — Public broker contact form / lead creation
// =============================================================

test('C2: the public broker record carries the canonical profileSlug and strips id/PII', () => {
  const record = toPublicBrokerRecord({
    id: 'internal-id',
    profileSlug: 'acme-mortgage',
    userId: 'owner-user',
    contactMessages: [{ id: 'm', email: 'lead@x.com', message: 'hi' }],
    phone: '+1-555-0100',
    email: 'broker@acme.com',
    companyName: 'Acme Mortgage',
    city: 'Austin',
  }) as Record<string, unknown>
  assert.equal(record.id, undefined, 'internal id must not be exposed')
  assert.equal(record.userId, undefined, 'owner user id must not be exposed')
  assert.equal(record.contactMessages, undefined, 'lead PII must not be exposed')
  assert.equal(record.profileSlug, 'acme-mortgage', 'profileSlug must be available to the client')
})

test('C2: contacts/send resolves the broker by profileSlug and guards missing identifiers', () => {
  const source = read('app/api/contacts/send/route.ts')
  assert.ok(source.includes('brokerSlug'), 'route must accept brokerSlug')
  assert.ok(source.includes('profileSlug: brokerSlug'), 'route must resolve by unique profileSlug')
  assert.ok(source.includes('!brokerSlug && !brokerId'), 'route must reject requests with no broker identifier')
  assert.ok(source.includes('brokerId: broker.id'), 'lead must be stored against the resolved broker only')
})

test('C2: the contact form sends brokerSlug and the proxy allows anonymous submission', () => {
  const formSource = read('components/forms/BrokerContactForm.tsx')
  assert.ok(formSource.includes('brokerSlug,'), 'form must include brokerSlug in the POST body')
  const proxySource = read('proxy.ts')
  assert.ok(proxySource.includes("'/api/contacts/send'"), 'proxy must allow anonymous /api/contacts/send')
})

// =============================================================
// C3 — OAuth tokens / lead PII serialized into client payloads
// =============================================================

test('C3: getCurrentUser excludes OAuth accounts and contactMessages', () => {
  const source = read('lib/currentUser.ts')
  assert.equal(source.includes('accounts: true'), false, 'accounts (OAuth tokens) must not be loaded')
  assert.equal(/contactMessages:/.test(source), false, 'contactMessages (lead PII) must not be loaded')
  assert.ok(source.includes('Deliberately EXCLUDES'), 'the exclusion must be documented in source')
})

test('C3: broker company page passes an explicit safe DTO to the client', () => {
  const source = read('app/broker/company/page.tsx')
  assert.equal(source.includes('...user,'), false, 'the full user object must not be spread to the client')
  assert.ok(source.includes('contactMessages: _contactMessages'), 'contactMessages must be destructured out before the client payload')
  assert.ok(source.includes('...safeBroker'), 'only the sanitized broker object is passed to the client')
})

test('C3: broker personal profile page passes an explicit safe subset', () => {
  const source = read('app/broker/profile/page.tsx')
  assert.equal(source.includes('<EditPersonalProfile user={user}'), false, 'the full user object must not be passed')
  assert.ok(source.includes('const profileUser ='), 'an explicit safe DTO must be built')
  assert.equal(source.includes('accounts'), false, 'no accounts reference may reach this page')
})

test('C3: EditPersonalProfile renders from the reduced safe DTO', () => {
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'test-cloud'
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'test-preset'
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={mockRouter as never}>
      <EditPersonalProfile
        user={{
          id: 'broker-1',
          name: 'Alex Broker',
          email: 'broker@example.com',
          phone: '+1-555-0000',
          image: null,
          role: 'BROKER',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          emailVerified: true,
          isActive: true,
        }}
      />
    </AppRouterContext.Provider>,
  )
  assert.ok(html.includes('Personal Profile') || html.includes('broker@example.com'), 'profile UI renders from the safe DTO')
})
