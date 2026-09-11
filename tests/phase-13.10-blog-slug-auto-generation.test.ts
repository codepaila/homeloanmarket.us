import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { slugifyBlogTitle, BLOG_SLUG_MAX_LENGTH } from '../lib/blog-content'

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname)
const read = (relative: string): string => fs.readFileSync(path.resolve(TEST_DIR, '..', relative), 'utf8')

// ===========================================================================
// PHASE 13.10 — BLOG SLUG AUTO-GENERATION + ADMIN FORM CLEANUP
//
// Slug source of truth: title -> slugifyBlogTitle -> unique slug -> stored in
// BlogPost.slug. The admin UI exposes NO slug field; the server ignores any
// client-supplied slug; edits preserve the existing slug (public URLs stay
// stable). Run with: node --test --experimental-test-module-mocks --import tsx
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. MATRIX 1/2/3/6 — canonical slugify (pure, real module)
// ---------------------------------------------------------------------------

test("MATRIX 1: 'Hello World' -> 'hello-world'", () => {
  assert.equal(slugifyBlogTitle('Hello World'), 'hello-world')
})

test('MATRIX 2: punctuation is normalized deterministically', () => {
  assert.equal(slugifyBlogTitle('Next.js: Getting Started!'), 'next-js-getting-started')
  assert.equal(slugifyBlogTitle('C# for Beginners — Part 1'), 'c-for-beginners-part-1')
})

test('MATRIX 3: spaces / repeated separators are collapsed to single hyphens', () => {
  assert.equal(slugifyBlogTitle('  a   b  '), 'a-b')
  assert.equal(slugifyBlogTitle('A__-_-___B'), 'a-b')
  assert.equal(slugifyBlogTitle('How  --  To --COOK'), 'how-to-cook')
  assert.equal(slugifyBlogTitle('-hello world-'), 'hello-world')
})

test('MATRIX 6: empty, whitespace-only, and punctuation-only titles produce no slug', () => {
  assert.equal(slugifyBlogTitle(''), '')
  assert.equal(slugifyBlogTitle('   '), '')
  assert.equal(slugifyBlogTitle('!!!...???'), '')
})

test('slug output is bounded: truncates past BLOG_SLUG_MAX_LENGTH at a hyphen boundary', () => {
  const long = slugifyBlogTitle(`${'word '.repeat(50)}finish`)
  assert.ok(long.length <= BLOG_SLUG_MAX_LENGTH, `generated slug length ${long.length} <= ${BLOG_SLUG_MAX_LENGTH}`)
  assert.doesNotMatch(long, /-$/, 'no trailing hyphen after truncation')
  assert.equal(long, slugifyBlogTitle(`${'word '.repeat(50)}finish`), 'truncation is deterministic')
})

// ---------------------------------------------------------------------------
// 2. Static source audits — admin UI, server authority, DB, public routes
// ---------------------------------------------------------------------------

test('BlogForm exposes NO slug input and carries no slug form state', () => {
  const form = read('components/admin/content/BlogForm.tsx')
  assert.doesNotMatch(form, /name="slug"/, 'no input field named slug')
  assert.doesNotMatch(form, /label="Slug"/, 'no Slug label')
  const typeBlock = form.slice(form.indexOf('export type BlogInitialValues'), form.indexOf('type FormAction'))
  assert.doesNotMatch(typeBlock, /\bslug\b/, 'BlogInitialValues no longer carries slug state')
})

