import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'

const read = (relative: string): string => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8')

// ===========================================================================
// Pure workflow rules (no DB / no network)
// ===========================================================================

test('broker reply is allowed only while the ticket is being worked on', async () => {
  const { canBrokerReply, brokerReplyNextStatus, adminReplyNextStatus } =
    await import('../lib/support-ticket')
  assert.equal(canBrokerReply('open'), true)
  assert.equal(canBrokerReply('in_progress'), true)
  assert.equal(canBrokerReply('waiting_for_broker'), true)
  assert.equal(canBrokerReply('resolved'), false)
  assert.equal(canBrokerReply('closed'), false)
  // Broker reply moves a waiting ticket back to in_progress.
  assert.equal(brokerReplyNextStatus('waiting_for_broker'), 'in_progress')
  assert.equal(brokerReplyNextStatus('open'), 'open')
  // Admin reply moves an active ticket to waiting_for_broker.
  assert.equal(adminReplyNextStatus('open'), 'waiting_for_broker')
  assert.equal(adminReplyNextStatus('in_progress'), 'waiting_for_broker')
  assert.equal(adminReplyNextStatus('closed'), 'closed')
})

test('admin status transitions follow the defined workflow', async () => {
  const { isAdminStatusTransitionAllowed } = await import('../lib/support-ticket')
  assert.equal(isAdminStatusTransitionAllowed('open', 'in_progress'), true)
  assert.equal(isAdminStatusTransitionAllowed('open', 'resolved'), true)
  assert.equal(isAdminStatusTransitionAllowed('open', 'closed'), true)
  assert.equal(isAdminStatusTransitionAllowed('in_progress', 'waiting_for_broker'), true)
  assert.equal(isAdminStatusTransitionAllowed('in_progress', 'resolved'), true)
  assert.equal(isAdminStatusTransitionAllowed('waiting_for_broker', 'in_progress'), true)
  assert.equal(isAdminStatusTransitionAllowed('resolved', 'closed'), true)
  assert.equal(isAdminStatusTransitionAllowed('closed', 'open'), true, 'reopen allowed')
  // Brokers cannot perform these transitions; invalid pairs are rejected.
  assert.equal(isAdminStatusTransitionAllowed('open', 'waiting_for_broker'), false)
  assert.equal(isAdminStatusTransitionAllowed('closed', 'in_progress'), false)
  assert.equal(isAdminStatusTransitionAllowed('open', 'open'), false, 'same-status change rejected')
})

test('ticket create input validates subject/category/priority/description', async () => {
  const { validateTicketCreateInput } = await import('../lib/support-ticket')
  assert.equal(validateTicketCreateInput({ subject: 's', category: 'account', priority: 'medium', description: 'd' }), null)
  assert.ok(validateTicketCreateInput({ subject: '', category: 'account', priority: 'medium', description: 'd' }))
  assert.ok(validateTicketCreateInput({ subject: 's', category: 'bogus', priority: 'medium', description: 'd' }))
  assert.ok(validateTicketCreateInput({ subject: 's', category: 'account', priority: 'urgent', description: 'd' }), 'arbitrary priority rejected')
  assert.ok(validateTicketCreateInput({ subject: 's', category: 'account', priority: 'medium', description: '' }))
})

test('ticket number is generated in TKT- format', async () => {
  const { generateTicketNumber } = await import('../lib/support-ticket')
  assert.match(generateTicketNumber(), /^TKT-[A-Z0-9]+$/)
})

// ===========================================================================
// Runtime broker create + ownership (session-derived, never client-supplied)
// ===========================================================================

type CurrentUser = { id: string; role: string; name?: string | null; email?: string | null } | null
type TicketRecord = {
  id: string
  userId: string
  ticketNumber: string
  subject: string
  category: string
  priority: string
  status: string
  description: string
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date | null
  closedAt?: Date | null
  assignedTo?: string | null
  messages?: Array<{ senderId: string; createdAt: Date }>
}

