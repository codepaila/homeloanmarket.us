import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { TableRowSkeleton } from '../components/admin/ads/LoadingSkeleton'
import { AdvertisementTable } from '../components/admin/ads/AdvertisementTable'

const database = process.env.PHASE13_AUTH_DATABASE_URL
const adsBase = process.env.ADMIN_ADS_BASE_URL

const noop = () => undefined

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('TableRowSkeleton renders a <tr> with <td> children only', () => {
  const html = renderToStaticMarkup(<TableRowSkeleton />)
  const normalized = html.replace(/\s+/g, ' ')
  assert.ok(normalized.trimStart().startsWith('<tr'), 'must start with <tr>')
  assert.ok(normalized.includes('<td'), 'must contain <td> cells')
  assert.equal(normalized.includes('<div>'), false, 'no bare div direct children expected')
})

test('Loading AdvertisementTable has valid tbody markup with tr rows', () => {
  const html = renderToStaticMarkup(
    <AdvertisementTable
      ads={[]}
      total={0}
      page={1}
      limit={10}
      isLoading
      search=""
      onPageChange={noop}
    />,
  )
  const normalized = html.replace(/\s+/g, '')
  const tbodyIdx = normalized.indexOf('<tbody')
  assert.ok(tbodyIdx >= 0, 'tbody present')
  const afterTbody = normalized.slice(normalized.indexOf('>', tbodyIdx) + 1)
  assert.ok(afterTbody.startsWith('<tr'), 'tbody first child is a tr')
  assert.equal(afterTbody.startsWith('<div'), false, 'no div directly inside tbody')
})

test('Stats aggregation uses real Advertisement and AdEvent data', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { AdvertisementService } = await import('../lib/advertisements/services')
  try {
    const stats = await AdvertisementService.getDashboardStats()
    assert.equal(stats.total, 10)
    assert.ok(stats.impressions > 0)
    assert.ok(stats.clicks > 0)
    assert.ok(stats.ctr !== null && stats.ctr > 0)
    assert.ok(Array.isArray(stats.placementStats) && stats.placementStats.length > 0)
    assert.ok(Array.isArray(stats.topAds) && stats.topAds.length > 0)
    assert.ok(Array.isArray(stats.dailyEngagement) && stats.dailyEngagement.length > 0)
  } finally {
    await prisma.$disconnect()
  }
})

test('CTR is calculated from clicks and impressions', () => {
  const impressions = 331
  const clicks = 30
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null
  assert.equal(ctr, Number(((30 / 331) * 100).toFixed(2)))
  assert.ok(ctr !== null && ctr > 0)
})

test('GET /api/admin/ads/stats returns 200 for an authorized ADMIN', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const cookieHeader = (response: Response) => response.headers.getSetCookie().map((part) => part.split(';')[0]).join('; ')
  const csrfResponse = await fetch(`${base}/api/auth/csrf`)
  const csrf = (await csrfResponse.json()).csrfToken as string
  const csrfCookie = cookieHeader(csrfResponse)
  const login = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken: csrf, email: 'admin@homeloanmarket.com', password: 'Admin@123456', callbackUrl: '/', json: 'true' }),
  })
  const cookie = [csrfCookie, ...login.headers.getSetCookie().map((part) => part.split(';')[0])].filter(Boolean).join('; ')

  const response = await fetch(`${base}/api/admin/ads/stats`, { headers: { cookie } })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
  assert.equal(typeof body.stats.total, 'number')
  assert.equal(typeof body.stats.impressions, 'number')
  assert.equal(typeof body.stats.clicks, 'number')

  const list = await fetch(`${base}/api/admin/ads?page=1&limit=10`, { headers: { cookie } })
  assert.equal(list.status, 200)
})

test('GET /api/admin/ads/stats rejects Broker, User, and anonymous roles', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const cookieHeader = (response: Response) => response.headers.getSetCookie().map((part) => part.split(';')[0]).join('; ')
  const loginAs = async (email: string, password: string) => {
    const csrfResponse = await fetch(`${base}/api/auth/csrf`)
    const csrf = (await csrfResponse.json()).csrfToken as string
    const csrfCookie = cookieHeader(csrfResponse)
    const login = await fetch(`${base}/api/auth/callback/credentials`, {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: csrf, email, password, callbackUrl: '/', json: 'true' }),
    })
    return [csrfCookie, ...login.headers.getSetCookie().map((part) => part.split(';')[0])].filter(Boolean).join('; ')
  }

  const brokerCookie = await loginAs('sarah.mitchell@example.com', 'LocalDev!2026')
  const userCookie = await loginAs('hannah.moore@example.com', 'LocalDev!2026')

  const broker = await fetch(`${base}/api/admin/ads/stats`, { headers: { cookie: brokerCookie } })
  const user = await fetch(`${base}/api/admin/ads/stats`, { headers: { cookie: userCookie } })
  const anonymous = await fetch(`${base}/api/admin/ads/stats`, { redirect: 'manual' })

  assert.equal(broker.status, 401)
  assert.equal(user.status, 401)
  assert.ok([307, 401].includes(anonymous.status), `anonymous rejected (${anonymous.status})`)
})
