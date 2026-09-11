'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'
import { isHtmlContent, sanitizeArticleHtml } from '@/lib/blog-content'

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createBlog(_previousState: ContentState, formData: FormData): Promise<ContentState> {
  const admin = await requireAdmin()
  if (!admin) return { error: 'Unauthorized' }

  const title = formData.get('title')?.toString().trim() || ''
  const requestedSlug = formData.get('slug')?.toString().trim() || ''
  if (!title) return { error: 'Title is required.' }

  const baseSlug = slugify(requestedSlug || title)
  let slug = baseSlug
  let suffix = 1
  while (await prisma.blogPost.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  const isPublished = formData.get('isPublished') === 'true' || formData.get('isPublished') === 'on'
  const publishedAt = isPublished ? new Date() : null
  const tags = (formData.get('tags')?.toString() || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  await prisma.blogPost.create({
    data: {
      title,
      slug,
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
    },
  })

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
  const requestedSlug = formData.get('slug')?.toString().trim() || ''
  const isPublished = formData.get('isPublished') === 'true' || formData.get('isPublished') === 'on'

  const slug = slugify(requestedSlug || title)
  if (slug !== existing.slug) {
    const conflict = await prisma.blogPost.findUnique({ where: { slug } })
    if (conflict) return { error: 'Slug is already in use.' }
  }

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
