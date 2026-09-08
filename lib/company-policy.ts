import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'

export async function getCurrentCompany() {
  const user = await getCurrentUser()
  if (!user || !user.isActive) return null
  // Email verification gate (Phase 8.37.1 F1): an email-registered company user
  // must verify their email before accessing protected company functionality.
  // Google company users are verified-by-construction (emailVerified=true), so
  // this never adds a redundant verification step to the Google path. This is
  // the single server-side company authorization boundary — every company page
  // and API derives its access decision from getCurrentCompany.
  if (!user.emailVerified) return null
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: user.id, isActive: true, company: { status: { not: 'SUSPENDED' } } },
    include: { company: { include: { subscription: { include: { advertisingPlan: true } } } } },
  })
  return membership ? { user, membership, company: membership.company } : null
}
