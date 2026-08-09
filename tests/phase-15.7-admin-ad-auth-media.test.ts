import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { validateUpload } from '../lib/advertisements/imageProcessor'

const base = process.env.ADMIN_ADS_BASE_URL
const database = process.env.PHASE13_AUTH_DATABASE_URL

function fileFromBuffer(buffer: Buffer, name: string, type: string): File {
  return new File([buffer as unknown as BlobPart], name, { type })
}

function makeImage(type: 'png' | 'jpeg' | 'webp' | 'gif'): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 50, channels: 3, background: { r: 74, g: 162, b: 86 } } })
    .toFormat(type)
    .toBuffer()
}

// ---------------- Unit: server-side upload validation ----------------

test('validateUpload accepts JPEG, PNG, WebP, and GIF', async () => {
  for (const type of ['jpeg', 'png', 'webp', 'gif'] as const) {
    const buffer = await makeImage(type)
    const mime = type === 'jpeg' ? 'image/jpeg' : `image/${type}`
    const result = await validateUpload(fileFromBuffer(buffer, `test.${type === 'jpeg' ? 'jpg' : type}`, mime))
    assert.equal(result.isValid, true, type)
  }
})

test('validateUpload rejects SVG with a clear security-driven message', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><rect width="200" height="50" fill="green"/></svg>')
  const result = await validateUpload(fileFromBuffer(svg, 'test.svg', 'image/svg+xml'))
  assert.equal(result.isValid, false)
  assert.match(result.error || '', /SVG/i)
})

test('validateUpload rejects AVIF (not supported by the storage pipeline)', async () => {
  const buffer = Buffer.from('not an avif')
  const result = await validateUpload(fileFromBuffer(buffer, 'test.avif', 'image/avif'))
  assert.equal(result.isValid, false)
})

test('validateUpload rejects oversized files (over 10 MB)', async () => {
  const buffer = Buffer.alloc(11 * 1024 * 1024)
  const result = await validateUpload(fileFromBuffer(buffer, 'huge.png', 'image/png'))
  assert.equal(result.isValid, false)
  assert.match(result.error || '', /10 MB/i)
})

test('validateUpload rejects non-image MIME types', async () => {
  const buffer = Buffer.from('hello world')
  const result = await validateUpload(fileFromBuffer(buffer, 'notes.txt', 'text/plain'))
  assert.equal(result.isValid, false)
})

test('validateUpload rejects missing files', async () => {
  const result = await validateUpload(fileFromBuffer(Buffer.alloc(0), '', ''))
  assert.equal(result.isValid, false)
})

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

// ---------------- HTTP: admin advertisement authentication ----------------

