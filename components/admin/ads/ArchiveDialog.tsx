'use client'

import { motion } from 'motion/react'
import { Archive, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useArchiveAdvertisement, useToast } from '@/hooks/useAdminAds'

interface ArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adId: string | null
  adTitle: string | null
  onSuccess?: () => void
}

export function ArchiveDialog({ open, onOpenChange, adId, adTitle, onSuccess }: ArchiveDialogProps) {
  const archive = useArchiveAdvertisement()
  const { toast } = useToast()

  const handleArchive = async () => {
    if (!adId) return

    try {
      await archive.mutateAsync(adId)
      toast({
        title: 'Advertisement archived',
        description: `"${adTitle}" has been moved to archive.`,
      })
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast({
        title: 'Failed to archive',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-600" />
            Archive Advertisement
          </DialogTitle>
          <DialogDescription>
            You are about to archive &quot;{adTitle}&quot;. This action can be reversed later.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <p className="text-sm font-medium">What happens when you archive?</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                The advertisement will be removed from all public pages immediately
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                All data, settings, and media references will be preserved
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                Statistics (impressions, clicks) will be retained
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                You can restore this advertisement at any time from the archive
              </li>
            </ul>
          </div>

          <Separator />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={archive.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleArchive}
              disabled={archive.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {archive.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Archive className="h-4 w-4 mr-2" />
              Archive Advertisement
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
