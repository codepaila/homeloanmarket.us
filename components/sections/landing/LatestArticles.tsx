import Link from 'next/link'
import prisma from '@/lib/prisma'

export async function LatestArticles() {
  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    select: { title: true, slug: true, excerpt: true, coverImage: true, category: true },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  })

  if (posts.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Latest Articles</h2>
          <p className="mt-2 text-muted-foreground">Helpful home loan resources from the HomeLoanMarket team.</p>
        </div>
        <Link href="/blog" className="hidden text-sm font-medium text-primary hover:text-primary sm:block">
          View all articles →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
            <article className="flex h-full flex-col overflow-hidden rounded border bg-card shadow-soft transition-shadow group-hover:shadow-medium">
              {post.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.coverImage} alt={post.title} className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full bg-muted" />
              )}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{post.category}</p>
                <h3 className="text-base font-semibold text-foreground group-hover:text-primary">{post.title}</h3>
                <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
              </div>
            </article>
          </Link>
        ))}
      </div>

      <Link href="/blog" className="mt-6 block text-center text-sm font-medium text-primary hover:text-primary sm:hidden">
        View all articles →
      </Link>
    </section>
  )
}
