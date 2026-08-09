import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { ContentTable } from '@/components/admin/content/ContentTable'

export const metadata: Metadata = {
  title: 'Content / Blogs',
}

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const params = await searchParams
  const search = params.search?.trim() || ''
  const status = params.status === 'published' ? 'published' : params.status === 'draft' ? 'draft' : 'all'

  const posts = await prisma.blogPost.findMany({
    where: {
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      ...(status === 'published' ? { isPublished: true } : {}),
      ...(status === 'draft' ? { isPublished: false } : {}),
    },
    select: { id: true, title: true, slug: true, category: true, isPublished: true, publishedAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  return <ContentTable posts={posts} search={search} status={status} />
}
