import 'dotenv/config'
import prisma from '@/lib/prisma'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const baseWhere = {
    creationSource: 'ADMIN_CREATED' as const,
    userId: null,
    brokerStatus: { not: 'SUSPENDED' as const },
  }

  const total = await prisma.broker.count()
  const adminCreated = await prisma.broker.count({ where: { creationSource: 'ADMIN_CREATED' } })
  const unverifiedCandidates = await prisma.broker.count({ where: { ...baseWhere, verificationStatus: 'UNVERIFIED' } })
  const hiddenVerifiedCandidates = await prisma.broker.count({ where: { ...baseWhere, verificationStatus: 'VERIFIED', isVisible: false } })
  const alreadyCorrect = await prisma.broker.count({ where: { ...baseWhere, verificationStatus: 'VERIFIED', isVisible: true } })
  const excludedSuspended = await prisma.broker.count({ where: { creationSource: 'ADMIN_CREATED', userId: null, brokerStatus: 'SUSPENDED' } })
  const owned = await prisma.broker.count({ where: { creationSource: 'ADMIN_CREATED', userId: { not: null } } })

  const report = {
    total,
    adminCreated,
    unverifiedCandidates,
    hiddenVerifiedCandidates,
    alreadyCorrect,
    excludedSuspended,
    owned,
  }

  if (dryRun) {
    console.info('[BACKFILL] dry-run', report)
    console.info(`Broker admin visibility backfill (dry-run)\n\nTotal: ${total}\nAdmin-created: ${adminCreated}\nUnverified candidates: ${unverifiedCandidates}\nHidden-but-verified candidates: ${hiddenVerifiedCandidates}\nAlready correct: ${alreadyCorrect}\nExcluded (suspended): ${excludedSuspended}\nOwned (skipped): ${owned}`)
    return
  }

  const promoted = await prisma.broker.updateMany({
    where: { ...baseWhere, verificationStatus: 'UNVERIFIED' },
    data: { verificationStatus: 'VERIFIED', verifiedAt: new Date(), isVisible: true },
  })
  const revealed = await prisma.broker.updateMany({
    where: { ...baseWhere, verificationStatus: 'VERIFIED', isVisible: false },
    data: { isVisible: true },
  })

  console.info('[BACKFILL] complete', { ...report, promoted: promoted.count, revealed: revealed.count })
  console.info(`Broker admin visibility backfill\n\nTotal: ${total}\nAdmin-created: ${adminCreated}\nPromoted to VERIFIED: ${promoted.count}\nRevealed to visible: ${revealed.count}\nAlready correct: ${alreadyCorrect}\nExcluded (suspended): ${excludedSuspended}\nOwned (skipped): ${owned}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
