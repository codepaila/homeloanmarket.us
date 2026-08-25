import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { canonicalUrl, safeJsonLd, organizationId, breadcrumbJsonLd } from '@/lib/seo'

interface BlogSlugPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogSlugPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({ where: { slug } })

  if (!post || !post.isPublished) {
    return { title: 'Article Not Found', robots: { index: false, follow: false } }
  }

  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt || post.title

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(`/blog/${post.slug}`) },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonicalUrl(`/blog/${post.slug}`),
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
      publishedTime: post.publishedAt?.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
  }
}

export default async function BlogSlugPage({ params }: BlogSlugPageProps) {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({ where: { slug } })

  if (!post || !post.isPublished) notFound()

  const jsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    ...(post.coverImage ? { image: post.coverImage } : {}),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@id': organizationId() },
    datePublished: post.publishedAt?.toISOString(),
    mainEntityOfPage: canonicalUrl(`/blog/${post.slug}`),
  })

  const breadcrumbLd = safeJsonLd(breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Articles', path: '/blog' },
    { name: post.title, path: `/blog/${post.slug}` },
  ]))

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{post.category}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{post.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {post.author} · {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
      </p>
      {post.coverImage ? (
        <div className="mt-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt={post.title} className="h-72 w-full object-cover" />
        </div>
      ) : null}

      <div className="prose prose-stone mt-8 max-w-none whitespace-pre-line text-foreground">
        {post.content}
      </div>

      <div className="mt-10 border-t pt-6">
        <Link href="/blog" className="text-sm font-medium text-primary hover:text-primary">
          ← Back to Articles
        </Link>
      </div>
    </article>
  )
}
