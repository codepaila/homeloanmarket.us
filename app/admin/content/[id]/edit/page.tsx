import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'
import { updateBlog } from '@/actions/content'
import { BlogForm } from '@/components/admin/content/BlogForm'

export const metadata: Metadata = {
  title: 'Edit Article',
}

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/auth/signin')

  const { id } = await params
  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) redirect('/admin/content')

  const assets = await prisma.mediaAsset.findMany({
    where: { isDeleted: false },
    select: { id: true, title: true, fileName: true, originalName: true, fileUrl: true, thumbnailUrl: true, mimeType: true, extension: true, fileSize: true, width: true, height: true, altText: true, tags: true, folderId: true, uploaderId: true, isDeleted: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <BlogForm
      action={updateBlog.bind(null, id)}
      assets={assets}
      initial={{
        id,
        title: post.title,
        excerpt: post.excerpt || '',
        content: post.content,
        coverImage: post.coverImage,
        author: post.author,
        category: post.category,
        tags: post.tags,
        isPublished: post.isPublished,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
      }}
    />
  )
}
