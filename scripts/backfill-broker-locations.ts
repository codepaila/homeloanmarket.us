import 'dotenv/config'
import prisma from '@/lib/prisma'
import { geocodeUSAddress } from '@/lib/location/google-place'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const brokers = await prisma.broker.findMany({
    where: { location: { equals: null } },
    select: { id: true, officeAddress: true, city: true, state: true, pinCode: true },
    orderBy: { id: 'asc' },
  })
  let updated = 0
  let failed = 0
  for (const broker of brokers) {
    try {
      const location = await geocodeUSAddress(`${broker.officeAddress}, ${broker.city}, ${broker.state} ${broker.pinCode}, USA`)
      await prisma.broker.update({
        where: { id: broker.id },
        data: {
          normalizedAddress: location.normalizedAddress,
          googlePlaceId: location.placeId,
          locationCountryCode: location.countryCode,
          location: { type: 'Point', coordinates: [location.longitude, location.latitude] },
        },
      })
      updated += 1
      console.info('Broker location backfilled', { brokerId: broker.id })
    } catch (error) {
      failed += 1
      console.error('Broker location backfill failed', { brokerId: broker.id, error: error instanceof Error ? error.message : 'Unknown error' })
    }
    await delay(100)
  }
  console.info('Broker location backfill complete', { inspected: brokers.length, updated, failed })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
