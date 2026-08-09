'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft,
  Pencil,
  Copy,
  Archive,
  Trash2,
  ExternalLink,
  Calendar,
  Monitor,
  Smartphone,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SectionHeader } from '@/components/admin/ads/SectionHeader'
import { AdvertisementStatusBadge, getAdStatus } from '@/components/admin/ads/AdvertisementStatusBadge'
import { PlacementBadge } from '@/components/admin/ads/PlacementBadge'
import { PriorityBadge } from '@/components/admin/ads/PriorityBadge'
import { useAdminAd } from '@/hooks/useAdminAds'
import { EmptyState } from '@/components/design/EmptyState'
import { PlacementGuide } from '@/components/admin/ads/PlacementGuide'
import { PlacementSpecs } from '@/components/admin/ads/PlacementSpecs'
import { ActivityTimeline } from '@/components/admin/ads/ActivityTimeline'
import { PublishReadinessChecklist } from '@/components/admin/ads/PublishReadinessChecklist'
import { ArchiveDialog } from '@/components/admin/ads/ArchiveDialog'
import { DuplicateDialog } from '@/components/admin/ads/DuplicateDialog'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { MediaAsset } from '@/lib/advertisements/types'
import type { AdvertisementFormat } from '@/lib/advertisements/formats'
import { ADVERTISEMENT_FORMAT_INFO, getPlacementFormats } from '@/lib/advertisements/formats'
import { getAdvertisementLayout } from '@/components/advertisements/ad-layout'

interface PreviewAdPageProps {
  params: Promise<{ id: string }>
}

const PREVIEW_BACKGROUNDS = [
  { id: 'home-light', label: 'Home (Light)', bg: 'bg-white' },
  { id: 'home-dark', label: 'Home (Dark)', bg: 'bg-slate-900' },
  { id: 'broker-light', label: 'Broker (Light)', bg: 'bg-gray-50' },
  { id: 'broker-dark', label: 'Broker (Dark)', bg: 'bg-slate-800' },
  { id: 'footer-light', label: 'Footer (Light)', bg: 'bg-gray-100' },
  { id: 'footer-dark', label: 'Footer (Dark)', bg: 'bg-gray-900' },
]

type PreviewBackground = typeof PREVIEW_BACKGROUNDS[number]

