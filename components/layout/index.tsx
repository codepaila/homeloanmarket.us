import React from 'react'
import Header from './Header'
import Footer from './Footer'
import { AdvertisementRenderer } from '@/components/advertisements'
import type { SiteSettings } from '@/lib/site/settings'

function PublicLayout({ children, settings }: { children: React.ReactNode; settings?: SiteSettings }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="announcement-bar mx-1">
        <AdvertisementRenderer placement="ANNOUNCEMENT_TOP" />
      </div>
      <Header settings={settings} />
      <main className="flex-1">
        {children}
      </main>
      <Footer settings={settings} />
      <AdvertisementRenderer placement="POPUP_OVERLAY" />
    </div>
  )
}

export default PublicLayout
