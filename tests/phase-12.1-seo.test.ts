import assert from 'node:assert/strict'
import test from 'node:test'

const base = process.env.SEO_BASE_URL

test('local HTTP SEO surface has valid crawl boundaries', { skip: !base }, async () => {
  const origin = base as string
  const robotsResponse = await fetch(`${origin}/robots.txt`)
  const robots = await robotsResponse.text()
  assert.equal(robotsResponse.status, 200)
  assert.match(robots, /Allow: \/\n/)
  assert.match(robots, /Disallow: \/admin\//)
  assert.match(robots, /Disallow: \/api\//)
  assert.match(robots, /Sitemap: https:\/\/homeloanmarket\.com\/sitemap\.xml/)

  const sitemapResponse = await fetch(`${origin}/sitemap.xml`)
  const sitemap = await sitemapResponse.text()
  assert.equal(sitemapResponse.status, 200)
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.ok(urls.length > 0)
  assert.equal(new Set(urls).size, urls.length)
  assert.equal(urls.some((url) => new URL(url).search), false)
  assert.equal(urls.some((url) => /localhost|127\.0\.0\.1/.test(url)), false)
  assert.equal(urls.some((url) => /\/(admin|broker|api|auth|setup|claim-broker)(\/|$)/.test(new URL(url).pathname)), false)

  const profileUrl = urls.find((url) => new URL(url).pathname.startsWith('/brokers/'))
  assert.ok(profileUrl)
  const profileResponse = await fetch(`${origin}${new URL(profileUrl).pathname}`)
  const profile = await profileResponse.text()
  assert.equal(profileResponse.status, 200)
  assert.match(profile, /<title>/)
  assert.match(profile, /property="og:title"/)
  assert.match(profile, /name="twitter:card"/)
  assert.match(profile, /rel="canonical"[^>]+href="https:\/\/homeloanmarket\.com\/brokers\//)
  const jsonLd = profile.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(jsonLd)
  assert.equal(JSON.parse(jsonLd)['@type'], 'LocalBusiness')
  assert.doesNotMatch(profile, /"userId"\s*:|"brokerId"\s*:|"subscription"\s*:/)
})
