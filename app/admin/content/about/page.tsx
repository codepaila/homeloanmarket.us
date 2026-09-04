import { Metadata } from 'next'
import { getAboutAdminData } from '@/lib/about/about'
import { AboutAdminForm } from '@/components/admin/about/AboutAdminForm'

export const metadata: Metadata = {
  title: 'About Page',
}

export default async function AboutContentAdminPage() {
  const data = await getAboutAdminData()
  return (
    <div className="space-y-6">
      <AboutAdminForm data={data} />
    </div>
  )
}
