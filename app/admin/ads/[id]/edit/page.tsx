'use client'

import { use } from 'react'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { AdvertisementForm } from '@/components/admin/ads/AdvertisementForm'
import { useAdminAd } from '@/hooks/useAdminAds'
import { EmptyState } from '@/components/design/EmptyState'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface EditAdPageProps {
  params: Promise<{ id: string }>
}

export default function EditAdPage({ params }: EditAdPageProps) {
  const { id } = use(params)
  const { ad, isLoading, error, mutate, requestContext } = useAdminAd(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Edit Advertisement"
          description="Loading advertisement data..."
          backHref="/admin/ads/list"
        />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !ad) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Edit Advertisement"
          description="Advertisement not found"
          backHref="/admin/ads/list"
        />
        <EmptyState
          title="Advertisement not found"
          description={error?.message || 'The advertisement you are trying to edit does not exist or has been deleted.'}
          action={
            <Link href="/admin/ads/list">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to List
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Edit Advertisement"
        description={`Editing: ${ad.title}`}
        backHref="/admin/ads/list"
      />

      <AdvertisementForm
        mode="edit"
        ad={ad}
        requestContext={requestContext}
        onSuccess={() => {
          mutate()
        }}
      />
    </div>
  )
}
