import { BrokerStatus, VerificationStatus } from '@prisma/client'
import prisma from '@/lib/prisma'

export type GrowthPoint = {
  key: string
  value: number
}

export type ActivityItem = {
  kind: 'USER' | 'BROKER' | 'CONTACT' | 'CLAIM' | 'ADVERTISEMENT'
  title: string
  detail: string
  date: string
}

export type AdminOverview = {
  totalUsers: number
  totalBrokers: number
  activeBrokers: number
  totalProfileViews: number
  activeSubscriptions: number
  featuredSubscriptions: number
  freeSubscriptions: number
  activeAdvertisements: number
  adImpressions: number
  adClicks: number
  adCtr: number | null
  pendingClaims: number
  recentContacts: number
  publishedFaqs: number
  draftFaqs: number
}

export type RecentUser = {
  name: string | null
  email: string | null
  role: string
  createdAt: string
}

export type RecentBroker = {
  displayName: string
  companyName: string | null
  city: string | null
  state: string | null
  brokerStatus: string
  createdAt: string
}

export type RecentContact = {
  name: string
  email: string | null
  city: string | null
  brokerName: string | null
  createdAt: string
}

export type RecentClaim = {
  brokerName: string | null
  status: string
  createdAt: string
}

export type RecentAdvertisement = {
  title: string
  placement: string
  isEnabled: boolean
  createdAt: string
}

export type TopAdvertisement = {
  id: string
  title: string
  placement: string
  impressions: number
  clicks: number
  ctr: number | null
}

export type AdminDashboardData = {
  overview: AdminOverview
  userGrowth: GrowthPoint[]
  brokerGrowth: GrowthPoint[]
  subscriptionGrowth: GrowthPoint[]
  featuredGrowth: GrowthPoint[]
  profileViews: {
    total: number
    top: { slug: string; displayName: string; views: number }[]
  }
  revenue: null
  adEngagement: {
    keys: string[]
    impressions: number[]
    clicks: number[]
    totalImpressions: number
    totalClicks: number
    ctr: number | null
  }
  topAdvertisements: TopAdvertisement[]
  recent: {
    users: RecentUser[]
    brokers: RecentBroker[]
    contacts: RecentContact[]
    claims: RecentClaim[]
    advertisements: RecentAdvertisement[]
  }
  activity: ActivityItem[]
  generatedAt: string
}

function startOfUtcDay(date: Date) {
  const value = new Date(date)
  value.setUTCHours(0, 0, 0, 0)
  return value
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function lastMonths(months: number) {
  const now = new Date()
  const result: string[] = []
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
  for (let index = 0; index < months; index++) {
    result.push(monthKey(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return result
}

function bucketByMonth(dates: Date[], months: number): GrowthPoint[] {
  const keys = lastMonths(months)
  const counts = new Map<string, number>(keys.map((key) => [key, 0]))
  for (const date of dates) {
    const key = monthKey(date)
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1)
  }
  return keys.map((key) => ({ key, value: counts.get(key) || 0 }))
}

function startOfWindow(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const since30 = startOfWindow(30)
  const since7 = startOfWindow(7)
  const now = new Date()

  const [totalUsers, totalBrokers, activeBrokers, profileViews, subscriptions, advertisements, adImpressions, adClicks, pendingClaims, recentContacts, publishedFaqs, draftFaqs] = await Promise.all([
    prisma.user.count(),
    prisma.broker.count(),
    prisma.broker.count({
      where: {
        isVisible: true,
        verificationStatus: VerificationStatus.VERIFIED,
        brokerStatus: { not: BrokerStatus.SUSPENDED },
        OR: [{ userId: null }, { user: { is: { isActive: true } } }],
      },
    }),
    prisma.broker.aggregate({ _sum: { profileViews: true } }),
    prisma.brokerSubscription.findMany({ select: { plan: true, isActive: true, endDate: true } }),
    prisma.advertisement.findMany({
      select: { isEnabled: true, isArchived: true, isDeleted: true, startDate: true, endDate: true },
    }),
    prisma.adEvent.count({ where: { eventType: 'IMPRESSION', createdAt: { gte: since30 } } }),
    prisma.adEvent.count({ where: { eventType: 'CLICK', createdAt: { gte: since30 } } }),
    prisma.brokerClaim.count({ where: { status: { in: ['INVITED', 'IN_PROGRESS'] } } }),
    prisma.contactMessage.count({ where: { createdAt: { gte: since7 } } }),
    prisma.fAQ.count({ where: { isActive: true } }),
    prisma.fAQ.count({ where: { isActive: false } }),
  ])

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.isActive).length
  const featuredSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.plan === 'FEATURED' &&
      subscription.isActive &&
      (!subscription.endDate || subscription.endDate > now),
  ).length
  const freeSubscriptions = subscriptions.filter(
    (subscription) => subscription.plan === 'FREE' && subscription.isActive,
  ).length
  const activeAdvertisements = advertisements.filter(
    (advertisement) =>
      advertisement.isEnabled &&
      !advertisement.isArchived &&
      !advertisement.isDeleted &&
      (!advertisement.startDate || advertisement.startDate <= now) &&
      (!advertisement.endDate || advertisement.endDate > now),
  ).length

  return {
    totalUsers,
    totalBrokers,
    activeBrokers,
    totalProfileViews: profileViews._sum.profileViews || 0,
    activeSubscriptions,
    featuredSubscriptions,
    freeSubscriptions,
    activeAdvertisements,
    adImpressions,
    adClicks,
    adCtr: adImpressions > 0 ? Number(((adClicks / adImpressions) * 100).toFixed(2)) : null,
    pendingClaims,
    recentContacts,
    publishedFaqs,
    draftFaqs,
  }
}

export async function getPlatformGrowth(months = 12) {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1))
  const [users, brokers] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.broker.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
  ])
  return {
    userGrowth: bucketByMonth(users.map((user) => user.createdAt), months),
    brokerGrowth: bucketByMonth(brokers.map((broker) => broker.createdAt), months),
  }
}

