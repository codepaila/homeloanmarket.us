import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (relative: string): string => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8')

// ===========================================================================
// Broker-side authorization
// ===========================================================================

test('broker ticket APIs require the BROKER role from the session', () => {
  for (const file of [
    'app/api/support/tickets/route.ts',
    'app/api/support/tickets/[id]/route.ts',
    'app/api/support/tickets/[id]/messages/route.ts',
  ]) {
    const source = read(file)
    assert.match(source, /user\.role !== 'BROKER'/, `${file} must require BROKER`)
  }
})

test('broker ticket ownership is derived from the session and never from the body', () => {
  for (const file of [
    'app/api/support/tickets/route.ts',
    'app/api/support/tickets/[id]/route.ts',
    'app/api/support/tickets/[id]/messages/route.ts',
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /body\.userId/, `${file} must never trust body.userId`)
    assert.doesNotMatch(source, /body\.brokerId/, `${file} must never trust body.brokerId`)
    assert.doesNotMatch(source, /body\.ownerId/, `${file} must never trust body.ownerId`)
  }
  const create = read('app/api/support/tickets/route.ts')
  assert.match(create, /userId: user\.id/, 'create derives the owner from the authenticated user')
  const detail = read('app/api/support/tickets/[id]/route.ts')
  assert.match(detail, /where: \{ id, userId: user\.id \}/, 'detail is filtered by ownership (404 isolation)')
  const reply = read('app/api/support/tickets/[id]/messages/route.ts')
  assert.match(reply, /findFirst\(\{ where: \{ id, userId: user\.id \} \}\)/, 'reply is filtered by ownership')
})

test('broker detail returns 404 for another broker ticket without leaking existence', () => {
  const detail = read('app/api/support/tickets/[id]/route.ts')
  assert.match(detail, /status: 404/, 'broker detail API returns 404 for non-owners')
  assert.match(detail, /where: \{ id, userId: user\.id \}/, 'a non-owner query simply finds nothing')
  const page = read('app/broker/support/tickets/[id]/page.tsx')
  assert.match(page, /notFound\(\)/, 'broker detail page renders a 404 for non-owners')
  assert.match(page, /where: \{ id, userId: user\.id \}/, 'broker detail page filters by ownership')
})

// ===========================================================================
// Admin-side authorization
// ===========================================================================

test('admin ticket APIs require the ADMIN role from the session', () => {
  for (const file of [
    'app/api/admin/support/tickets/route.ts',
    'app/api/admin/support/tickets/[id]/route.ts',
    'app/api/admin/support/tickets/[id]/messages/route.ts',
  ]) {
    const source = read(file)
    assert.match(source, /user\.role !== 'ADMIN'/, `${file} must require ADMIN`)
    assert.doesNotMatch(source, /body\.isAdmin/, `${file} must never trust body.isAdmin`)
    assert.doesNotMatch(source, /body\.role/, `${file} must never trust body.role`)
  }
})

test('admin assignment validates that the assignee is an ADMIN', () => {
  const route = read('app/api/admin/support/tickets/[id]/route.ts')
  assert.match(route, /role: 'ADMIN'/, 'assignee lookup requires ADMIN role')
  assert.match(route, /Assignee must be an admin/, 'non-admin assignee rejected')
})

test('admin ticket pages are gated on the ADMIN role server-side', () => {
  for (const file of ['app/admin/support/tickets/page.tsx', 'app/admin/support/tickets/[id]/page.tsx']) {
    const source = read(file)
    assert.match(source, /user\.role !== 'ADMIN'/, `${file} must gate on ADMIN`)
    assert.match(source, /redirect\('\/auth\/signin'\)/, `${file} redirects non-admins`)
  }
})

test('proxy blocks non-admins from /admin/* and non-brokers from /broker/*', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /path\.startsWith\('\/admin'\)/, 'admin path gate present')
  assert.match(proxy, /userRole !== 'ADMIN'/, 'admin role gate present')
  assert.match(proxy, /path\.startsWith\('\/broker'\)/, 'broker path gate present')
  assert.match(proxy, /userRole !== 'BROKER'/, 'broker role gate present')
})

test('broker pages live under /broker and are proxy-protected', () => {
  for (const file of [
    'app/broker/support/tickets/page.tsx',
    'app/broker/support/tickets/create/page.tsx',
    'app/broker/support/tickets/[id]/page.tsx',
    'app/broker/support/faq/page.tsx',
  ]) {
    assert.ok(fs.existsSync(path.resolve(__dirname, '..', file)), `${file} exists`)
  }
})

test('mutating ticket APIs enforce same-origin (CSRF protection)', () => {
  const create = read('app/api/support/tickets/route.ts')
  assert.match(create, /isSameOriginRequest\(request\)/, 'create enforces origin')
  const reply = read('app/api/support/tickets/[id]/messages/route.ts')
  assert.match(reply, /isSameOriginRequest\(request\)/, 'broker reply enforces origin')
  const adminReply = read('app/api/admin/support/tickets/[id]/messages/route.ts')
  assert.match(adminReply, /isSameOriginRequest\(request\)/, 'admin reply enforces origin')
  const adminPatch = read('app/api/admin/support/tickets/[id]/route.ts')
  assert.match(adminPatch, /isSameOriginRequest\(request\)/, 'admin patch enforces origin')
})

test('notifications are owned by the current user', () => {
  const route = read('app/api/notifications/route.ts')
  assert.match(route, /userId: user\.id/, 'list filters by the authenticated user')
  const detail = read('app/api/notifications/[id]/route.ts')
  assert.match(detail, /where: \{ id, userId: user\.id \}/, 'notification access is owner-scoped')
})