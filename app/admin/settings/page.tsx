import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/site/settings'
import { SiteSettingsForm } from '@/components/admin/settings/SiteSettingsForm'

export const metadata: Metadata = {
  title: 'Site Settings',
}

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings()
  return <SiteSettingsForm settings={settings} />
}