export async function getSubscriptionGrowth(months = 12) {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1))
  const subscriptions = await prisma.brokerSubscription.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, plan: true },
  })
  const all = bucketByMonth(subscriptions.map((subscription) => subscription.createdAt), months)
  const featured = bucketByMonth(
    subscriptions.filter((subscription) => subscription.plan === 'FEATURED').map((subscription) => subscription.createdAt),
    months,
  )
  return { subscriptionGrowth: all, featuredGrowth: featured }
}

export async function getProfileViewAnalytics() {
  const brokers = await prisma.broker.findMany({
    select: { profileSlug: true, displayName: true, profileViews: true },
    orderBy: { profileViews: 'desc' },
    take: 10,
  })
  return {
    total: brokers.reduce((sum, broker) => sum + broker.profileViews, 0),
    top: brokers.map((broker) => ({ slug: broker.profileSlug, displayName: broker.displayName, views: broker.profileViews })),
  }
}

export async function getAdvertisementAnalytics(days = 30) {
  const since = startOfWindow(days)
  const events = await prisma.adEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { eventType: true, createdAt: true },
  })

  const keys: string[] = []
  const cursor = startOfUtcDay(since)
  while (cursor <= startOfUtcDay(new Date())) {
    keys.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  const impressions = new Map<string, number>(keys.map((key) => [key, 0]))
  const clicks = new Map<string, number>(keys.map((key) => [key, 0]))
  for (const event of events) {
    const key = event.createdAt.toISOString().slice(0, 10)
    if (event.eventType === 'IMPRESSION' && impressions.has(key)) impressions.set(key, (impressions.get(key) || 0) + 1)
    if (event.eventType === 'CLICK' && clicks.has(key)) clicks.set(key, (clicks.get(key) || 0) + 1)
  }
  const totalImpressions = [...impressions.values()].reduce((sum, value) => sum + value, 0)
  const totalClicks = [...clicks.values()].reduce((sum, value) => sum + value, 0)
  return {
    keys,
    impressions: keys.map((key) => impressions.get(key) || 0),
    clicks: keys.map((key) => clicks.get(key) || 0),
    totalImpressions,
    totalClicks,
    ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : null,
  }
}