const state: {
  currentUser: CurrentUser
  foundTicket: TicketRecord | null
  createdTicket: TicketRecord | null
  createdMessage: { id: string; senderId: string; senderType: string; message: string; createdAt: Date } | null
  updatedTicket: TicketRecord | null
} = {
  currentUser: null,
  foundTicket: null,
  createdTicket: null,
  createdMessage: null,
  updatedTicket: null,
}

const getCreatedTicket = (): TicketRecord | null => state.createdTicket
const getCreatedMessage = (): typeof state.createdMessage => state.createdMessage
const getUpdatedTicket = (): TicketRecord | null => state.updatedTicket

const ticketRow = (overrides: Partial<TicketRecord> = {}): TicketRecord => ({
  id: 'ticket-1',
  userId: 'broker-1',
  ticketNumber: 'TKT-TEST123',
  subject: 'Test subject',
  category: 'account',
  priority: 'medium',
  status: 'open',
  description: 'Test description',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
  ...overrides,
})

mock.module('@/lib/prisma', {
  defaultExport: {
    supportTicket: {
      create: async (args: { data: Partial<TicketRecord> }) => {
        const record = ticketRow({ ...args.data })
        state.createdTicket = record
        return record
      },
      findFirst: async () => state.foundTicket,
      findUnique: async () => state.foundTicket,
      findMany: async () => [state.foundTicket].filter(Boolean),
      count: async () => 1,
      update: async (args: { data: Partial<TicketRecord> }) => {
        state.updatedTicket = { ...state.foundTicket!, ...args.data } as TicketRecord
        return state.updatedTicket
      },
    },
    supportMessage: {
      create: async (args: { data: { ticketId: string; senderId: string; senderType: string; message: string; attachments: string[] } }) => {
        state.createdMessage = {
          id: 'msg-1',
          senderId: args.data.senderId,
          senderType: args.data.senderType,
          message: args.data.message,
          createdAt: new Date(),
        }
        return state.createdMessage
      },
    },
    user: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    notification: {
      create: async () => ({}),
      createMany: async () => ({ count: 0 }),
      findMany: async () => [],
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
    },
  },
})

mock.module('@/lib/currentUser', {
  namedExports: { getCurrentUser: async () => state.currentUser },
})

mock.module('@/lib/origin', {
  namedExports: { isSameOriginRequest: () => true },
})

mock.module('@/actions/email.action', {
  namedExports: {
    sendSupportTicketNotification: async () => ({ success: true }),
  },
})

const getCreateRoute = () => import('../app/api/support/tickets/route')
const getDetailRoute = () => import('../app/api/support/tickets/[id]/route')
const getReplyRoute = () => import('../app/api/support/tickets/[id]/messages/route')

const request = (body: unknown) =>
  new NextRequest('https://homeloanmarket.com/api/support/tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test('broker creates a ticket with ownership derived from the session, never the body', async () => {
  state.currentUser = { id: 'broker-1', role: 'BROKER', name: 'Broker One' }
  state.createdTicket = null
  const { POST } = await getCreateRoute()
  const res = await POST(
    request({ subject: 'Need help', category: 'technical_issue', priority: 'high', description: 'Details', userId: 'attacker-id' }),
  )
  assert.equal(res.status, 201)
  const created = getCreatedTicket()
  assert.ok(created, 'ticket was created')
  assert.equal(created!.userId, 'broker-1', 'owner is the authenticated user, not the body userId')
  assert.equal(created!.status, 'open')
  assert.match(created!.ticketNumber, /^TKT-/)
})

test('non-broker role cannot create a ticket', async () => {
  state.currentUser = { id: 'user-1', role: 'USER' }
  const { POST } = await getCreateRoute()
  const res = await POST(request({ subject: 's', category: 'account', priority: 'medium', description: 'd' }))
  assert.equal(res.status, 401)
})

test('ticket create rejects arbitrary priority and missing fields', async () => {
  state.currentUser = { id: 'broker-1', role: 'BROKER' }
  const { POST } = await getCreateRoute()
  const badPriority = await POST(request({ subject: 's', category: 'account', priority: 'urgent', description: 'd' }))
  assert.equal(badPriority.status, 400)
  const missingSubject = await POST(request({ subject: '', category: 'account', priority: 'medium', description: 'd' }))
  assert.equal(missingSubject.status, 400)
})

