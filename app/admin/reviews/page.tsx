import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { AdminReviewsClient } from '@/components/admin/reviews/AdminReviewsClient'

export const metadata = { title: 'Review Moderation | Admin' }

export default function AdminReviewsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Review Moderation"
        description="Approve or reject customer reviews before they appear on broker profiles."
        backHref="/admin"
      />
      <AdminReviewsClient />
    </div>
  )
}
