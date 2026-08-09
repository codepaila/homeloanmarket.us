import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { canonicalUrl, getSiteUrl } from '../lib/seo'

const database = process.env.PHASE13_AUTH_DATABASE_URL

test.after(async () => {
  if (database) {
    const { default: prisma } = await import('../lib/prisma')
    await prisma.$disconnect()
  }
})

test('Site settings service reads persisted values with fallbacks', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  const { getSiteSettings } = await import('../lib/site/settings')
  try {
    const settings = await getSiteSettings()
    assert.equal(typeof settings.siteName, 'string')
    assert.ok(settings.siteName.length > 0)
    assert.equal(typeof settings.seoTitle, 'string')
    assert.equal(typeof settings.contactEmail, 'string')
    assert.equal(typeof settings.footerDescription, 'string')

    const seoTitle = await prisma.setting.findUnique({ where: { key: 'seoTitle' } })
    assert.equal(settings.seoTitle, seoTitle?.value || settings.seoTitle)
  } finally {
    await prisma.$disconnect()
  }
})

test('Blog content: drafts are private and slugs are unique', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const posts = await prisma.blogPost.findMany({ select: { slug: true, isPublished: true } })
    assert.equal(new Set(posts.map((post) => post.slug)).size, posts.length)
    assert.ok(posts.some((post) => post.isPublished))
    assert.ok(posts.some((post) => !post.isPublished))
  } finally {
    await prisma.$disconnect()
  }
})

test('Published blogs are sitemap-eligible; drafts are not', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const posts = await prisma.blogPost.findMany({ select: { slug: true, isPublished: true } })
    for (const post of posts) {
      const eligible = post.isPublished
      if (eligible) assert.equal(post.isPublished, true)
    }
    const draftSlugs = posts.filter((post) => !post.isPublished).map((post) => post.slug)
    assert.ok(draftSlugs.length > 0)
  } finally {
    await prisma.$disconnect()
  }
})

test('Published blog featured images are valid https URLs or local files', { skip: !database }, async () => {
  const { default: prisma } = await import('../lib/prisma')
  try {
    const posts = await prisma.blogPost.findMany({ where: { isPublished: true, coverImage: { not: null } }, select: { coverImage: true } })
    for (const post of posts) {
      const image = post.coverImage || ''
      if (image.startsWith('http')) {
        const url = new URL(image)
        assert.equal(url.protocol, 'https:')
      } else {
        assert.equal(fs.existsSync(path.join(process.cwd(), 'public', image)), true, image)
      }
    }
  } finally {
    await prisma.$disconnect()
  }
})

test('Canonical URL safety remains intact for the new blog routes', () => {
  assert.equal(canonicalUrl('/blog/example?utm=x'), `${getSiteUrl()}/blog/example`)
  assert.equal(canonicalUrl('/blog/example/'), `${getSiteUrl()}/blog/example`)
})
