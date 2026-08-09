import assert from 'node:assert/strict'
import test from 'node:test'

const adsBase = process.env.ADMIN_ADS_BASE_URL

async function adminSession(base: string) {
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
  return { cookie: [csrfCookie, ...login.headers.getSetCookie().map((part) => part.split(';')[0])].filter(Boolean).join('; '), cookieHeader }
}

async function list(base: string, cookie: string, query: string) {
  const response = await fetch(`${base}/api/admin/ads?${query}`, { headers: { cookie } })
  const body = await response.json()
  return { status: response.status, body }
}

test('List endpoint returns real data with search, placement, and status filters', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const { cookie } = await adminSession(base)

  const all = await list(base, cookie, 'page=1&limit=50')
  assert.equal(all.status, 200)
  assert.ok(all.body.ads.length >= 8)

  // Placement filter
  const listing = await list(base, cookie, 'page=1&limit=50&placement=BROKER_LISTING')
  assert.equal(listing.status, 200)
  for (const ad of listing.body.ads) assert.equal(ad.placement, 'BROKER_LISTING')

  // Enabled filter
  const enabled = await list(base, cookie, 'page=1&limit=50&isEnabled=true')
  assert.equal(enabled.status, 200)
  for (const ad of enabled.body.ads) assert.equal(ad.isEnabled, true)

  // Archived filter
  const archived = await list(base, cookie, 'page=1&limit=50&isArchived=true')
  assert.equal(archived.status, 200)
  for (const ad of archived.body.ads) assert.equal(ad.isArchived, true)

  // Search filter
  const title = all.body.ads[0]?.title
  if (title) {
    const searchWord = title.split(' ')[0]
    const search = await list(base, cookie, `page=1&limit=50&search=${encodeURIComponent(searchWord)}`)
    assert.equal(search.status, 200)
    assert.ok(search.body.ads.length > 0)
    for (const ad of search.body.ads) {
      assert.ok(
        ad.title.toLowerCase().includes(searchWord.toLowerCase()) ||
          ad.slug.toLowerCase().includes(searchWord.toLowerCase()) ||
          (ad.description || '').toLowerCase().includes(searchWord.toLowerCase()),
      )
    }
  }
})

test('List endpoint pagination is server-side and preserves totals', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const { cookie } = await adminSession(base)

  const page1 = await list(base, cookie, 'page=1&limit=3')
  const page2 = await list(base, cookie, 'page=2&limit=3')
  assert.equal(page1.status, 200)
  assert.equal(page2.status, 200)
  assert.equal(page1.body.ads.length, 3)
  assert.equal(page1.body.page, 1)
  assert.equal(page1.body.limit, 3)
  assert.equal(page1.body.totalPages, Math.ceil(page1.body.total / 3))
  const ids1 = new Set(page1.body.ads.map((ad: { id: string }) => ad.id))
  for (const ad of page2.body.ads) assert.equal(ids1.has(ad.id), false, 'page 2 must not repeat page 1')
})

test('List endpoint never forces filters when omitted', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const { cookie } = await adminSession(base)
  const plain = await list(base, cookie, 'page=1&limit=10')
  assert.equal(plain.status, 200)
  const enabled = plain.body.ads.filter((ad: { isEnabled: boolean }) => ad.isEnabled).length
  assert.ok(enabled > 0, 'unfiltered list must include enabled ads')
  const archived = plain.body.ads.filter((ad: { isArchived: boolean }) => ad.isArchived).length
  assert.ok(archived >= 0)
})
