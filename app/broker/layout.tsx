import type { Metadata } from 'next'
import BrokerLayoutClient from '@/components/layout/admin/BrokerLayoutClient'
import { getCurrentUser } from '@/lib/currentUser'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function BrokerLayout({ children }: { children: React.ReactNode }) {
  // Resolve the authenticated broker from the database (the same authoritative
  // source the broker pages use). This keeps the sidebar in lockstep with the
  // rendered page so broker navigation can never be hidden by a stale JWT role.
  const user = await getCurrentUser()
  return <BrokerLayoutClient user={user ?? null}>{children}</BrokerLayoutClient>
}
