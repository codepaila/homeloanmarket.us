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

async function cleanupAd(base: string, cookie: string, id: string) {
  await fetch(`${base}/api/admin/ads/${id}`, { method: 'DELETE', headers: { cookie } })
  await fetch(`${base}/api/admin/ads/${id}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'hard_delete' }),
  })
}

test('Complete Admin advertisement lifecycle works end-to-end', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const { cookie } = await adminSession(base)
  const headers = { cookie, 'content-type': 'application/json' }
  const createdIds: string[] = []
  const title = `E2E Lifecycle ${Date.now()}`

  try {
    // Create
    const create = await fetch(`${base}/api/admin/ads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        description: 'Lifecycle verification advertisement',
        placement: 'BROKER_LISTING',
        type: 'SECTION_BANNER',
        action: 'BANNER_CLICK',
        buttonUrl: '/brokers',
        bannerUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=1200&h=800',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        isEnabled: true,
        priority: 25,
      }),
    })
    assert.equal(create.status, 201)
    const created = await create.json()
    assert.ok(created.ad?.id)
    createdIds.push(created.ad.id)

    // Appears in list
    const list = await (await fetch(`${base}/api/admin/ads?page=1&limit=10`, { headers: { cookie } })).json()
    assert.equal(list.ads.some((ad: { id: string }) => ad.id === created.ad.id), true)

    // Edit
    const update = await fetch(`${base}/api/admin/ads/${created.ad.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title: `${title} (updated)` }),
    })
    assert.equal(update.status, 200)
    const updated = await update.json()
    assert.equal(updated.ad.title, `${title} (updated)`)

    // Disable (unpublish) then enable (publish)
    const disable = await (await fetch(`${base}/api/admin/ads/${created.ad.id}`, { method: 'POST', headers, body: JSON.stringify({ action: 'unpublish' }) })).json()
    assert.equal(disable.ad.isEnabled, false)
    const enable = await (await fetch(`${base}/api/admin/ads/${created.ad.id}`, { method: 'POST', headers, body: JSON.stringify({ action: 'publish' }) })).json()
    assert.equal(enable.ad.isEnabled, true)

    // Archive then restore
    const archive = await (await fetch(`${base}/api/admin/ads/${created.ad.id}`, { method: 'POST', headers, body: JSON.stringify({ action: 'archive' }) })).json()
    assert.equal(archive.ad.isArchived, true)
    const restore = await (await fetch(`${base}/api/admin/ads/${created.ad.id}`, { method: 'POST', headers, body: JSON.stringify({ action: 'restore' }) })).json()
    assert.equal(restore.ad.isArchived, false)

    // Detail metrics shape
    const detail = await (await fetch(`${base}/api/admin/ads/${created.ad.id}`, { headers: { cookie } })).json()
    assert.equal(typeof detail.metrics.impressions, 'number')
    assert.equal(typeof detail.metrics.clicks, 'number')

    // Stats use real AdEvent data
    const stats = await (await fetch(`${base}/api/admin/ads/stats`, { headers: { cookie } })).json()
    assert.ok(stats.stats.impressions > 0)
    assert.ok(stats.stats.clicks > 0)
    assert.ok(stats.stats.ctr !== null && stats.stats.ctr > 0)
  } finally {
    for (const id of createdIds) await cleanupAd(base, cookie, id)
  }
})

test('No duplicate advertisement slugs are created on repeated submit', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const { cookie } = await adminSession(base)
  const headers = { cookie, 'content-type': 'application/json' }
  const title = `E2E Duplicate Guard ${Date.now()}`
  const createdIds: string[] = []
  try {
    const payload = {
      title,
      placement: 'FOOTER',
      type: 'FOOTER_BANNER',
      action: 'BANNER_CLICK',
      buttonUrl: '/about',
      bannerUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200&h=800',
    }
    const first = await fetch(`${base}/api/admin/ads`, { method: 'POST', headers, body: JSON.stringify(payload) })
    const firstBody = await first.json()
    const second = await fetch(`${base}/api/admin/ads`, { method: 'POST', headers, body: JSON.stringify(payload) })
    const secondBody = await second.json()
    assert.equal(first.status, 201)
    assert.equal(second.status, 201)
    assert.ok(firstBody.ad?.slug && secondBody.ad?.slug)
    assert.notEqual(firstBody.ad.slug, secondBody.ad.slug, 'server must keep slugs unique')
    if (firstBody.ad) createdIds.push(firstBody.ad.id)
    if (secondBody.ad) createdIds.push(secondBody.ad.id)
  } finally {
    for (const id of createdIds) await cleanupAd(base, cookie, id)
  }
})

test('GET /admin/ads, /admin/ads/list, /admin/ads/new return 200 for ADMIN', { skip: !adsBase }, async () => {
  const base = adsBase as string
  const { cookie } = await adminSession(base)
  for (const path of ['/admin/ads', '/admin/ads/list', '/admin/ads/new']) {
    const response = await fetch(`${base}${path}`, { headers: { cookie } })
    assert.equal(response.status, 200, path)
  }
})
