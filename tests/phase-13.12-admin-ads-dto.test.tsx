import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { toISOStringSafe, serializeAdvertisement, formatAdminDate } from '../lib/admin/advertisement-dto'
import { ActivityTimeline } from '../components/admin/ads/ActivityTimeline'

test('toISOStringSafe handles Date, string, null, and invalid inputs', () => {
  const date = new Date('2026-07-31T12:00:00.000Z')
  assert.equal(toISOStringSafe(date), '2026-07-31T12:00:00.000Z')
  assert.equal(toISOStringSafe('2026-07-31T12:00:00.000Z'), '2026-07-31T12:00:00.000Z')
  assert.equal(toISOStringSafe(null), null)
  assert.equal(toISOStringSafe(undefined), null)
  assert.equal(toISOStringSafe('not-a-date'), null)
  assert.equal(toISOStringSafe(new Date('invalid')), null)
})

test('serializeAdvertisement projects dates as ISO strings', () => {
  const now = new Date('2026-08-01T10:00:00.000Z')
  const dto = serializeAdvertisement({
    id: 'ad-1',
    title: 'Test Ad',
    slug: 'test-ad',
    description: 'desc',
    placement: 'BROKER_LISTING',
    type: 'SECTION_BANNER',
    action: 'BANNER_CLICK',
    buttonVariant: 'PRIMARY',
    desktopMediaId: null,
    mobileMediaId: null,
    altText: null,
    bannerUrl: 'https://example.com/banner.png',
    buttonLabel: null,
    buttonUrl: null,
    openInNewTab: true,
    displayOrder: 0,
    priority: 10,
    startDate: null,
    endDate: null,
    isEnabled: true,
    isArchived: false,
    showDesktop: true,
    showTablet: true,
    showMobile: true,
    createdById: 'user-1',
    updatedById: null,
    internalNotes: null,
    isDismissible: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    desktopMedia: null,
    mobileMedia: null,
  })

  assert.equal(dto.createdAt, '2026-08-01T10:00:00.000Z')
  assert.equal(dto.updatedAt, '2026-08-01T10:00:00.000Z')
  assert.equal(dto.startDate, null)
  assert.equal(dto.title, 'Test Ad')
})

test('formatAdminDate is safe for strings, dates, null, and invalid values', () => {
  assert.equal(formatAdminDate(null), '-')
  assert.equal(formatAdminDate(undefined), '-')
  assert.equal(formatAdminDate('garbage'), '-')
  assert.ok(formatAdminDate(new Date('2026-07-31T12:00:00.000Z')).length > 0)
  assert.ok(formatAdminDate('2026-07-31T12:00:00.000Z').length > 0)
})

test('ActivityTimeline renders with ISO-string dates without crashing', () => {
  const advertisement = {
    id: 'ad-1',
    title: 'Test Ad',
    slug: 'test-ad',
    description: null,
    placement: 'BROKER_LISTING',
    type: 'SECTION_BANNER',
    action: 'BANNER_CLICK',
    buttonVariant: 'PRIMARY',
    desktopMediaId: null,
    mobileMediaId: null,
    altText: null,
    bannerUrl: null,
    buttonLabel: null,
    buttonUrl: null,
    openInNewTab: true,
    displayOrder: 0,
    priority: 10,
    startDate: null,
    endDate: null,
    isEnabled: true,
    isArchived: false,
    showDesktop: true,
    showTablet: true,
    showMobile: true,
    createdById: 'user-1',
    updatedById: null,
    internalNotes: null,
    isDismissible: false,
    isDeleted: false,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
  const html = renderToStaticMarkup(<ActivityTimeline advertisement={advertisement as never} />)
  assert.ok(html.includes('Activity'))
  assert.ok(html.includes('Created'))
})

test('ActivityTimeline renders with Date-object advertisement for compatibility', () => {
  const advertisement = {
    id: 'ad-2',
    title: 'Test Ad 2',
    slug: 'test-ad-2',
    description: null,
    placement: 'FOOTER',
    type: 'FOOTER_BANNER',
    action: 'BANNER_CLICK',
    buttonVariant: 'PRIMARY',
    desktopMediaId: null,
    mobileMediaId: null,
    altText: null,
    bannerUrl: null,
    buttonLabel: null,
    buttonUrl: null,
    openInNewTab: true,
    displayOrder: 0,
    priority: 10,
    startDate: null,
    endDate: null,
    isEnabled: false,
    isArchived: true,
    showDesktop: true,
    showTablet: true,
    showMobile: true,
    createdById: 'user-1',
    updatedById: null,
    internalNotes: null,
    isDismissible: false,
    isDeleted: false,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
  }
  const html = renderToStaticMarkup(<ActivityTimeline advertisement={advertisement as never} />)
  assert.ok(html.includes('Created'))
  assert.ok(html.includes('Archived'))
})
