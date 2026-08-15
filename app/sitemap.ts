import type { MetadataRoute } from 'next'
import prisma from '@/lib/prisma'
import { canonicalUrl, isIndexablePublicBroker } from '@/lib/seo'

const staticPublicPaths = ['/', '/brokers', '/about', '/contact', '/faq', '/guides', '/blog', '/calculator', '/privacy', '/terms']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brokers, posts] = await Promise.all([
    prisma.broker.findMany({
      where: {
        isVisible: true,
        brokerStatus: { not: 'SUSPENDED' },
        OR: [
          { creationSource: 'ADMIN_CREATED' },
          { verificationStatus: 'VERIFIED' },
        ],
      },
      select: {
        profileSlug: true,
        userId: true,
        isVisible: true,
        verificationStatus: true,
        brokerStatus: true,
        creationSource: true,
        updatedAt: true,
        user: { select: { isActive: true } },
      },
    }),
    prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const entries: MetadataRoute.Sitemap = staticPublicPaths.map((path) => ({
    url: canonicalUrl(path),
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.6,
  }))

  entries.push(...brokers.filter((broker) => isIndexablePublicBroker({
    isVisible: broker.isVisible,
    verificationStatus: broker.verificationStatus,
    brokerStatus: broker.brokerStatus,
    creationSource: broker.creationSource,
    userId: broker.userId,
    userIsActive: broker.user?.isActive,
  })).map((broker) => ({
    url: canonicalUrl(`/brokers/${broker.profileSlug}`),
    lastModified: broker.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  })))

  entries.push(...posts.map((post) => ({
    url: canonicalUrl(`/blog/${post.slug}`),
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  })))

  return [...new Map(entries.map((entry) => [entry.url, entry])).values()]
}
