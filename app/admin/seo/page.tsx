import type { Metadata } from 'next'
import { getSiteSettings } from '@/lib/site/settings'
import { SeoForm } from '@/components/admin/seo/SeoForm'

export const metadata: Metadata = {
  title: 'SEO',
}

export default async function AdminSeoPage() {
  const settings = await getSiteSettings()
  return <SeoForm settings={settings} />
}