export async function getOperationalActivity(limit = 8): Promise<ActivityItem[]> {
  const since = startOfWindow(7)
  const [users, brokers, contacts, claims, advertisements] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { name: true, email: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.broker.findMany({ where: { createdAt: { gte: since } }, select: { displayName: true, profileSlug: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.contactMessage.findMany({ where: { createdAt: { gte: since } }, select: { name: true, email: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.brokerClaim.findMany({ select: { status: true, createdAt: true, brokerId: true }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.advertisement.findMany({ where: { createdAt: { gte: since } }, select: { title: true, placement: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit }),
  ])

  const items: ActivityItem[] = []
  for (const user of users) items.push({ kind: 'USER', title: user.name || 'New user', detail: user.email || '', date: user.createdAt.toISOString() })
  for (const broker of brokers) items.push({ kind: 'BROKER', title: broker.displayName, detail: broker.profileSlug, date: broker.createdAt.toISOString() })
  for (const contact of contacts) items.push({ kind: 'CONTACT', title: contact.name || 'Inquiry', detail: contact.email || '', date: contact.createdAt.toISOString() })
  for (const claim of claims) items.push({ kind: 'CLAIM', title: `Claim ${claim.status}`, detail: claim.brokerId, date: claim.createdAt.toISOString() })
  for (const advertisement of advertisements) items.push({ kind: 'ADVERTISEMENT', title: advertisement.title, detail: advertisement.placement, date: advertisement.createdAt.toISOString() })

  return items.sort((left, right) => right.date.localeCompare(left.date)).slice(0, limit)
}

export async function getTopAdvertisements(limit = 6): Promise<TopAdvertisement[]> {
  const advertisements = await prisma.advertisement.findMany({
    where: { isEnabled: true, isArchived: false, isDeleted: false },
    select: { id: true, title: true, placement: true },
    take: 50,
  })
  if (advertisements.length === 0) return []

  const counts = await prisma.adEvent.groupBy({
    by: ['advertisementId', 'eventType'],
    _count: { _all: true },
  })
  const byAdvertisement = new Map<string, { impressions: number; clicks: number }>()
  for (const advertisement of advertisements) byAdvertisement.set(advertisement.id, { impressions: 0, clicks: 0 })
  for (const row of counts) {
    const current = byAdvertisement.get(row.advertisementId)
    if (!current) continue
    if (row.eventType === 'IMPRESSION') current.impressions += row._count._all
    if (row.eventType === 'CLICK') current.clicks += row._count._all
  }

  return advertisements
    .map((advertisement) => {
      const countsForAd = byAdvertisement.get(advertisement.id) || { impressions: 0, clicks: 0 }
      return {
        id: advertisement.id,
        title: advertisement.title,
        placement: advertisement.placement,
        impressions: countsForAd.impressions,
        clicks: countsForAd.clicks,
        ctr: countsForAd.impressions > 0 ? Number(((countsForAd.clicks / countsForAd.impressions) * 100).toFixed(2)) : null,
      }
    })
    .sort((left, right) => right.impressions - left.impressions)
    .slice(0, limit)
}

export async function getRecentUsers(limit = 10): Promise<RecentUser[]> {
  const users = await prisma.user.findMany({ select: { name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit })
  return users.map((user) => ({ name: user.name, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() }))
}

export async function getRecentBrokers(limit = 10): Promise<RecentBroker[]> {
  const brokers = await prisma.broker.findMany({ select: { displayName: true, companyName: true, city: true, state: true, brokerStatus: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit })
  return brokers.map((broker) => ({ displayName: broker.displayName, companyName: broker.companyName, city: broker.city, state: broker.state, brokerStatus: broker.brokerStatus, createdAt: broker.createdAt.toISOString() }))
}

export async function getRecentContacts(limit = 10): Promise<RecentContact[]> {
  const contacts = await prisma.contactMessage.findMany({ select: { name: true, email: true, city: true, createdAt: true, broker: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' }, take: limit })
  return contacts.map((contact) => ({ name: contact.name, email: contact.email, city: contact.city, brokerName: contact.broker.displayName, createdAt: contact.createdAt.toISOString() }))
}

export async function getRecentClaims(limit = 10): Promise<RecentClaim[]> {
  const claims = await prisma.brokerClaim.findMany({ select: { status: true, createdAt: true, broker: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' }, take: limit })
  return claims.map((claim) => ({ brokerName: claim.broker.displayName, status: claim.status, createdAt: claim.createdAt.toISOString() }))
}

export async function getRecentAdvertisements(limit = 10): Promise<RecentAdvertisement[]> {
  const advertisements = await prisma.advertisement.findMany({ select: { title: true, placement: true, isEnabled: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: limit })
  return advertisements.map((advertisement) => ({ title: advertisement.title, placement: advertisement.placement, isEnabled: advertisement.isEnabled, createdAt: advertisement.createdAt.toISOString() }))
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [overview, platformGrowth, subscriptionGrowth, profileViews, adEngagement, activity, topAdvertisements, recentUsers, recentBrokers, recentContacts, recentClaims, recentAdvertisements] = await Promise.all([
    getAdminOverview(),
    getPlatformGrowth(),
    getSubscriptionGrowth(),
    getProfileViewAnalytics(),
    getAdvertisementAnalytics(),
    getOperationalActivity(),
    getTopAdvertisements(),
    getRecentUsers(),
    getRecentBrokers(),
    getRecentContacts(),
    getRecentClaims(),
    getRecentAdvertisements(),
  ])

  return {
    overview,
    userGrowth: platformGrowth.userGrowth,
    brokerGrowth: platformGrowth.brokerGrowth,
    subscriptionGrowth: subscriptionGrowth.subscriptionGrowth,
    featuredGrowth: subscriptionGrowth.featuredGrowth,
    profileViews,
    revenue: null,
    adEngagement,
    topAdvertisements,
    recent: {
      users: recentUsers,
      brokers: recentBrokers,
      contacts: recentContacts,
      claims: recentClaims,
      advertisements: recentAdvertisements,
    },
    activity,
    generatedAt: new Date().toISOString(),
  }
}