test('MATRIX 7/11: server actions never read a client-supplied slug FormData field', () => {
  const src = read('actions/content.ts')
  assert.doesNotMatch(src, /formData\.get\(['"]slug['"]\)/, 'create/update ignore any submitted slug')
  assert.doesNotMatch(src, /requestedSlug/, 'no client-slug fallback exists')
  assert.match(src, /const baseSlug = slugifyBlogTitle\(title\)/, 'create derives slug from the title server-side')
})

test('MATRIX 4/5: unique resolution uses deterministic suffix order (-2, -3, ...)', () => {
  const src = read('actions/content.ts')
  assert.match(src, /suffix starts at 2/, 'documented -2 start')
  assert.match(src, /let suffix = 2/, 'resolver starts at suffix 2')
  assert.doesNotMatch(src, /-1\b/, 'no -1 suffix in the resolver')
})

test('MATRIX 4: DB unique constraint remains the final protection', () => {
  const schema = read('prisma/schema.prisma')
  const block = schema.slice(schema.indexOf('model BlogPost'), schema.indexOf('model FAQ'))
  assert.match(block, /slug\s+String\s+@unique/, 'BlogPost.slug is a unique DB column')
  const src = read('actions/content.ts')
  assert.match(src, /\.code === 'P2002'/, 'P2002 conflicts are recognized')
  assert.match(src, /The DB unique constraint is the final protection on every attempt/, 'constraint is the final guard')
})

test('MATRIX 8/9/10: update preserves the existing slug; only a missing legacy slug is repaired', () => {
  const src = read('actions/content.ts')
  const updateBlock = src.slice(src.indexOf('export async function updateBlog'), src.indexOf('export async function toggleBlogPublished'))
  assert.doesNotMatch(updateBlock, /slugifyBlogTitle\(title\)(?![\s\S]*\?)/, 'slug is never regenerated from a changed title on normal edits')
  assert.match(updateBlock, /existing\.slug && existing\.slug\.trim\(\) \? existing\.slug :/, 'existing slug preserved; empty legacy slug repaired')
  assert.match(updateBlock, /revalidatePath\(`\/blog\/\$\{existing\.slug\}`\)/, 'old slug path revalidated when the slug changed')
})

test('MATRIX 13/14: every public URL is built from the stored BlogPost.slug', () => {
  const detail = read('app/(public)/blog/[slug]/page.tsx')
  assert.match(detail, /prisma\.blogPost\.findUnique\(\{ where: \{ slug \} \}\)/, 'detail route resolves by stored slug')
  assert.match(detail, /canonicalUrl\(`\/blog\/\$\{post\.slug\}`\)/, 'metadata/canonical + OG use the stored slug')
  const listing = read('app/(public)/blog/page.tsx')
  assert.match(listing, /href=\{`\/blog\/\$\{post\.slug\}`\}/, 'blog listing links use the stored slug')
  const latest = read('components/sections/landing/LatestArticles.tsx')
  assert.match(latest, /href=\{`\/blog\/\$\{post\.slug\}`\}/, 'recent-article links use the stored slug')
  const sitemap = read('app/sitemap.ts')
  assert.match(sitemap, /canonicalUrl\(`\/blog\/\$\{post\.slug\}`\)/, 'sitemap URLs use the stored slug')
})

// ---------------------------------------------------------------------------
// 3. Runtime behavior (mocked prisma/currentUser + next internals)
// ---------------------------------------------------------------------------

const revalidated: string[] = []
mock.module('next/cache', {
  namedExports: {
    revalidatePath: (p: string) => {
      revalidated.push(p)
    },
  },
})
mock.module('next/navigation', {
  namedExports: {
    redirect: () => {
      // Next's real redirect throws; a no-op mock keeps the action callable.
    },
    notFound: () => {
      throw new Error('notFound called')
    },
  },
})
mock.module('@/lib/currentUser', {
  namedExports: {
    getCurrentUser: async () => ({ role: 'ADMIN' as const, id: 'admin-1', name: 'Test Admin', email: 'admin@test.dev' }),
  },
})

const slugOccupied = new Set<string>()
let lastCreated: { title: string; slug: string } | null = null
let lastUpdated: { id: string; title: string; slug: string } | null = null
let existingPost: { id: string; slug: string } | null = null
let p2002FirstAttempt = true

mock.module('@/lib/prisma', {
  defaultExport: {
    blogPost: {
      findUnique: async (args: { where: { slug?: string; id?: string } }) => {
        if (args.where.slug !== undefined) return slugOccupied.has(args.where.slug) ? { slug: args.where.slug } : null
        if (args.where.id !== undefined) return existingPost && existingPost.id === args.where.id ? existingPost : null
        return null
      },
      create: async (args: { data: { title: string; slug: string } }) => {
        const { slug } = args.data
        if (slug === 'p2002-race') {
          if (p2002FirstAttempt) {
            p2002FirstAttempt = false
            // Simulate a concurrent insert winning the race: register the slug
            // (so resolution skips it) AND raise P2002 from the constraint.
            slugOccupied.add(slug)
            const err = new Error('Unique constraint failed on the fields: (`slug`)') as Error & { code?: string }
            err.code = 'P2002'
            throw err
          }
        }
        if (slugOccupied.has(slug)) {
          const err = new Error('Unique constraint failed on the fields: (`slug`)') as Error & { code?: string }
          err.code = 'P2002'
          throw err
        }
        slugOccupied.add(slug)
        lastCreated = { title: args.data.title, slug }
        return { id: 'new-post', ...args.data }
      },
      update: async (args: { where: { id: string }; data: { title: string; slug: string } }) => {
        lastUpdated = { id: args.where.id, title: args.data.title, slug: args.data.slug }
        return { id: args.where.id, ...args.data }
      },
    },
  },
})

let contentActions: typeof import('../actions/content')

function resetState(): void {
  slugOccupied.clear()
  lastCreated = null
  lastUpdated = null
  existingPost = null
  p2002FirstAttempt = true
  revalidated.length = 0
}

test('load the real content action module under mocked dependencies', async () => {
  contentActions = await import('../actions/content')
  assert.equal(typeof contentActions.createBlog, 'function')
  assert.equal(typeof contentActions.updateBlog, 'function')
})

// --- CREATE ---

test('MATRIX 1/12: create stores the slugified title in the DB and revalidates the blog', async () => {
  resetState()
  const fd = new FormData()
  fd.set('title', 'How to Build an AI Coding Agent')
  fd.set('isPublished', 'true')
  const res = await contentActions.createBlog(undefined, fd)
  assert.equal(res, undefined)
  assert.deepEqual(lastCreated, { title: 'How to Build an AI Coding Agent', slug: 'how-to-build-an-ai-coding-agent' })
  assert.ok(slugOccupied.has('how-to-build-an-ai-coding-agent'), 'slug persisted to the (mocked) DB')
  assert.ok(revalidated.includes('/admin/content'), 'admin list revalidated')
  assert.ok(revalidated.includes('/blog'), 'public blog listing revalidated')
})

test('MATRIX 4: a duplicate title receives a deterministic -2 suffix', async () => {
  resetState()
  slugOccupied.add('getting-started-with-next-js')
  const fd = new FormData()
  fd.set('title', 'Getting Started with Next.js')
  const res = await contentActions.createBlog(undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastCreated?.slug, 'getting-started-with-next-js-2')
})

test('MATRIX 5: multiple duplicate titles continue safely (-2, -3, ...)', async () => {
  resetState()
  slugOccupied.add('getting-started-with-next-js')
  slugOccupied.add('getting-started-with-next-js-2')
  const fd = new FormData()
  fd.set('title', 'Getting Started with Next.js')
  const res = await contentActions.createBlog(undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastCreated?.slug, 'getting-started-with-next-js-3')
})

test('MATRIX 6: a title that cannot produce a slug is rejected and nothing is written', async () => {
  resetState()
  const fd = new FormData()
  fd.set('title', '!!!...???')
  const res = await contentActions.createBlog(undefined, fd)
  assert.ok(res && /letter or number/.test(res.error || ''), `rejected with a clear error: ${res?.error}`)
  assert.equal(lastCreated, null, 'no post created')
  assert.equal(slugOccupied.size, 0, 'no slug written')
})

test('MATRIX 7/11: a client-submitted slug is ignored on create', async () => {
  resetState()
  const fd = new FormData()
  fd.set('title', 'Hello World')
  fd.set('slug', 'malicious-value')
  const res = await contentActions.createBlog(undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastCreated?.slug, 'hello-world', 'stored slug derives from the title only')
  assert.ok(!slugOccupied.has('malicious-value'), 'injected slug never stored')
})

test('P2002 race falls back to a resolved suffix and succeeds (final protection is the DB constraint)', async () => {
  resetState()
  const fd = new FormData()
  fd.set('title', 'P2002 Race')
  const res = await contentActions.createBlog(undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastCreated?.slug, 'p2002-race-2', 'concurrent conflict resolved to the next free suffix')
})

// --- EDIT ---

test('MATRIX 8: editing the title does NOT change the existing slug', async () => {
  resetState()
  existingPost = { id: 'post-1', slug: 'how-to-learn-next-js' }
  slugOccupied.add('how-to-learn-next-js')
  const fd = new FormData()
  fd.set('title', 'How to Learn Next.js in 2026')
  const res = await contentActions.updateBlog('post-1', undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastUpdated?.slug, 'how-to-learn-next-js', 'slug preserved across title edits')
  assert.equal(lastUpdated?.title, 'How to Learn Next.js in 2026', 'title still updated')
  assert.ok(!revalidated.includes('/blog/how-to-learn-next-js-in-2026'), 'no title-derived slug path is ever revalidated')
  assert.ok(revalidated.includes('/blog/how-to-learn-next-js'), 'existing slug path revalidated')
})

test('MATRIX 9: editing content without a title change preserves the slug', async () => {
  resetState()
  existingPost = { id: 'post-1', slug: 'understanding-closing-costs' }
  slugOccupied.add('understanding-closing-costs')
  const fd = new FormData()
  fd.set('title', 'Understanding Closing Costs')
  fd.set('content', '<p>Updated body copy.</p>')
  const res = await contentActions.updateBlog('post-1', undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastUpdated?.slug, 'understanding-closing-costs')
})

test('MATRIX 10: a legacy article with a missing (empty) slug is repaired exactly once from the title', async () => {
  resetState()
  existingPost = { id: 'post-2', slug: '' }
  const fd = new FormData()
  fd.set('title', 'Legacy Article')
  const res = await contentActions.updateBlog('post-2', undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastUpdated?.slug, 'legacy-article', 'empty legacy slug regenerated from the title')
  assert.ok(revalidated.includes('/blog/legacy-article'))
})

test('MATRIX 10b: a non-empty legacy slug is preserved verbatim (no silent rewrite)', async () => {
  resetState()
  existingPost = { id: 'post-3', slug: 'Legacy_SLUG-here' }
  const fd = new FormData()
  fd.set('title', 'Unrelated New Title')
  const res = await contentActions.updateBlog('post-3', undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastUpdated?.slug, 'Legacy_SLUG-here', 'valid-but-unconventional legacy slug untouched')
})

test('MATRIX 11: a client-submitted slug cannot override the stored slug on edit', async () => {
  resetState()
  existingPost = { id: 'post-1', slug: 'stable-public-url' }
  slugOccupied.add('stable-public-url')
  const fd = new FormData()
  fd.set('title', 'A Totally Different Title')
  fd.set('slug', 'hacked-slug')
  const res = await contentActions.updateBlog('post-1', undefined, fd)
  assert.equal(res, undefined)
  assert.equal(lastUpdated?.slug, 'stable-public-url', 'edit ignores the injected slug')
  assert.ok(!slugOccupied.has('hacked-slug'), 'injected slug never written on edit')
})