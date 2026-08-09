import assert from 'node:assert/strict'
import test from 'node:test'

const base = process.env.REGISTER_BASE_URL

test('registration page is public and authenticated users are redirected by role', { skip: !base }, async () => {
  const anon = await fetch(`${base}/register`, { redirect: 'manual' })
  assert.equal(anon.status, 200)

  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  const csrfToken = (await csrfRes.json()).csrfToken
  const csrfCookie = csrfRes.headers.getSetCookie().map((part) => part.split(';')[0]).join('; ')

  const login = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email: 'admin@homeloanmarket.com', password: 'Admin@123456', callbackUrl: '/', json: 'true' }),
  })
  assert.equal(login.status, 302)
  const cookie = [csrfCookie, ...login.headers.getSetCookie().map((part) => part.split(';')[0])].filter(Boolean).join('; ')

  const authed = await fetch(`${base}/register`, { redirect: 'manual', headers: { cookie } })
  assert.equal(authed.status, 307)
  assert.equal(authed.headers.get('location'), '/admin')
})

test('broker-only routes remain protected for non-brokers', { skip: !base }, async () => {
  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  const csrfToken = (await csrfRes.json()).csrfToken
  const csrfCookie = csrfRes.headers.getSetCookie().map((part) => part.split(';')[0]).join('; ')
  const login = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email: 'hannah.moore@example.com', password: 'LocalDev!2026', callbackUrl: '/', json: 'true' }),
  })
  assert.equal(login.status, 302)
  const cookie = [csrfCookie, ...login.headers.getSetCookie().map((part) => part.split(';')[0])].filter(Boolean).join('; ')
  const dashboard = await fetch(`${base}/broker/dashboard`, { redirect: 'manual', headers: { cookie } })
  assert.equal(dashboard.status, 307)
  assert.equal(dashboard.headers.get('location'), '/')
})
