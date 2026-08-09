'use client'

import { useState, useEffect } from 'react'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { AdvertisementForm } from '@/components/admin/ads/AdvertisementForm'

export default function NewAdPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="New Advertisement"
          description="Create a new advertisement campaign"
          backHref="/admin/ads/list"
        />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="New Advertisement"
        description="Create a new advertisement campaign"
        backHref="/admin/ads/list"
      />

      <AdvertisementForm
        mode="create"
        onSuccess={() => {
          // Navigation handled by form
        }}
      />
    </div>
  )
}
