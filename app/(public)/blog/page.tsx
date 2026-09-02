import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { canonicalUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Mortgage Articles & Guides',
  description: 'Practical articles and guides about mortgages, home buying, refinancing, credit, and finding the right mortgage originator.',
  alternates: { canonical: canonicalUrl('/blog') },
  openGraph: {
    type: 'website',
    title: 'Mortgage Articles & Guides',
    description: 'Practical articles and guides about mortgages, home buying, refinancing, credit, and finding the right mortgage originator.',
    url: canonicalUrl('/blog'),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mortgage Articles & Guides',
    description: 'Practical articles and guides about mortgages, home buying, refinancing, credit, and finding the right mortgage originator.',
  },
}

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    select: { title: true, slug: true, excerpt: true, coverImage: true, author: true, category: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 30,
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Articles</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Practical guides and resources about mortgages, home buying, and refinancing.
        </p>
        {posts.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">No published articles yet.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow group-hover:shadow-medium">
                  {post.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.coverImage} alt={post.title} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="h-40 w-full bg-muted" />
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{post.category}</p>
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">{post.title}</h2>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
                    <p className="mt-auto pt-2 text-xs text-muted-foreground">
                      {post.author} · {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
