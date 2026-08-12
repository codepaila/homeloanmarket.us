import React from 'react'
import Header from './Header'
import Footer from './Footer'
import type { SiteSettings } from '@/lib/site/settings'

function PublicLayout({ children, settings }: { children: React.ReactNode; settings?: SiteSettings }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header settings={settings} />
      <main className="flex-1">
        {children}
      </main>
      <Footer settings={settings} />
    </div>
  )
}

export default PublicLayout
