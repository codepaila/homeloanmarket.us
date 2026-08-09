import PublicLayout from '@/components/layout'
import { AdvertisementRenderer } from '@/components/advertisements'
import { getSiteSettings } from '@/lib/site/settings'
import React from 'react'

async function layout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

  return (
    <PublicLayout settings={settings}>
      {children}
      <AdvertisementRenderer placement="ANNOUNCEMENT_BOTTOM" />
    </PublicLayout>
  )
}

export default layout
