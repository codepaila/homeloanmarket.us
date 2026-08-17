import assert from 'node:assert/strict'
import test from 'node:test'
import { getAdvertisementRequirements, getValidTypesForPlacement, ACTION_META } from '../lib/advertisements/requirements'

test('creative slots are derived from the placement specification', () => {
  const hero = getAdvertisementRequirements('HOMEPAGE_HERO')
  assert.ok(hero.creativeSlots.some((s) => s.device === 'desktop'), 'hero has a desktop slot')
  assert.ok(hero.creativeSlots.some((s) => s.device === 'mobile'), 'hero has a mobile slot')
  assert.ok(hero.supportsDesktop && hero.supportsMobile)

  const local = getAdvertisementRequirements('BROKER_LISTING_LOCAL')
  assert.equal(local.supportsLocation, true, 'local broker listing supports location targeting')
  assert.equal(local.supportsMobile, false, 'local listing requires a single square creative (no separate mobile slot)')
  assert.ok(local.creativeSlots.some((s) => s.format === 'SQUARE'), 'local listing derives a SQUARE creative slot')
  assert.equal(local.creativeSlots.length, 1, 'local listing needs exactly one creative slot')

  const global = getAdvertisementRequirements('BROKER_LISTING')
  assert.equal(global.supportsLocation, false, 'global broker listing has no location targeting')
})

test('creative requirements include canonical dimensions', () => {
  const local = getAdvertisementRequirements('BROKER_LISTING_LOCAL')
  const square = local.creativeSlots.find((s) => s.format === 'SQUARE')
  assert.ok(square, 'SQUARE slot present')
  assert.equal(square!.width, 800)
  assert.equal(square!.height, 800)
  assert.equal(square!.aspectRatio, '1:1')
})

test('announcement placements disable CTA configuration', () => {
  assert.equal(getAdvertisementRequirements('ANNOUNCEMENT_TOP').supportsCta, false)
  assert.equal(getAdvertisementRequirements('POPUP_OVERLAY').supportsCta, false)
  assert.equal(getAdvertisementRequirements('BROKER_LISTING').supportsCta, true)
})

test('valid advertisement types are derived per placement', () => {
  const popup = getValidTypesForPlacement('POPUP_OVERLAY')
  assert.deepEqual(popup, ['POPUP_CAMPAIGN'])
  const announcement = getValidTypesForPlacement('ANNOUNCEMENT_TOP')
  assert.deepEqual(announcement, ['ANNOUNCEMENT_BAR'])
  const hero = getValidTypesForPlacement('HOMEPAGE_HERO')
  assert.ok(hero.includes('HERO_BANNER'))
  assert.ok(!hero.includes('POPUP_CAMPAIGN'), 'popup type must not be offered on a hero placement')
})

test('action metadata drives CTA field visibility', () => {
  assert.equal(ACTION_META.DISPLAY_ONLY.needsUrl, false)
  assert.equal(ACTION_META.BANNER_CLICK.needsUrl, true)
  assert.equal(ACTION_META.BANNER_CLICK.needsButton, false)
  assert.equal(ACTION_META.BUTTON_ONLY.needsButton, true)
  assert.equal(ACTION_META.BANNER_AND_BUTTON.needsButton, true)
})
