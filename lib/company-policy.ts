import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/currentUser'

export async function getCurrentCompany() {
  const user = await getCurrentUser()
  if (!user || !user.isActive) return null
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: user.id, isActive: true, company: { status: { not: 'SUSPENDED' } } },
    include: { company: { include: { subscription: true } } },
  })
  return membership ? { user, membership, company: membership.company } : null
}
