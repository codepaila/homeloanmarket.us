import { getSiteSettings } from '@/lib/site/settings'
import { ContactPageClient } from './ContactPageClient'

export default async function ContactPage() {
  const settings = await getSiteSettings()
  return <ContactPageClient settings={settings} />
}
