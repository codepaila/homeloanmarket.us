import assert from 'node:assert/strict'
import test from 'node:test'
import { DEMO_IMAGES } from '../prisma/seed/demo-images'

const database = process.env.PHASE13_AUTH_DATABASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

function assertValidImage(url: unknown, label: string) {
  assert.ok(typeof url === 'string' && url.length > 0, `${label} missing`)
  assert.ok(url.startsWith('https://'), `${label} not https: ${url}`)
  assert.ok(url.includes('images.unsplash.com'), `${label} not images.unsplash.com: ${url}`)
  assert.equal(url.includes('localhost'), false, `${label} localhost`)
  assert.equal(url.includes('127.0.0.1'), false, `${label} loopback`)
  assert.equal(url.includes('/demo-images/'), false, `${label} demo-images`)
}

test('Image catalog has the required categories and deterministic keys', () => {
  assert.ok(DEMO_IMAGES.brokers.length >= 8)
  assert.ok(DEMO_IMAGES.brokerCovers.length >= 5)
  assert.ok(DEMO_IMAGES.advertisements.hero.length >= 4)
  assert.ok(DEMO_IMAGES.advertisements.sidebar.length >= 3)
  assert.ok(DEMO_IMAGES.advertisements.inline.length >= 3)
  assert.ok(DEMO_IMAGES.advertisements.footer.length >= 2)
  assert.ok(DEMO_IMAGES.advertisements.announcement.length >= 2)
  assert.ok(DEMO_IMAGES.advertisements.popup.length >= 1)
  assert.ok(DEMO_IMAGES.advertisements.mobile.length >= 2)
  assert.ok(DEMO_IMAGES.advertisements.button.length >= 1)
  assert.ok(DEMO_IMAGES.blogs.length >= 6)
  assert.ok(DEMO_IMAGES.properties.length >= 6)
  assert.ok(DEMO_IMAGES.testimonials.length >= 3)
  assert.ok(DEMO_IMAGES.homepage.length >= 5)

  const allEntries = [
    ...DEMO_IMAGES.brokers,
    ...DEMO_IMAGES.brokerCovers,
    ...Object.values(DEMO_IMAGES.advertisements).flat(),
    ...DEMO_IMAGES.blogs,
    ...DEMO_IMAGES.properties,
    ...DEMO_IMAGES.testimonials,
    ...DEMO_IMAGES.homepage,
  ]
  const keys = allEntries.map((entry) => entry.key)
  assert.equal(new Set(keys).size, keys.length, 'duplicate image keys')
})

test('Every catalog image is a deterministic HTTPS images.unsplash.com URL', () => {
  const allEntries = [
    ...DEMO_IMAGES.brokers,
    ...DEMO_IMAGES.brokerCovers,
    ...Object.values(DEMO_IMAGES.advertisements).flat(),
    ...DEMO_IMAGES.blogs,
    ...DEMO_IMAGES.properties,
    ...DEMO_IMAGES.testimonials,
    ...DEMO_IMAGES.homepage,
  ]
  for (const entry of allEntries) {
    assertValidImage(entry.url, entry.key)
    assert.equal(typeof entry.alt, 'string')
    assert.ok(entry.width > 0 && entry.height > 0)
  }
})

test('No catalog URL contains forbidden patterns', () => {
  const urls = [
    ...DEMO_IMAGES.brokers.map((entry) => entry.url),
    ...DEMO_IMAGES.blogs.map((entry) => entry.url),
    ...Object.values(DEMO_IMAGES.advertisements).flat().map((entry) => entry.url),
  ]
  for (const url of urls) {
    assert.equal(url.includes('source.unsplash.com'), false, url)
    assert.equal(/[?#]\S*=/.test(url) && !url.includes('auto=format'), false, url)
  }
})

test('Seeded database records use Unsplash image URLs', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const brokers = await prisma.broker.findMany({ select: { logo: true, coverImage: true } })
    assert.ok(brokers.length > 0)
    for (const broker of brokers) {
      assertValidImage(broker.logo, 'broker logo')
      assertValidImage(broker.coverImage, 'broker cover')
    }

    const ads = await prisma.advertisement.findMany({ select: { bannerUrl: true } })
    for (const ad of ads) {
      assertValidImage(ad.bannerUrl, 'ad banner')
    }

    const blogs = await prisma.blogPost.findMany({ select: { coverImage: true } })
    for (const blog of blogs) {
      assertValidImage(blog.coverImage, 'blog cover')
    }

    const media = await prisma.mediaAsset.findMany({ where: { tags: { has: 'seed-owned' } }, select: { fileUrl: true } })
    for (const asset of media) {
      assertValidImage(asset.fileUrl, 'media asset')
    }
  } finally {
    await prisma.$disconnect()
  }
})

test('Next.js allows images.unsplash.com without wildcard hosts', async () => {
  const mod = await import('../next.config')
  const patterns = mod.default?.images?.remotePatterns || []
  assert.ok(patterns.length > 0)
  assert.equal(patterns.some((pattern: { hostname?: string }) => pattern.hostname === 'images.unsplash.com'), true)
  assert.equal(patterns.some((pattern: { hostname?: string }) => pattern.hostname === '*'), false)
  const domains = mod.default?.images?.domains
  assert.equal(Array.isArray(domains) && domains.includes('*'), false)
})
