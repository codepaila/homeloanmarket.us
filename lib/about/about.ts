// lib/about/about.ts
//
// Structured, database-backed About Page CMS.
//
// The public About page reads a single AboutPage row (fixed section content +
// SEO) plus two structured repeatable entities:
//   - AboutStat    (section stats, with dynamic or static values)
//   - AboutBenefit (mission "feature card" list)
//
// Image fields store the canonical Media Library URL (fileUrl) and are
// validated against the MediaAsset library on save — the same convention as
// global SiteSettings branding. Stats are never fabricated: dynamic stat types
// resolve to real, database-backed counts; a static value is only shown when
// explicitly configured by an admin.
import { cache } from 'react'
import prisma from '@/lib/prisma'
import { publicBrokerWhere } from '@/lib/broker-policy'
import { getSiteSettings } from '@/lib/site/settings'
import type { AboutStatType, Prisma } from '@prisma/client'

// The single canonical AboutPage row id. The CMS operates on one singleton row.
// A stable, valid MongoDB ObjectId (24 hex chars) so the singleton is
// addressable and idempotent across environments.
export const ABOUT_PAGE_ID = '000000000000000000000001'

// Stat types that resolve to real, measurable values derived from the database.
// Admin can only pick from this allowlist — they cannot write arbitrary queries.
export const DYNAMIC_STAT_TYPES = ['DYNAMIC_ORIGINATORS', 'DYNAMIC_STATES', 'DYNAMIC_CITIES'] as const
export type DynamicStatType = (typeof DYNAMIC_STAT_TYPES)[number]
export const STATIC_STAT_TYPE = 'STATIC' as const

// AboutBenefit icon allowlist. Admin cannot inject arbitrary icon/component code.
export const ABOUT_BENEFIT_ICONS = ['Users', 'TrendingUp', 'Shield', 'Award', 'Home', 'MapPin', 'Sparkles', 'CheckCircle2'] as const
export type AboutBenefitIconKey = (typeof ABOUT_BENEFIT_ICONS)[number]

export type AboutPublicStat = { label: string; value: string }

// ---------------------------------------------------------------------------
// Dynamic stat resolution
// ---------------------------------------------------------------------------

// Compute the real, DB-backed value for a dynamic stat type using the same
// public-eligibility rule as the marketplace listing. Returns null when the
// value cannot be measured (never a fabricated fallback).
export async function resolveDynamicStat(type: DynamicStatType): Promise<number | null> {
  const where = publicBrokerWhere()
  try {
    if (type === 'DYNAMIC_ORIGINATORS') {
      return await prisma.broker.count({ where })
    }
    // type === 'DYNAMIC_STATES' | 'DYNAMIC_CITIES'
    const field = type === 'DYNAMIC_STATES' ? 'state' : 'city'
    const rows = (await prisma.broker.findMany({
      where,
      select: { [field]: true },
    })) as unknown as Array<{ state?: string | null; city?: string | null }>
    const values = new Set<string>()
    for (const row of rows) {
      const v = field === 'state' ? row.state : row.city
      if (v && v.trim()) values.add(v.trim())
    }
    return values.size
  } catch {
    return null
  }
}

// Resolve every enabled stat to its final displayed value. Dynamic stats are
// computed live; STATIC stats use the admin-configured staticValue. A dynamic
// stat that cannot be measured is omitted (never a fabricated number).
export async function resolveAboutStats(stats: Array<{
  id: string
  label: string
  statType: string
  staticValue: string | null
  enabled: boolean
  displayOrder: number
}>): Promise<AboutPublicStat[]> {
  const out: AboutPublicStat[] = []
  for (const stat of stats) {
    if (!stat.enabled) continue
    let value: string | null = null
    if (stat.statType === STATIC_STAT_TYPE) {
      const v = stat.staticValue ? stat.staticValue.trim() : ''
      if (v) value = v
    } else if ((DYNAMIC_STAT_TYPES as readonly string[]).includes(stat.statType)) {
      const n = await resolveDynamicStat(stat.statType as DynamicStatType)
      if (n !== null && n > 0) value = String(n)
    }
    if (value === null) continue // omit unmeasurable/unconfigured stats
    out.push({ label: stat.label, value })
  }
  // Preserve the provided display order (enabled items only). The caller passes
  // stats already sorted by displayOrder, so we keep that sequence.
  return out
}

// ---------------------------------------------------------------------------
// Admin read
// ---------------------------------------------------------------------------

export type AboutAdminData = {
  page: {
    isActive: boolean
    heroEnabled: boolean
    heroEyebrow: string | null
    heroTitle: string | null
    heroDescription: string | null
    heroImageUrl: string | null
    heroImageAlt: string | null
    statsEnabled: boolean
    missionEnabled: boolean
    missionTitle: string | null
    missionContent: string | null
    missionContent2: string | null
    missionChecklist: string[]
    missionImageUrl: string | null
    missionImageAlt: string | null
    benefitsEnabled: boolean
    contactEnabled: boolean
    contactTitle: string | null
    contactEmail: string | null
    seoTitle: string | null
    seoDescription: string | null
    seoOgImageUrl: string | null
    createdAt: Date
    updatedAt: Date
  }
  stats: Array<{
    id: string
    label: string
    statType: string
    staticValue: string | null
    enabled: boolean
    displayOrder: number
  }>
  benefits: Array<{
    id: string
    title: string
    description: string
    iconKey: string
    enabled: boolean
    displayOrder: number
  }>
  dynamicStats: Record<string, number | null>
}

