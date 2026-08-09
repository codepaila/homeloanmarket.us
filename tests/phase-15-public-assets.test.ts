import assert from 'node:assert/strict'
import test from 'node:test'

const base = process.env.PUBLIC_ASSET_BASE_URL

test('public logo and representative asset are served as non-empty image responses', { skip: !base }, async () => {
  for (const path of ['/assets/logo.png', '/assets/images/cover.jpg']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' })
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get('content-type') || '', /^image\//, path)
    const bytes = new Uint8Array(await response.arrayBuffer())
    assert.ok(bytes.byteLength > 0, path)
  }
})
