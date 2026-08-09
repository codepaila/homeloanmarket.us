import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { createBlog } from '@/actions/content'
import { BlogForm } from '@/components/admin/content/BlogForm'

export const metadata: Metadata = {
  title: 'New Article',
}

export default async function NewContentPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const assets = await prisma.mediaAsset.findMany({
    where: { isDeleted: false },
    select: { id: true, title: true, fileName: true, originalName: true, fileUrl: true, thumbnailUrl: true, mimeType: true, extension: true, fileSize: true, width: true, height: true, altText: true, tags: true, folderId: true, uploaderId: true, isDeleted: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <BlogForm
      action={createBlog}
      assets={assets}
      initial={{ title: '', slug: '', excerpt: '', content: '', coverImage: null, author: 'HomeLoanMarket', category: 'Mortgage Basics', tags: [], isPublished: false, seoTitle: null, seoDescription: null }}
    />
  )
}
