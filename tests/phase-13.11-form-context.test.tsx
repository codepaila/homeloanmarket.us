import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SessionProvider } from 'next-auth/react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { AdvertisementForm } from '../components/admin/ads/AdvertisementForm'
import type { Advertisement } from '../lib/advertisements/types'

const mockRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => Promise.resolve(),
  fastRefresh: () => Promise.resolve(),
}

function renderForm(children: React.ReactNode) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={mockRouter as never}>
      <SessionProvider>{children}</SessionProvider>
    </AppRouterContext.Provider>,
  )
}

test('AdvertisementForm create mode renders without useFormContext error', () => {
  const html = renderForm(<AdvertisementForm mode="create" />)
  assert.ok(html.includes('New Advertisement'))
  assert.ok(html.includes('Advertisement Information'))
})

test('AdvertisementForm edit mode renders with ISO-string dates without useFormContext error', () => {
  const ad = {
    id: 'ad-1',
    title: 'Test Banner',
    slug: 'test-banner',
    description: 'desc',
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
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
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
  } as unknown as Advertisement

  const html = renderForm(<AdvertisementForm mode="edit" ad={ad} />)
  assert.ok(html.includes('Edit Advertisement'))
  assert.ok(html.includes('Test Banner'))
})

