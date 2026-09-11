'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { isHtmlContent, sanitizeArticleHtml, slugifyBlogTitle } from '@/lib/blog-content'

type ContentState = { error?: string } | undefined

// Defense-in-depth write-time sanitization. The public render sanitizer
// (app/(public)/blog/[slug]) remains the mandatory boundary; this only reduces
// what gets persisted. Legacy plain text is stored verbatim (it renders
// escaped, so it needs no sanitization).
function prepareContentForPersistence(raw: unknown): string {
  const content = typeof raw === 'string' ? raw : ''
  if (!content.trim()) return ''
  return isHtmlContent(content) ? sanitizeArticleHtml(content) : content
}

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}

/**
 * Deterministic unique-slug resolution. The DB column is unique (`@unique`);
 * this loop only reserves the obvious next free suffix before the insert. The
 * suffix starts at 2 ("title-2", "title-3", ...) so the base slug is never
 * mutated. On a rare P2002 race the insert is retried through the same
 * resolver (see createBlog).
 */
async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  let candidate = baseSlug
  let suffix = 2
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (!(await prisma.blogPost.findUnique({ where: { slug: candidate }, select: { slug: true } }))) {
      return candidate
    }
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
  return `${baseSlug}-${Date.now().toString(36)}`
}

/** Prisma unique-constraint conflict (duplicate slug insert). */
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

type BlogArticleInput = {
  title: string
  slug: string
  excerpt: string
  content: string
  coverImage: string | null
  author: string
  category: string
  tags: string[]
  isPublished: boolean
  publishedAt: Date | null
  seoTitle: string | null
  seoDescription: string | null
}

/**
 * Insert a post under a uniquely-resolved slug. The natural slug is attempted
 * first; a P2002 race (another request inserted the same slug between our
 * check and this insert) falls back to deterministic suffix resolution and is
 * retried. The DB unique constraint is the final protection on every attempt.
 */
async function createBlogPostWithUniqueSlug(article: BlogArticleInput): Promise<string> {
  let slug = article.slug
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      await prisma.blogPost.create({ data: { ...article, slug } })
      return slug
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err
      slug = await resolveUniqueSlug(article.slug)
    }
  }
  throw new Error('Unable to generate a unique blog slug after repeated attempts.')
}

export async function createBlog(_previousState: ContentState, formData: FormData): Promise<ContentState> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  const title = formData.get('title')?.toString().trim() || ''
  if (!title) return { error: 'Title is required.' }

  // Slug is generated server-side from the title ONLY. A client-supplied
  // `slug` field is never read — admins cannot type a slug and a malicious
  // caller cannot inject one.
  const baseSlug = slugifyBlogTitle(title)
  if (!baseSlug) return { error: 'Title must contain at least one letter or number to create a URL slug.' }

  const isPublished = formData.get('isPublished') === 'true' || formData.get('isPublished') === 'on'
  const publishedAt = isPublished ? new Date() : null
  const tags = (formData.get('tags')?.toString() || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  const article = {
    title,
    slug: baseSlug,
    excerpt: formData.get('excerpt')?.toString().trim() || '',
    content: prepareContentForPersistence(formData.get('content')),
    coverImage: formData.get('coverImage')?.toString().trim() || null,
    author: formData.get('author')?.toString().trim() || 'HomeLoanMarket',
    category: formData.get('category')?.toString().trim() || 'Mortgage Basics',
    tags,
    isPublished,
    publishedAt,
    seoTitle: formData.get('seoTitle')?.toString().trim() || null,
    seoDescription: formData.get('seoDescription')?.toString().trim() || null,
  }

  await createBlogPostWithUniqueSlug(article)

  revalidatePath('/admin/content')
  revalidatePath('/blog')
  redirect('/admin/content')
}

export async function updateBlog(blogId: string, _previousState: ContentState, formData: FormData): Promise<ContentState> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  const existing = await prisma.blogPost.findUnique({ where: { id: blogId } })
  if (!existing) return { error: 'Blog not found.' }

  const title = formData.get('title')?.toString().trim() || existing.title
  const isPublished = formData.get('isPublished') === 'true' || formData.get('isPublished') === 'on'

  // UPDATE PRESERVES THE EXISTING SLUG. Editing the title must never change a
  // public URL (links, SEO, bookmarks, sitemap depend on slug stability). A
  // client-supplied `slug` field is ignored entirely — the slug is never
  // regenerated from the new title. The only exception is a legacy record
  // whose slug is entirely missing/empty, which is repaired from the title
  // exactly once (reported as data-quality, not a mass rewrite).
  const slug = existing.slug && existing.slug.trim() ? existing.slug : await resolveUniqueSlug(slugifyBlogTitle(title))

  await prisma.blogPost.update({
    where: { id: blogId },
    data: {
      title,
      slug,
      excerpt: formData.get('excerpt')?.toString().trim() || '',
      content: prepareContentForPersistence(formData.get('content')),
      coverImage: formData.get('coverImage')?.toString().trim() || null,
      author: formData.get('author')?.toString().trim() || 'HomeLoanMarket',
      category: formData.get('category')?.toString().trim() || 'Mortgage Basics',
      tags: (formData.get('tags')?.toString() || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      isPublished,
      publishedAt: isPublished ? existing.publishedAt || new Date() : null,
      seoTitle: formData.get('seoTitle')?.toString().trim() || null,
      seoDescription: formData.get('seoDescription')?.toString().trim() || null,
    },
  })

  revalidatePath('/admin/content')
  revalidatePath(`/admin/content/${blogId}/edit`)
  revalidatePath('/blog')
  if (existing.slug && existing.slug !== slug) revalidatePath(`/blog/${existing.slug}`)
  revalidatePath(`/blog/${slug}`)
  redirect('/admin/content')
}

export async function toggleBlogPublished(blogId: string): Promise<void> {
  const admin = await requireAdmin()
  if (!admin) return

  const existing = await prisma.blogPost.findUnique({ where: { id: blogId } })
  if (!existing) return

  await prisma.blogPost.update({
    where: { id: blogId },
    data: {
      isPublished: !existing.isPublished,
      publishedAt: existing.isPublished ? null : existing.publishedAt || new Date(),
    },
  })
  revalidatePath('/admin/content')
  revalidatePath('/blog')
  revalidatePath(`/blog/${existing.slug}`)
}

export async function deleteBlog(blogId: string): Promise<void> {
  const admin = await requireAdmin()
  if (!admin) return

  const existing = await prisma.blogPost.findUnique({ where: { id: blogId } })
  if (!existing) return

  await prisma.blogPost.delete({ where: { id: blogId } })
  revalidatePath('/admin/content')
  revalidatePath('/blog')
}

export async function getBlogById(blogId: string) {
  const post = await prisma.blogPost.findUnique({ where: { id: blogId } })
  if (!post) notFound()
  return post
}