test('broker detail enforces ownership (other brokers get 404)', async () => {
  state.currentUser = { id: 'broker-1', role: 'BROKER' }
  state.foundTicket = ticketRow({ userId: 'broker-1' })
  const { GET } = await getDetailRoute()
  const own = await GET(new NextRequest('https://x/api/support/tickets/ticket-1'), { params: Promise.resolve({ id: 'ticket-1' }) })
  assert.equal(own.status, 200)

  // Another broker's ticket: the ownership filter yields no row -> 404.
  state.foundTicket = null
  const other = await GET(new NextRequest('https://x/api/support/tickets/ticket-2'), { params: Promise.resolve({ id: 'ticket-2' }) })
  assert.equal(other.status, 404)
})

test('broker reply is stored with senderType user and nudges the workflow', async () => {
  state.currentUser = { id: 'broker-1', role: 'BROKER', name: 'Broker One' }
  state.foundTicket = ticketRow({ userId: 'broker-1', status: 'waiting_for_broker' })
  state.createdMessage = null
  const { POST } = await getReplyRoute()
  const res = await POST(
    new NextRequest('https://x/api/support/tickets/ticket-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'I fixed the issue' }),
    }),
    { params: Promise.resolve({ id: 'ticket-1' }) },
  )
  assert.equal(res.status, 201)
  const msg = getCreatedMessage()
  const updated = getUpdatedTicket()
  assert.ok(msg, 'message stored')
  assert.equal(msg!.senderId, 'broker-1')
  assert.equal(msg!.senderType, 'user')
  assert.equal(updated!.status, 'in_progress', 'waiting_for_broker -> in_progress on broker reply')
})

test('broker cannot reply to a closed ticket', async () => {
  state.currentUser = { id: 'broker-1', role: 'BROKER' }
  state.foundTicket = ticketRow({ userId: 'broker-1', status: 'closed' })
  const { POST } = await getReplyRoute()
  const res = await POST(
    new NextRequest('https://x/api/support/tickets/ticket-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'too late' }),
    }),
    { params: Promise.resolve({ id: 'ticket-1' }) },
  )
  assert.equal(res.status, 409)
})

// ===========================================================================
// Admin routes (static: ADMIN gate + broker isolation in broker APIs)
// ===========================================================================

test('admin ticket APIs are gated on role ADMIN', () => {
  for (const file of [
    'app/api/admin/support/tickets/route.ts',
    'app/api/admin/support/tickets/[id]/route.ts',
    'app/api/admin/support/tickets/[id]/messages/route.ts',
  ]) {
    const source = read(file)
    assert.match(source, /user\.role !== 'ADMIN'/, `${file} must require ADMIN`)
    assert.match(source, /Unauthorized/, `${file} returns unauthorized`)
  }
})

test('broker ticket APIs never trust a browser-supplied owner id', () => {
  for (const file of [
    'app/api/support/tickets/route.ts',
    'app/api/support/tickets/[id]/route.ts',
    'app/api/support/tickets/[id]/messages/route.ts',
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /body\.userId/, `${file} must not read userId from body`)
    assert.doesNotMatch(source, /body\.brokerId/, `${file} must not read brokerId from body`)
  }
  const detail = read('app/api/support/tickets/[id]/route.ts')
  assert.match(detail, /userId: user\.id/, 'broker detail filters by the authenticated user')
  const reply = read('app/api/support/tickets/[id]/messages/route.ts')
  assert.match(reply, /userId: user\.id/, 'broker reply filters by the authenticated user')
})

