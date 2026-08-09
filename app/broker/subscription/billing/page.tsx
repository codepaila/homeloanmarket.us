// app/broker/subscription/billing/page.tsx
'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const BillingHistoryClient = dynamic(
  () => import('@/components/sections/subscriptions/BillingClient'),
  {
    loading: () => (
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    ),
    ssr: false
  }
)

export default function BillingHistoryPage() {
  return <BillingHistoryClient />
}