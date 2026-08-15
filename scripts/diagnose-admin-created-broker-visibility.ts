import 'dotenv/config'
import prisma from '@/lib/prisma'

// Read-only diagnostic for ADMIN_CREATED broker public visibility. This script
// never mutates data — it only reports how existing records map to the new
// eligibility policy so an operator can decide whether a targeted backfill is
// warranted. The public eligibility policy itself no longer requires
// ADMIN_CREATED brokers to be VERIFIED, so unverified admin-created records
// are already public; `isVisible: false` remains a hard-hide flag.

async function count(where: Record<string, unknown>) {
  return prisma.broker.count({ where: where as never })
}

async function main() {
  const [total, adminCreated, selfRegistered, unclassified] = await Promise.all([
    count({}),
    count({ creationSource: 'ADMIN_CREATED' }),
    count({ creationSource: 'SELF_REGISTERED' }),
    count({ creationSource: null }),
  ])

  const adminUnowned = await count({ creationSource: 'ADMIN_CREATED', userId: null })
  const adminOwned = await count({ creationSource: 'ADMIN_CREATED', userId: { not: null } })
  const adminUnownedSuspended = await count({ creationSource: 'ADMIN_CREATED', userId: null, brokerStatus: 'SUSPENDED' })
  const adminUnownedHidden = await count({ creationSource: 'ADMIN_CREATED', userId: null, isVisible: false })
  const adminUnownedVerified = await count({ creationSource: 'ADMIN_CREATED', userId: null, verificationStatus: 'VERIFIED' })
  const adminUnownedUnverified = await count({ creationSource: 'ADMIN_CREATED', userId: null, verificationStatus: 'UNVERIFIED' })
  const adminOwnedSuspended = await count({ creationSource: 'ADMIN_CREATED', userId: { not: null }, brokerStatus: 'SUSPENDED' })

  const report = {
    total,
    adminCreated,
    selfRegistered,
    unclassified,
    adminUnowned,
    adminOwned,
    adminUnownedSuspended,
    adminUnownedHidden,
    adminUnownedVerified,
    adminUnownedUnverified,
    adminOwnedSuspended,
  }

  console.info('[DIAGNOSE] admin-created broker visibility', report)
  console.info([
    'Admin-created broker visibility diagnostic (read-only)',
    '',
    `Total brokers: ${total}`,
    `Admin-created: ${adminCreated}`,
    `Self-registered: ${selfRegistered}`,
    `Unclassified source: ${unclassified}`,
    '',
    'ADMIN_CREATED breakdown:',
    `  Unowned (userId null): ${adminUnowned}`,
    `    - Suspended: ${adminUnownedSuspended}`,
    `    - Hard-hidden (isVisible=false): ${adminUnownedHidden}`,
    `    - Verified: ${adminUnownedVerified}`,
    `    - Unverified: ${adminUnownedUnverified}`,
    `  Owned (userId set): ${adminOwned}`,
    `    - Suspended: ${adminOwnedSuspended}`,
    '',
    'Notes:',
    '  - The public eligibility policy exposes ADMIN_CREATED brokers regardless',
    '    of verificationStatus (they are platform-published), so unverified',
    '    admin-created records are already publicly visible.',
    '  - isVisible=false remains a hard-hide; suspended records remain hidden.',
    '  - No data was modified by this script.',
  ].join('\n'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
