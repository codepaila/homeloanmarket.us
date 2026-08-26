import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import sitemapFn from '../app/sitemap'
import { canonicalUrl } from '../lib/seo'

const read = (path: string) => fs.readFileSync(path, 'utf8')

test('sitemap references the real legal route paths, not broken placeholders', async () => {
  const entries = await sitemapFn()
  const urls = entries.map((entry) => entry.url)
  assert.ok(urls.includes(canonicalUrl('/privacy-policy')), 'privacy-policy in sitemap')
  assert.ok(urls.includes(canonicalUrl('/terms-of-service')), 'terms-of-service in sitemap')
  assert.equal(urls.includes(canonicalUrl('/privacy')), false, 'no broken /privacy URL')
  assert.equal(urls.includes(canonicalUrl('/terms')), false, 'no broken /terms URL')
  assert.equal(new Set(urls).size, urls.length, 'no duplicate sitemap URLs')
  assert.equal(urls.some((url) => new URL(url).search), false, 'no query-string URLs in sitemap')
})

test('client-only public pages get server-side metadata + canonical via route layouts', () => {
  for (const route of ['calculator', 'contact', 'subscription']) {
    const layout = read(`app/(public)/${route}/layout.tsx`)
    assert.match(layout, /export const metadata/)
    assert.match(layout, new RegExp(`alternates: \\{ canonical: canonicalUrl\\('/${route}'\\)`))
    assert.match(layout, /robots: \{ index: true, follow: true \}/)
  }
})

test('homepage title does not duplicate the brand (template appends it once)', () => {
  const home = read('app/(public)/page.tsx')
  assert.match(home, /title: 'Find a Trusted Mortgage Originator'/)
  assert.doesNotMatch(home, /title: 'Find a Trusted Mortgage Originator \| HomeLoanMarket'/)
})

test('legal/about page titles omit the brand so the root template appends it once', () => {
  for (const path of [
    'app/(public)/about/page.tsx',
    'app/(public)/privacy-policy/page.tsx',
    'app/(public)/terms-of-service/page.tsx',
  ]) {
    const page = read(path)
    assert.doesNotMatch(page, /title: '[^']*- HomeLoanMarket'/, `${path} must not duplicate brand`)
    assert.doesNotMatch(page, /title: '[^']*\| HomeLoanMarket'/, `${path} must not duplicate brand`)
  }
})

test('blog index has a canonical and descriptive metadata', () => {
  const blog = read('app/(public)/blog/page.tsx')
  assert.match(blog, /alternates: \{ canonical: canonicalUrl\('\/blog'\)/)
  assert.match(blog, /Mortgage Articles & Guides/)
})

test('footer Resources column restores crawlable internal links', () => {
  const footer = read('components/layout/Footer.tsx')
  assert.match(footer, /Mortgage Originator Directory/)
  assert.match(footer, /href: '\/brokers'/)
  assert.match(footer, /href: '\/guides'/)
  assert.match(footer, /href: '\/calculator'/)
})

test('broker structured data gates ratings on real APPROVED reviews, not Mortgage Expert', () => {
  const reviews = read('lib/reviews.ts')
  const detailPage = read('app/(public)/brokers/[slug]/page.tsx')
  const builder = read('lib/seo.ts')
  // Ratings are recomputed from APPROVED reviews only.
  assert.match(reviews, /status: REVIEW_PUBLIC_STATUS/)
  // The rating gating lives in the shared broker builder (single source of
  // truth), fed by the broker's real aggregate — never a hardcoded 5 or badge.
  assert.match(detailPage, /totalReviews: broker\.totalReviews/)
  assert.match(detailPage, /avgRating: broker\.avgRating/)
  assert.match(builder, /totalReviews > 0 && input\.avgRating > 0/)
  assert.match(builder, /ratingValue: input\.avgRating/)
  assert.doesNotMatch(builder, /ratingValue: 5/)
  assert.doesNotMatch(builder, /ratingValue: isMortgageExpert/)
})

test('directory search/filter query URLs canonicalize to /brokers (no duplicate indexable pages)', () => {
  // The broker layout declares the canonical for the whole /brokers segment.
  const layout = read('app/(public)/brokers/layout.tsx')
  assert.match(layout, /alternates: \{ canonical: '\/brokers' \}/)
  // canonicalUrl strips all query params for any /brokers variant.
  assert.equal(canonicalUrl('/brokers?location=Dallas&radius=25'), 'https://homeloanmarket.com/brokers')
})

test('public indexability matrix is preserved (auth noindex, private blocked)', () => {
  const authLayout = read('app/(public)/auth/layout.tsx')
  assert.match(authLayout, /robots: \{ index: false, follow: false \}/)
  const robots = read('app/robots.ts')
  assert.match(robots, /\/admin\//)
  assert.match(robots, /\/api\//)
})