test('broker cannot reach admin ticket pages (proxy + server gate)', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /path\.startsWith\('\/admin'\)/, 'proxy gates /admin/*')
  assert.match(proxy, /userRole !== 'ADMIN'/, 'proxy requires ADMIN for /admin')
  const adminList = read('app/admin/support/tickets/page.tsx')
  assert.match(adminList, /user\.role !== 'ADMIN'/, 'admin list page gates on ADMIN')
  const adminDetail = read('app/admin/support/tickets/[id]/page.tsx')
  assert.match(adminDetail, /user\.role !== 'ADMIN'/, 'admin detail page gates on ADMIN')
})

test('sidebars expose the support ticket routes', () => {
  const sidebar = read('components/layout/admin/sideBarData.ts')
  assert.match(sidebar, /\/broker\/support\/tickets/, 'broker My Tickets link')
  assert.match(sidebar, /\/broker\/support\/create/, 'broker Create Ticket link')
  assert.match(sidebar, /\/broker\/support\/faq/, 'broker FAQ link')
  assert.match(sidebar, /\/admin\/support\/tickets/, 'admin support tickets link')
})

// ===========================================================================
// Admin runtime flow (mocks configured above)
// ===========================================================================

const getAdminListRoute = () => import('../app/api/admin/support/tickets/route')
const getAdminDetailRoute = () => import('../app/api/admin/support/tickets/[id]/route')
const getAdminReplyRoute = () => import('../app/api/admin/support/tickets/[id]/messages/route')

test('admin list requires ADMIN (broker is rejected)', async () => {
  state.currentUser = { id: 'broker-1', role: 'BROKER' }
  const { GET } = await getAdminListRoute()
  const res = await GET(new NextRequest('https://x/api/admin/support/tickets'))
  assert.equal(res.status, 401)
  state.currentUser = { id: 'admin-1', role: 'ADMIN', name: 'Admin One' }
  const adminRes = await GET(new NextRequest('https://x/api/admin/support/tickets'))
  assert.equal(adminRes.status, 200)
})

test('admin reply is stored with senderType support_agent and moves to waiting_for_broker', async () => {
  state.currentUser = { id: 'admin-1', role: 'ADMIN', name: 'Admin One' }
  state.foundTicket = ticketRow({ userId: 'broker-1', status: 'open', assignedTo: null })
  state.createdMessage = null
  const { POST } = await getAdminReplyRoute()
  const res = await POST(
    new NextRequest('https://x/api/admin/support/tickets/ticket-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Thanks, investigating' }),
    }),
    { params: Promise.resolve({ id: 'ticket-1' }) },
  )
  assert.equal(res.status, 201)
  const msg = getCreatedMessage()
  const updated = getUpdatedTicket()
  assert.ok(msg, 'message stored')
  assert.equal(msg!.senderType, 'support_agent')
  assert.equal(updated!.status, 'waiting_for_broker', 'admin reply -> waiting_for_broker')
  assert.equal(updated!.assignedTo, 'admin-1', 'replying admin is assigned when unassigned')
})

test('admin can change status along allowed transitions and is blocked on invalid ones', async () => {
  state.currentUser = { id: 'admin-1', role: 'ADMIN' }
  const { PATCH } = await getAdminDetailRoute()

  state.foundTicket = ticketRow({ userId: 'broker-1', status: 'open' })
  const allowed = await PATCH(
    new NextRequest('https://x/api/admin/support/tickets/ticket-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    }),
    { params: Promise.resolve({ id: 'ticket-1' }) },
  )
  assert.equal(allowed.status, 200)

  state.foundTicket = ticketRow({ userId: 'broker-1', status: 'open' })
  const blocked = await PATCH(
    new NextRequest('https://x/api/admin/support/tickets/ticket-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'waiting_for_broker' }),
    }),
    { params: Promise.resolve({ id: 'ticket-1' }) },
  )
  assert.equal(blocked.status, 409)
})

test('broker cannot use admin APIs even with a crafted role claim', async () => {
  state.currentUser = { id: 'broker-1', role: 'BROKER' }
  const { PATCH } = await getAdminDetailRoute()
  const res = await PATCH(
    new NextRequest('https://x/api/admin/support/tickets/ticket-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    }),
    { params: Promise.resolve({ id: 'ticket-1' }) },
  )
  assert.equal(res.status, 401)
})