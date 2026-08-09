'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useAdvertisement, useDuplicateAdvertisement, useToast } from '@/hooks/useAdminAds'

const DuplicateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  copyImages: z.boolean().optional(),
  copySchedule: z.boolean().optional(),
  copyPriority: z.boolean().optional(),
  copyStatus: z.boolean().optional(),
  copyButtonSettings: z.boolean().optional(),
  generateNewSlug: z.boolean().optional(),
})

type DuplicateFormData = z.infer<typeof DuplicateSchema>

interface DuplicateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adId: string | null
  onSuccess?: () => void
}

export function DuplicateDialog({ open, onOpenChange, adId, onSuccess }: DuplicateDialogProps) {
  const { data: ad, isLoading } = useAdvertisement(adId)
  const duplicate = useDuplicateAdvertisement()
  const { toast } = useToast()

  const form = useForm<DuplicateFormData>({
    resolver: zodResolver(DuplicateSchema),
    defaultValues: {
      title: '',
      copyImages: true,
      copySchedule: false,
      copyPriority: true,
      copyStatus: false,
      copyButtonSettings: true,
      generateNewSlug: true,
    },
  })

  const onSubmit = async (data: DuplicateFormData) => {
    if (!adId) return

    try {
      await duplicate.mutateAsync({
        id: adId,
        title: data.title,
        copyImages: data.copyImages,
        copySchedule: data.copySchedule,
        copyPriority: data.copyPriority,
        copyStatus: data.copyStatus,
        copyButtonSettings: data.copyButtonSettings,
      })

      toast({
        title: 'Advertisement duplicated',
        description: `"${data.title}" has been created.`,
      })

      onOpenChange(false)
      form.reset()
      onSuccess?.()
    } catch {
      toast({
        title: 'Failed to duplicate',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const defaultTitle = ad?.title ? `${ad.title} (Copy)` : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Duplicate Advertisement
          </DialogTitle>
          <DialogDescription>
            Create a copy of this advertisement with custom options.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">New Title</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder={defaultTitle}
                className={form.formState.errors.title ? 'border-destructive' : ''}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Copy Settings</p>

              <ToggleRow
                label="Images"
                description="Copy desktop and mobile media"
                checked={!!form.watch('copyImages')}
                onCheckedChange={(checked) => form.setValue('copyImages', checked)}
              />

              <ToggleRow
                label="Schedule"
                description="Copy start and end dates"
                checked={!!form.watch('copySchedule')}
                onCheckedChange={(checked) => form.setValue('copySchedule', checked)}
              />

              <ToggleRow
                label="Priority"
                description="Copy priority and display order"
                checked={!!form.watch('copyPriority')}
                onCheckedChange={(checked) => form.setValue('copyPriority', checked)}
              />

              <ToggleRow
                label="Status"
                description="Copy enabled/archived status"
                checked={!!form.watch('copyStatus')}
                onCheckedChange={(checked) => form.setValue('copyStatus', checked)}
              />

              <ToggleRow
                label="Button Settings"
                description="Copy button label, URL, and variant"
                checked={!!form.watch('copyButtonSettings')}
                onCheckedChange={(checked) => form.setValue('copyButtonSettings', checked)}
              />

              <ToggleRow
                label="Generate New Slug"
                description="Create a new slug from the title"
                checked={!!form.watch('generateNewSlug')}
                onCheckedChange={(checked) => form.setValue('generateNewSlug', checked)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={duplicate.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={duplicate.isPending}>
                {duplicate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function ToggleRow({ label, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
