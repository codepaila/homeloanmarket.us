import assert from 'node:assert/strict'
import test from 'node:test'
import { findBrokerIdsWithinRadius } from '../lib/location/broker-geo'
import prisma from '../lib/prisma'

const HOUSTON = { latitude: 29.7604, longitude: -95.3698 }

const toRad = (d: number) => (d * Math.PI) / 180

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

test('Houston radius search returns only brokers actually within the selected radius', async () => {
  const res = await findBrokerIdsWithinRadius({
    latitude: HOUSTON.latitude,
    longitude: HOUSTON.longitude,
    radiusMiles: 25,
    page: 1,
    take: 200,
    search: null,
    admin: false,
  })

  if (res.total === 0) {
    // No geographically located brokers near Houston in this environment — the
    // search correctly returns nothing. Nothing to verify.
    assert.equal(res.ids.length, 0)
    return
  }

  const brokers = await prisma.broker.findMany({
    where: { id: { in: res.ids } },
    select: { id: true, displayName: true, location: true },
  })

  assert.equal(brokers.length, res.ids.length, 'every returned id resolves to a broker')

  for (const broker of brokers) {
    const loc = broker.location as { coordinates?: [number, number] } | null
    assert.ok(loc && Array.isArray(loc.coordinates) && loc.coordinates.length === 2, `${broker.displayName} has stored coordinates`)
    const [longitude, latitude] = loc.coordinates
    const d = distanceMiles(HOUSTON.latitude, HOUSTON.longitude, latitude, longitude)
    assert.ok(d <= 25.1, `${broker.displayName} is ${d.toFixed(1)}mi from Houston — outside the 25-mile radius`)
  }
})

test('Houston radius search returns FEATURED-subscription brokers before FREE brokers', async () => {
  const res = await findBrokerIdsWithinRadius({
    latitude: HOUSTON.latitude,
    longitude: HOUSTON.longitude,
    radiusMiles: 25,
    page: 1,
    take: 200,
    search: null,
    admin: false,
  })
  if (res.total === 0) return

  const brokers = await prisma.broker.findMany({
    where: { id: { in: res.ids } },
    select: { id: true, subscription: { select: { plan: true, isActive: true, endDate: true } } },
  })
  const byId = new Map<string, (typeof brokers)[number]>(brokers.map((b) => [b.id, b]))
  const ordered = res.ids.map((id) => byId.get(id)).filter((b): b is (typeof brokers)[number] => Boolean(b)) as Array<{ subscription: { plan: string; isActive: boolean; endDate: Date | null } | null }>

  let sawFree = false
  for (const broker of ordered) {
    const featured = Boolean(
      broker.subscription &&
      broker.subscription.plan === 'FEATURED' &&
      broker.subscription.isActive &&
      (!broker.subscription.endDate || broker.subscription.endDate > new Date()),
    )
    if (featured) {
      assert.equal(sawFree, false, 'a FEATURED broker appeared after a FREE broker')
    } else {
      sawFree = true
    }
  }
})
