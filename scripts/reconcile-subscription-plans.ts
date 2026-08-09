import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const brokerFilter = process.argv.find((arg) => arg.startsWith('--broker='))?.slice('--broker='.length)

async function main() {
  const records = await prisma.brokerSubscription.findMany({
    where: { plan: 'PREMIUM', ...(brokerFilter ? { brokerId: brokerFilter } : {}) },
    include: { broker: { select: { id: true, profileSlug: true, displayName: true, companyName: true, userId: true, featuredRank: true, brokerStatus: true, verificationStatus: true, isVisible: true } } },
    orderBy: { brokerId: 'asc' },
  })

  const unresolved = records.filter((record) => record.stripeCustomerId || record.stripeSubId)
  if (unresolved.length > 0) throw new Error(`Refusing migration: ${unresolved.length} PREMIUM record(s) contain Stripe identifiers and require provider reconciliation`)

  const plan = records.map((record) => ({
    subscriptionId: record.id,
    brokerId: record.brokerId,
    slug: record.broker.profileSlug,
    name: record.broker.companyName || record.broker.displayName,
    oldPlan: record.plan,
    newPlan: 'FREE',
    evidence: 'No Stripe customer/subscription identifiers; legacy seeded PREMIUM designation',
    ownership: record.broker.userId ? 'OWNED' : 'UNOWNED',
    brokerStatus: record.broker.brokerStatus,
    featuredRank: record.broker.featuredRank,
    verificationStatus: record.broker.verificationStatus,
    isVisible: record.broker.isVisible,
  }))

  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', count: plan.length, records: plan }, null, 2))
  if (!apply || plan.length === 0) return

  await prisma.$transaction(async (tx) => {
    for (const record of plan) {
      await tx.brokerSubscription.update({
        where: { id: record.subscriptionId },
        data: { plan: 'FREE' },
      })
    }
  })
  console.log(JSON.stringify({ status: 'APPLIED', migrated: plan.length }))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Subscription reconciliation failed')
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
