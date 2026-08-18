'use client'

import { useState } from 'react'
import { Loader2, Star } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STAR_LABELS = ['1 star', '2 stars', '3 stars', '4 stars', '5 stars']

export function BrokerReviewDialog({
  open,
  onOpenChange,
  brokerSlug,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  brokerSlug: string
  onSubmitted: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const displayed = hoverRating || rating

  const reset = () => {
    setRating(0)
    setHoverRating(0)
    setComment('')
    setError('')
  }

  const handleSubmit = async () => {
    if (submitting) return
    if (rating < 1 || rating > 5) {
      setError('Please select a star rating from 1 to 5.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/company/${brokerSlug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to submit your review')
      toast.success('Thank you! Your review has been submitted and is pending admin approval.')
      reset()
      onOpenChange(false)
      onSubmitted()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to submit your review. Please try again.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>Share your experience with this mortgage broker.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-text-main">Your rating</p>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => {
                const active = value <= displayed
                const selected = value === rating
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={STAR_LABELS[value - 1]}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(value)}
                    className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                  >
                    <Star
                      className={cn(
                        'h-8 w-8 transition-colors',
                        active ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40',
                      )}
                    />
                  </button>
                )
              })}
            </div>
            <p aria-live="polite" className="mt-1 text-xs text-text-muted">
              {rating > 0 ? STAR_LABELS[rating - 1] : 'Select a rating'}
            </p>
          </div>

          <div>
            <label htmlFor="review-comment" className="mb-1 block text-sm font-medium text-text-main">
              Your review
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What was your experience like?"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-text-main placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Submitting…' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
