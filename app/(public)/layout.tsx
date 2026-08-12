import PublicLayout from '@/components/layout'
import { getSiteSettings } from '@/lib/site/settings'
import React from 'react'

async function layout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

  return (
    <PublicLayout settings={settings}>
      {children}
    </PublicLayout>
  )
}

export default layout
