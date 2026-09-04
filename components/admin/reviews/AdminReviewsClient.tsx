'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RatingStars } from '@/components/design/RatingStars'

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

type AdminReview = {
  id: string
  rating: number
  comment: string | null
  status: ReviewStatus
  createdAt: string
  user: { id: string; name: string | null; email: string | null; image: string | null } | null
  broker: { id: string; displayName: string; companyName: string | null; profileSlug: string } | null
}

const TABS: { key: ReviewStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
]

export function AdminReviewsClient() {
  const [tab, setTab] = useState<ReviewStatus | 'ALL'>('PENDING')
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async (status: ReviewStatus | 'ALL') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reviews?status=${status === 'ALL' ? '' : status}&limit=100`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load reviews')
      setReviews(data.reviews || [])
      setTotal(data.total || 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (next: ReviewStatus | 'ALL') => {
    setTab(next)
    void load(next)
  }

  const moderate = async (id: string, action: 'approve' | 'reject') => {
    if (busyId) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to update review')
      toast.success(data.message || (action === 'approve' ? 'Review approved successfully.' : 'Review rejected successfully.'))
      void load(tab)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update review')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={cn('rounded px-3 py-1.5 text-sm font-medium transition-colors', tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">No reviews in this view.</p>
      ) : (
        <div className="divide-y divide-border rounded border border-border">
          {reviews.map((review) => (
            <div key={review.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{review.user?.name || review.user?.email || 'Anonymous'}</p>
                  <p className="text-xs text-muted-foreground">
                    {review.broker ? `${review.broker.displayName}${review.broker.companyName ? ` · ${review.broker.companyName}` : ''}` : 'Unknown broker'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <RatingStars rating={review.rating} totalReviews={0} size="sm" showCount={false} />
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', review.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : review.status === 'REJECTED' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700')}>{review.status}</span>
                </div>
              </div>
              {review.comment && <p className="whitespace-pre-line text-sm text-muted-foreground">{review.comment}</p>}
              {review.status !== 'APPROVED' && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busyId === review.id} onClick={() => moderate(review.id, 'approve')} className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                    {busyId === review.id && <Loader2 className="h-3 w-3 animate-spin" />}Approve
                  </button>
                  {review.status !== 'REJECTED' && (
                    <button type="button" disabled={busyId === review.id} onClick={() => moderate(review.id, 'reject')} className="rounded border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50">Reject</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