export async function getAboutAdminData(): Promise<AboutAdminData> {
  const found = await prisma.aboutPage.findUnique({
    where: { id: ABOUT_PAGE_ID },
    include: { stats: { orderBy: { displayOrder: 'asc' } }, benefits: { orderBy: { displayOrder: 'asc' } } },
  })
  const page = found ? found : await seedAboutPage()

  const dynamicStats: Record<string, number | null> = {}
  for (const type of DYNAMIC_STAT_TYPES) {
    dynamicStats[type] = await resolveDynamicStat(type)
  }

  return {
    page: {
      isActive: page.isActive,
      heroEnabled: page.heroEnabled,
      heroEyebrow: page.heroEyebrow,
      heroTitle: page.heroTitle,
      heroDescription: page.heroDescription,
      heroImageUrl: page.heroImageUrl,
      heroImageAlt: page.heroImageAlt,
      statsEnabled: page.statsEnabled,
      missionEnabled: page.missionEnabled,
      missionTitle: page.missionTitle,
      missionContent: page.missionContent,
      missionContent2: page.missionContent2,
      missionChecklist: page.missionChecklist,
      missionImageUrl: page.missionImageUrl,
      missionImageAlt: page.missionImageAlt,
      benefitsEnabled: page.benefitsEnabled,
      contactEnabled: page.contactEnabled,
      contactTitle: page.contactTitle,
      contactEmail: page.contactEmail,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      seoOgImageUrl: page.seoOgImageUrl,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    },
    stats: page.stats.map((s) => ({
      id: s.id,
      label: s.label,
      statType: s.statType,
      staticValue: s.staticValue,
      enabled: s.enabled,
      displayOrder: s.displayOrder,
    })),
    benefits: page.benefits.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      iconKey: b.iconKey,
      enabled: b.enabled,
      displayOrder: b.displayOrder,
    })),
    dynamicStats,
  }
}

// ---------------------------------------------------------------------------
// Seed / reconciliation (idempotent)
// ---------------------------------------------------------------------------

type AboutStatSeed = { label: string; statType: AboutStatType; staticValue?: string | null; enabled: boolean; displayOrder: number }
type AboutBenefitSeed = { title: string; description: string; iconKey: string; enabled: boolean; displayOrder: number }

type AboutPageWithRelations = Prisma.AboutPageGetPayload<{ include: { stats: true; benefits: true } }>