async function loginSession(target: string, email: string, password: string) {
  const cookieHeader = (response: Response) => response.headers.getSetCookie().map((part) => part.split(';')[0]).join('; ')
  const csrfResponse = await fetch(`${target}/api/auth/csrf`)
  const csrf = (await csrfResponse.json()).csrfToken as string
  const csrfCookie = cookieHeader(csrfResponse)
  const login = await fetch(`${target}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken: csrf, email, password, callbackUrl: '/', json: 'true' }),
  })
  return [csrfCookie, ...login.headers.getSetCookie().map((part) => part.split(';')[0])].filter(Boolean).join('; ')
}

async function firstAdId(target: string, cookie: string) {
  const res = await fetch(`${target}/api/admin/ads?page=1&limit=1`, { headers: { cookie } })
  const body = await res.json()
  return (body.ads || [])[0]?.id as string | undefined
}

test('anonymous cannot update an advertisement (401, no login redirect)', { skip: !base }, async () => {
  const res = await fetch(`${base as string}/api/admin/ads/some-id`, {
    method: 'PUT',
    redirect: 'manual',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'hacked' }),
  })
  assert.equal(res.status, 401)
  assert.equal(res.headers.get('location'), null, 'API auth failures must not redirect')
})

test('USER cannot update an advertisement (403)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'hannah.moore@example.com', 'LocalDev!2026')
  const res = await fetch(`${base as string}/api/admin/ads/some-id`, {
    method: 'PUT',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'x' }),
  })
  assert.ok(res.status === 401 || res.status === 403)
})

test('BROKER cannot update an advertisement (403)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'sarah.mitchell@example.com', 'LocalDev!2026')
  const res = await fetch(`${base as string}/api/admin/ads/some-id`, {
    method: 'PUT',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'x' }),
  })
  assert.ok(res.status === 401 || res.status === 403)
})

test('ADMIN can update an advertisement (200)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const id = await firstAdId(base as string, cookie)
  assert.ok(id, 'expected a seeded advertisement')
  const res = await fetch(`${base as string}/api/admin/ads/${id}`, {
    method: 'PUT',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Auth Trace Update' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
})

test('anonymous cannot upload media (401, no login redirect)', { skip: !base }, async () => {
  const form = new FormData()
  form.append('file', fileFromBuffer(Buffer.from('x'), 'x.png', 'image/png'))
  form.append('altText', 'x')
  const res = await fetch(`${base as string}/api/admin/media`, { method: 'POST', redirect: 'manual', body: form })
  assert.equal(res.status, 401)
  assert.equal(res.headers.get('location'), null)
})

test('ADMIN media upload accepts JPG, PNG, WebP, and GIF (201)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  for (const type of ['jpeg', 'png', 'webp', 'gif'] as const) {
    const buffer = await makeImage(type)
    const mime = type === 'jpeg' ? 'image/jpeg' : `image/${type}`
    const form = new FormData()
    form.append('file', fileFromBuffer(buffer, `ok.${type === 'jpeg' ? 'jpg' : type}`, mime))
    form.append('altText', `test ${type}`)
    const res = await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })
    assert.equal(res.status, 201, type)
    const body = await res.json()
    assert.equal(body.success, true)
    assert.ok(body.asset?.fileUrl, type)
  }
})

test('ADMIN media upload rejects SVG (400)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><rect width="200" height="50" fill="green"/></svg>')
  const form = new FormData()
  form.append('file', fileFromBuffer(svg, 'bad.svg', 'image/svg+xml'))
  form.append('altText', 'svg')
  const res = await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })
  assert.equal(res.status, 400)
})

test('ADMIN media upload rejects AVIF (400)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const form = new FormData()
  form.append('file', fileFromBuffer(Buffer.from('x'), 'bad.avif', 'image/avif'))
  form.append('altText', 'avif')
  const res = await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })
  assert.equal(res.status, 400)
})

test('ADMIN media upload rejects oversized files (400)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const form = new FormData()
  form.append('file', fileFromBuffer(Buffer.alloc(11 * 1024 * 1024), 'huge.png', 'image/png'))
  form.append('altText', 'huge')
  const res = await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })
  assert.equal(res.status, 400)
})

test('ADMIN media upload rejects MIME spoofing (invalid image content, 400)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const form = new FormData()
  form.append('file', fileFromBuffer(Buffer.from('this is not an image'), 'fake.png', 'image/png'))
  form.append('altText', 'fake')
  const res = await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })
  assert.ok(res.status === 400, `expected 400, got ${res.status}`)
})

test('ADMIN can attach uploaded media to an advertisement (media replacement, 200)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const buffer = await makeImage('png')
  const form = new FormData()
  form.append('file', fileFromBuffer(buffer, 'replacement.png', 'image/png'))
  form.append('altText', 'replacement creative')
  const upload = await (await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })).json()
  const assetId = upload.asset?.id
  assert.ok(assetId)

  const id = await firstAdId(base as string, cookie)
  const res = await fetch(`${base as string}/api/admin/ads/${id}`, {
    method: 'PUT',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Media Replacement Trace', desktopMediaId: assetId, creativeAssignments: [{ mediaAssetId: assetId, format: 'HORIZONTAL' }] }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
})

// ---------------- HTTP: uploaded media is publicly servable ----------------

test('uploaded media URL returns 200 with the correct content type (anonymous)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const buffer = await makeImage('png')
  const form = new FormData()
  form.append('file', fileFromBuffer(buffer, 'servable.png', 'image/png'))
  form.append('altText', 'servable')
  const upload = await (await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })).json()
  const fileUrl = upload.asset?.fileUrl as string
  const thumbnailUrl = upload.asset?.thumbnailUrl as string
  assert.ok(fileUrl && fileUrl.startsWith('/uploads/'))

  const res = await fetch(`${base as string}${fileUrl}`, { redirect: 'manual' })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') || '', /^image\//)

  const thumb = await fetch(`${base as string}${thumbnailUrl}`, { redirect: 'manual' })
  assert.equal(thumb.status, 200)
  assert.match(thumb.headers.get('content-type') || '', /^image\//)
})

test('uploaded media URLs are not intercepted by the auth middleware (no redirect)', { skip: !base }, async () => {
  const cookie = await loginSession(base as string, 'admin@homeloanmarket.com', 'Admin@123456')
  const buffer = await makeImage('webp')
  const form = new FormData()
  form.append('file', fileFromBuffer(buffer, 'servable2.webp', 'image/webp'))
  form.append('altText', 'servable2')
  const upload = await (await fetch(`${base as string}/api/admin/media`, { method: 'POST', headers: { cookie }, body: form })).json()
  const fileUrl = upload.asset?.fileUrl as string

  const res = await fetch(`${base as string}${fileUrl}`, { redirect: 'manual' })
  assert.equal(res.status, 200, 'uploaded media must not be redirected to login')
  assert.equal(res.headers.get('location'), null)
})

test('uploaded media URL rejects path traversal (404)', { skip: !base }, async () => {
  const res = await fetch(`${base as string}/uploads/media/..%2f..%2fpackage.json`, { redirect: 'manual' })
  assert.equal(res.status, 404)
})