export default function PreviewAdPage({ params }: PreviewAdPageProps) {
  const router = useRouter()
  const { id } = use(params)
  const { ad, metrics, isLoading, error, mutate } = useAdminAd(id)
  const [previewFormat, setPreviewFormat] = useState<AdvertisementFormat>('HORIZONTAL')
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>(PREVIEW_BACKGROUNDS[0])
  const [previewZoom, setPreviewZoom] = useState<number>(100)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handlePublish = async () => {
    if (!ad?.id) return
    try {
      const response = await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      toast.success('Advertisement published')
      mutate()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish')
    }
  }

  const handleDelete = async () => {
    if (!ad?.id) return
    try {
      const response = await fetch(`/api/admin/ads/${ad.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      toast.success('Advertisement deleted')
      router.push('/admin/ads/list')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Preview Advertisement" description="Loading preview..." backHref="/admin/ads/list" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !ad) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Preview Advertisement" description="Advertisement not found" backHref="/admin/ads/list" />
        <EmptyState
          title="Advertisement not found"
          description={error?.message || 'The advertisement you are trying to preview does not exist or has been deleted.'}
          action={
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />
      </div>
    )
  }

  const status = getAdStatus(ad)
  const desktopMedia = ad.desktopMedia as MediaAsset | undefined
  const mobileMedia = ad.mobileMedia as MediaAsset | undefined
  const availableFormats = getPlacementFormats(ad.placement)
  const activePreviewFormat = availableFormats.includes(previewFormat) ? previewFormat : availableFormats[0]

  const getPreviewMedia = (device: 'desktop' | 'mobile') => {
    const assigned = ad.creatives?.find((creative: { format: AdvertisementFormat }) => creative.format === activePreviewFormat)?.mediaAsset
    if (assigned) return assigned as MediaAsset
    return (device === 'mobile' ? mobileMedia || desktopMedia : desktopMedia || mobileMedia)
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Preview Advertisement" description={`Read-only preview of "${ad.title}"`} backHref="/admin/ads/list" />

      {/* Sticky Actions Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border -mx-6 px-6 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm font-medium">Preview Mode</Badge>
            <AdvertisementStatusBadge status={status} />
            <PlacementBadge placement={ad.placement} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/ads/${ad.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {!ad.isEnabled && !ad.isArchived && (
              <Button size="sm" onClick={handlePublish}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
            {ad.isEnabled && !ad.isArchived && (
              <Button variant="outline" size="sm" onClick={() => setShowArchiveDialog(true)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowDuplicateDialog(true)}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview Area */}
        <div className="lg:col-span-2 space-y-6">
          <PlacementGuide placement={ad.placement} />
          <PlacementSpecs placement={ad.placement} />

          <Card>
            <CardHeader>
              <CardTitle>Advertisement Preview</CardTitle>
              <CardDescription>
                This is how the advertisement will appear to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Desktop & Mobile Side-by-Side on Desktop */}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-xs font-medium text-text-muted">Creative format:</span>
                  {availableFormats.map((format) => (
                    <Button key={format} type="button" variant={activePreviewFormat === format ? 'default' : 'outline'} size="sm" onClick={() => setPreviewFormat(format)}>
                      {ADVERTISEMENT_FORMAT_INFO[format].label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Desktop Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Desktop Preview</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">Desktop</Badge>
                    </div>
                    <div className={cn('border border-border rounded-lg overflow-hidden transition-all', previewBackground.bg)}>
                      <div className="p-4" style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}>
                        <PlacementPreviewRenderer
                          placement={ad.placement}
                           media={getPreviewMedia('desktop')}
                          bannerUrl={ad.bannerUrl}
                          title={ad.title}
                          buttonLabel={ad.buttonLabel}
                          action={ad.action}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tablet Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Tablet Preview</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">Tablet</Badge>
                    </div>
                    <div className={cn('border border-border rounded-lg overflow-hidden transition-all', previewBackground.bg)}>
                      <div className="p-4 max-w-[420px] mx-auto" style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}>
                        <PlacementPreviewRenderer
                          placement={ad.placement}
                          media={getPreviewMedia('desktop')}
                          bannerUrl={ad.bannerUrl}
                          title={ad.title}
                          buttonLabel={ad.buttonLabel}
                          action={ad.action}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mobile Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Mobile Preview</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">Mobile</Badge>
                    </div>
                    <div className={cn('border border-border rounded-lg overflow-hidden transition-all', previewBackground.bg)}>
                      <div className="p-4 max-w-[280px] mx-auto" style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}>
                        <PlacementPreviewRenderer
                          placement={ad.placement}
                           media={getPreviewMedia('mobile')}
                          bannerUrl={ad.bannerUrl}
                          title={ad.title}
                          buttonLabel={ad.buttonLabel}
                          action={ad.action}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Background:</span>
                    <select
                      value={previewBackground.id}
                      onChange={(e) => setPreviewBackground(PREVIEW_BACKGROUNDS.find(b => b.id === e.target.value) || PREVIEW_BACKGROUNDS[0])}
                      className="text-xs border border-border rounded-md px-2 py-1 bg-background"
                    >
                      {PREVIEW_BACKGROUNDS.map(bg => (
                        <option key={bg.id} value={bg.id}>{bg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 border border-border rounded-md">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewZoom(z => Math.max(50, z - 25))}><ZoomOut className="h-3 w-3" /></Button>
                    <span className="text-xs px-2 py-1 border-x border-border flex items-center min-w-[3rem] justify-center">{previewZoom}%</span>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewZoom(z => Math.min(100, z + 25))}><ZoomIn className="h-3 w-3" /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewZoom(100)} title="Fit width"><Maximize className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <ActivityTimeline advertisement={ad} metrics={metrics} />
            <PublishReadinessChecklist advertisement={ad} />

            <Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Placement" value={<PlacementBadge placement={ad.placement} />} />
                <Separator />
                <DetailRow label="Type" value={<Badge variant="outline">{ad.type.replace(/_/g, ' ')}</Badge>} />
                <Separator />
                <DetailRow label="Priority" value={<PriorityBadge priority={ad.priority} />} />
                <Separator />
                <DetailRow label="Status" value={<AdvertisementStatusBadge status={status} />} />
                <Separator />
                <DetailRow label="Action" value={<Badge variant="outline">{ad.action.replace(/_/g, ' ')}</Badge>} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {ad.startDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-text-muted" />
                    <div>
                      <p className="text-xs text-text-muted">Start Date</p>
                      <p className="text-sm font-medium">{format(new Date(ad.startDate), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
                {ad.endDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-text-muted" />
                    <div>
                      <p className="text-xs text-text-muted">End Date</p>
                      <p className="text-sm font-medium">{format(new Date(ad.endDate), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
                {!ad.startDate && !ad.endDate && (
                  <p className="text-sm text-text-muted">No schedule set</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Archive Dialog */}
      <ArchiveDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        adId={ad.id}
        adTitle={ad.title}
        onSuccess={() => mutate()}
      />

      {/* Duplicate Dialog */}
      <DuplicateDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        adId={ad.id}
        onSuccess={() => router.push('/admin/ads/list')}
      />

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Advertisement</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete &quot;{ad.title}&quot; and all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-muted">{label}</span>
      <div className="flex items-center">{value}</div>
    </div>
  )
}

function PlacementPreviewRenderer({
  placement,
  media,
  bannerUrl,
  title,
  buttonLabel,
  action,
}: {
  placement: string
  media: MediaAsset | undefined
  bannerUrl: string | null | undefined
  title: string
  buttonLabel: string | null | undefined
  action: string
}) {
  if (!placement) {
    return (
      <div className="aspect-video rounded-md border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <ImageIcon className="h-8 w-8 text-text-muted mx-auto mb-1" />
          <p className="text-xs text-text-muted">Select a placement to preview</p>
        </div>
      </div>
    )
  }

  const imageUrl = media?.fileUrl || bannerUrl || undefined
  const layout = getAdvertisementLayout(placement)

  if (!imageUrl && !title) {
    return (
      <div className="aspect-video rounded-md border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <ImageIcon className="h-8 w-8 text-text-muted mx-auto mb-1" />
          <p className="text-xs text-text-muted">No media selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full overflow-hidden rounded-md bg-muted', layout.slotClassName)}>
      {imageUrl ? <img src={imageUrl} alt={title || 'Preview'} className="h-full w-full object-contain" /> : null}
      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-3 pt-8 text-white">
        <p className="line-clamp-2 text-xs font-semibold">{title || 'Advertisement preview'}</p>
        {buttonLabel && (action === 'BUTTON_ONLY' || action === 'BANNER_AND_BUTTON') ? <span className="mt-2 inline-flex rounded bg-primary px-2 py-1 text-xs">{buttonLabel}</span> : null}
      </div>
    </div>
  )
}
