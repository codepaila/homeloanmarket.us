'use client'

import { useSyncExternalStore } from 'react'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { AdvertisementWizard } from '@/components/admin/ads/AdvertisementWizard'

export default function NewAdPage() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="New Advertisement"
          description="Create a new advertisement"
          backHref="/admin/ads/list"
        />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="New Advertisement"
        description="Choose a placement and the system will show only the configuration that applies."
        backHref="/admin/ads/list"
      />
      <AdvertisementWizard />
    </div>
  )
}
