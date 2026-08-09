import assert from "node:assert/strict"
import test from "node:test"
import { AdType, AdvertisementAction, AdvertisementPlacement } from "@prisma/client"
import { CreateAdSchema, isSafeAdvertisementUrl } from "../lib/advertisements/validation"

test("advertisement destinations allow relative and HTTP(S) URLs only", () => {
  assert.equal(isSafeAdvertisementUrl("/brokers"), true)
  assert.equal(isSafeAdvertisementUrl("https://example.com/campaign"), true)
  assert.equal(isSafeAdvertisementUrl("http://example.com"), true)
  assert.equal(isSafeAdvertisementUrl("//evil.example/path"), false)
  assert.equal(isSafeAdvertisementUrl("javascript:alert(1)"), false)
  assert.equal(isSafeAdvertisementUrl("data:text/html,unsafe"), false)
})

test("advertisement validation rejects reversed schedules and unsafe URLs", () => {
  const result = CreateAdSchema.safeParse({
    title: "Test banner",
    placement: AdvertisementPlacement.HOMEPAGE_HERO,
    type: AdType.HERO_BANNER,
    action: AdvertisementAction.BANNER_CLICK,
    bannerUrl: "javascript:alert(1)",
    startDate: "2026-08-10T00:00:00.000Z",
    endDate: "2026-08-09T00:00:00.000Z",
  })

  assert.equal(result.success, false)
})
