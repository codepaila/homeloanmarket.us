import 'dotenv/config'
import prisma from '@/lib/prisma'
import { resolveBrokerLocation, locationHasValidCoordinates } from '@/lib/location/broker-location'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function main() {
  const brokers = await prisma.broker.findMany({
    select: { id: true, officeAddress: true, city: true, state: true, pinCode: true, location: true },
    orderBy: { id: 'asc' },
  })

  let alreadyLocated = 0
  let attempted = 0
  let resolved = 0
  let failed = 0
  let skipped = 0

  for (const broker of brokers) {
    if (locationHasValidCoordinates(broker.location)) {
      alreadyLocated += 1
      continue
    }
    const address = [broker.officeAddress, broker.city, broker.state, broker.pinCode].filter(Boolean).join(', ')
    if (!address) {
      skipped += 1
      continue
    }
    attempted += 1
    console.info('[LOCATION] resolving broker address', { brokerId: broker.id })
    const patch = await resolveBrokerLocation({ officeAddress: broker.officeAddress, city: broker.city, state: broker.state, pinCode: broker.pinCode })
    if (patch) {
      await prisma.broker.update({
        where: { id: broker.id },
        data: {
          normalizedAddress: patch.normalizedAddress,
          googlePlaceId: patch.googlePlaceId,
          locationCountryCode: patch.locationCountryCode,
          location: patch.location,
        },
      })
      resolved += 1
      console.info('[LOCATION] broker location persisted', { brokerId: broker.id })
    } else {
      failed += 1
    }
    await delay(120)
  }

  const total = brokers.length
  const coverage = total > 0 ? ((alreadyLocated + resolved) / total) * 100 : 0
  console.info('[LOCATION] backfill completed', { total, alreadyLocated, attempted, resolved, failed, skipped, coverage })
  console.info(`Broker location backfill\n\nTotal: ${total}\nAlready located: ${alreadyLocated}\nAttempted geocoding: ${attempted}\nResolved: ${resolved}\nFailed: ${failed}\nSkipped: ${skipped}\nCoverage: ${coverage.toFixed(1)}%`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
