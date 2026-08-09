import type { Metadata } from 'next'
import BrokerLayoutClient from '@/components/layout/admin/BrokerLayoutClient'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function BrokerLayout({ children }: { children: React.ReactNode }) {
  return <BrokerLayoutClient>{children}</BrokerLayoutClient>
}