// Creates the singleton AboutPage and its default stats/benefits, seeded to
// replicate the current public /about content. Idempotent: if the row already
// exists it is returned unchanged, so running seed again does NOT overwrite
// admin customizations.
export async function seedAboutPage(): Promise<AboutPageWithRelations> {
  const existing = await prisma.aboutPage.findUnique({
    where: { id: ABOUT_PAGE_ID },
    include: { stats: true, benefits: true },
  })
  if (existing) return existing

  const heroEyebrow = 'Trusted since 2018'
  const heroTitle = 'Connecting Home Buyers with Trusted Mortgage Experts'
  const heroDescription =
    'HomeLoanMarket is America\u2019s premier platform that bridges the gap between mortgage borrowers ' +
    'and verified mortgage originators. We simplify the complex mortgage process by providing ' +
    'transparent access to expert guidance, competitive rates, and seamless service.'
  const missionTitle = 'Our Mission'
  const missionContent =
    'Our mission is to democratize access to home financing in the United States. We believe every ' +
    'homebuyer deserves expert guidance, transparent pricing, and a seamless experience from ' +
    'application to approval.'
  const missionContent2 =
    'By connecting borrowers with verified and rated mortgage professionals, we ensure that the ' +
    'mortgage process is efficient, trustworthy, and tailored to each individual\u2019s unique ' +
    'financial situation.'
  const contactTitle = 'Contact'

  const stats: AboutStatSeed[] = [
    // Dynamic stats below resolve to REAL counts from the broker database.
    // The previous page hardcoded fabricated numbers (5,000+, 15,000+,
    // 4.9/5) which have been replaced with measurable, DB-backed values.
    { label: 'Mortgage Originators', statType: 'DYNAMIC_ORIGINATORS', enabled: true, displayOrder: 10 },
    { label: 'States Served', statType: 'DYNAMIC_STATES', enabled: true, displayOrder: 20 },
    { label: 'Cities Served', statType: 'DYNAMIC_CITIES', enabled: true, displayOrder: 30 },
  ]

  const benefits: AboutBenefitSeed[] = [
    { title: 'Verified Mortgage Originators', description: 'All mortgage originators are verified and rated by clients', iconKey: 'Users', enabled: true, displayOrder: 10 },
    { title: 'Transparent Rates', description: 'Compare rates across trusted lending partners', iconKey: 'TrendingUp', enabled: true, displayOrder: 20 },
    { title: 'Secure Process', description: 'Bank-grade encryption protecting your data', iconKey: 'Shield', enabled: true, displayOrder: 30 },
    { title: 'Expert Network', description: 'Access to the industry\u2019s top mortgage experts', iconKey: 'Award', enabled: true, displayOrder: 40 },
  ]

  try {
    const created = await prisma.$transaction(async (tx) => {
      const page = await tx.aboutPage.create({
        data: {
          id: ABOUT_PAGE_ID,
          heroEnabled: true,
          heroEyebrow,
          heroTitle,
          heroDescription,
          statsEnabled: true,
          missionEnabled: true,
          missionTitle,
          missionContent,
          missionContent2,
          missionChecklist: ['Licensed Mortgage Partners'],
          benefitsEnabled: true,
          contactEnabled: true,
          contactTitle,
          contactEmail: 'support@homeloanmarket.com',
          seoTitle: 'About Us',
          seoDescription: 'HomeLoanMarket is a mortgage marketplace connecting home buyers with verified mortgage originators across the United States.',
          stats: { create: stats },
          benefits: { create: benefits },
        },
        include: { stats: true, benefits: true },
      })
      return page
    })
    return created
  } catch (error: unknown) {
    // Handle race condition: another request may have created the singleton
    // between our findUnique and create. Prisma throws P2002 for unique
    // constraint violations on MongoDB.
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: string }).code : null
    if (code === 'P2002') {
      const retry = await prisma.aboutPage.findUnique({
        where: { id: ABOUT_PAGE_ID },
        include: { stats: true, benefits: true },
      })
      if (retry) return retry
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Public read (react-cached for one query per request)
// ---------------------------------------------------------------------------

export type AboutPublicSection = {
  hero: { enabled: boolean; eyebrow: string | null; title: string | null; description: string | null; imageUrl: string | null; imageAlt: string | null } | null
  stats: { enabled: boolean; items: AboutPublicStat[] } | null
  mission: { enabled: boolean; title: string | null; content: string | null; content2: string | null; checklist: string[]; imageUrl: string | null; imageAlt: string | null } | null
  benefits: { enabled: boolean; items: Array<{ title: string; description: string; iconKey: string }> } | null
  contact: { enabled: boolean; title: string | null; email: string | null } | null
}

export const getAboutPublicData = cache(async function getAboutPublicData() {
  const found = await prisma.aboutPage.findUnique({
    where: { id: ABOUT_PAGE_ID },
    include: {
      stats: { orderBy: { displayOrder: 'asc' } },
      benefits: { orderBy: { displayOrder: 'asc' } },
    },
  })
  const page = found ? found : await seedAboutPage()

  if (!page.isActive) {
    return { active: false, sections: null }
  }

  const statItems = page.statsEnabled ? await resolveAboutStats(page.stats) : []

  const sections: AboutPublicSection = {
    hero: page.heroEnabled
      ? {
          enabled: true,
          eyebrow: page.heroEyebrow,
          title: page.heroTitle,
          description: page.heroDescription,
          imageUrl: page.heroImageUrl,
          imageAlt: page.heroImageAlt,
        }
      : null,
    stats: page.statsEnabled ? { enabled: true, items: statItems } : null,
    mission: page.missionEnabled
      ? {
          enabled: true,
          title: page.missionTitle,
          content: page.missionContent,
          content2: page.missionContent2,
          checklist: page.missionChecklist,
          imageUrl: page.missionImageUrl,
          imageAlt: page.missionImageAlt,
        }
      : null,
    benefits: page.benefitsEnabled
      ? {
          enabled: true,
          items: page.benefits
            .filter((b) => b.enabled)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((b) => ({ title: b.title, description: b.description, iconKey: b.iconKey })),
        }
      : null,
    contact: page.contactEnabled
      ? { enabled: true, title: page.contactTitle, email: page.contactEmail }
      : null,
  }
  return { active: true, sections }
})

// SEO metadata for the public About page. Reflects CMS-managed fields.
export const getAboutSeo = cache(async function getAboutSeo() {
  const page = await prisma.aboutPage.findUnique({
    where: { id: ABOUT_PAGE_ID },
    select: {
      seoTitle: true,
      seoDescription: true,
      seoOgImageUrl: true,
    },
  })
  if (page) {
    const settings = await getSiteSettings()
    return {
      title: page.seoTitle || 'About Us',
      description: page.seoDescription || settings.siteDescription,
      ogImage: page.seoOgImageUrl,
    }
  }
  return {
    title: 'About Us',
    description: 'HomeLoanMarket is a mortgage marketplace connecting home buyers with verified mortgage originators across the United States.',
    ogImage: null,
  }
})
