/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { toast } from 'react-hot-toast'
import {
  Save,
  Copy,
  Archive,
  Trash2,
  Monitor,
  Smartphone,
  ImageIcon,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize,
  ArrowLeft,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MediaSelector } from '@/components/admin/media/MediaSelector'
import { PlacementGuide } from './PlacementGuide'
import { PlacementSpecs } from './PlacementSpecs'
import { PlacementPicker } from './PlacementPicker'
import { ImageValidationPanel } from './ImageValidationPanel'
import { getPlacementInfo } from './placementPreviews'
import { ImageMetadataPanel } from './ImageMetadataPanel'
import { PublishReadinessChecklist } from './PublishReadinessChecklist'
import { ActivityTimeline } from './ActivityTimeline'
import { DuplicateDialog } from './DuplicateDialog'
import { ArchiveDialog } from './ArchiveDialog'
import { useMediaAssets } from '@/hooks/useAdminAds'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useSession } from 'next-auth/react'
import type { Advertisement, MediaAsset } from '@/lib/advertisements/types'
import { CreateAdSchema, UpdateAdSchema } from '@/lib/advertisements/validation'
import type { CreateAdInput, UpdateAdInput } from '@/lib/advertisements/validation'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getPlacementFormats, isFormatCompatible, type AdvertisementFormat } from '@/lib/advertisements/formats'
import { getPlacementSpec, getRequiredDimensions, getDisplayHeight } from '@/lib/advertisements/placementSpecs'
import { getValidTypesForPlacement, getCreativeRequirementForFormat, AD_TYPE_LABELS } from '@/lib/advertisements/requirements'
import { OwnerSelector } from '@/components/admin/ads/OwnerSelector'
import type { AdvertisementOwner, AdvertisementRequestContext } from '@/lib/advertisements/types'
import { getAdvertisementLayout } from '@/components/advertisements/ad-layout'
import { USLocationPicker } from '@/components/location/USLocationPicker'
import { TargetRadiusControl } from '@/components/admin/ads/TargetRadiusControl'
import type { AdType } from '@prisma/client'

type FormMode = 'create' | 'edit'

type CreativeAssignmentState = {
  mediaAssetId: string
  format: AdvertisementFormat
  asset?: MediaAsset
}

interface AdvertisementFormProps {
  mode: FormMode
  ad?: Advertisement | null
  onSuccess?: (ad: Advertisement) => void
  onCancel?: () => void
  /** When creating an advertisement from a company request, pre-link the ad to
   * this company and pre-fill the location target from the request. */
  companyId?: string
  requestId?: string
  /** Server-derived context when this advertisement is linked to a fulfilled
   * company request. Ownership is locked and cannot be changed in edit. */
  requestContext?: AdvertisementRequestContext
  initialLocationTarget?: CreateAdInput['locationTarget']
}

const ACTION_OPTIONS = [
  { value: 'DISPLAY_ONLY', label: 'Display Only', needsButton: false, needsUrl: false },
  { value: 'BANNER_CLICK', label: 'Banner Click', needsButton: false, needsUrl: true },
  { value: 'BUTTON_ONLY', label: 'Button Only', needsButton: true, needsUrl: true },
  { value: 'BANNER_AND_BUTTON', label: 'Banner + Button', needsButton: true, needsUrl: true },
]

const BUTTON_VARIANT_OPTIONS = [
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'SECONDARY', label: 'Secondary' },
  { value: 'OUTLINE', label: 'Outline' },
  { value: 'GHOST', label: 'Ghost' },
]

const DRAFT_STORAGE_KEY = 'hm_advertisement_draft'

const PREVIEW_BACKGROUNDS = [
  { id: 'home-light', label: 'Home (Light)', bg: 'bg-white' },
  { id: 'home-dark', label: 'Home (Dark)', bg: 'bg-slate-900' },
  { id: 'broker-light', label: 'Broker (Light)', bg: 'bg-gray-50' },
  { id: 'broker-dark', label: 'Broker (Dark)', bg: 'bg-slate-800' },
  { id: 'footer-light', label: 'Footer (Light)', bg: 'bg-gray-100' },
  { id: 'footer-dark', label: 'Footer (Dark)', bg: 'bg-gray-900' },
]

type PreviewBackground = typeof PREVIEW_BACKGROUNDS[number]

export function AdvertisementForm({ mode, ad, onSuccess, onCancel, companyId, requestId, requestContext, initialLocationTarget }: AdvertisementFormProps) {
  const router = useRouter()
  const user = useCurrentUser()
  const { status: sessionStatus } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [owner, setOwner] = useState<AdvertisementOwner>(() => {
    const currentCompanyId = ad?.companyId || companyId || null
    return currentCompanyId ? { type: 'COMPANY', companyId: currentCompanyId } : { type: 'PLATFORM', companyId: null }
  })
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>(PREVIEW_BACKGROUNDS[0])
  const [previewZoom, setPreviewZoom] = useState<number>(100)
  const [activeTab, setActiveTab] = useState('basic')
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const isEditMode = mode === 'edit'
  const [creativeAssignments, setCreativeAssignments] = useState<CreativeAssignmentState[]>(() => {
    if (ad?.creatives?.length) return ad.creatives.map((creative) => ({ mediaAssetId: creative.mediaAssetId, format: creative.format, asset: creative.mediaAsset || undefined }))
    const placementFormats = getPlacementFormats(ad?.placement || '')
    const primaryFormat = placementFormats[0] || ('HORIZONTAL' as AdvertisementFormat)
    const supportsMobile = placementFormats.includes('MOBILE')
    const assignments: CreativeAssignmentState[] = []
    if (ad?.desktopMediaId) assignments.push({ mediaAssetId: ad.desktopMediaId, format: primaryFormat })
    if (ad?.mobileMediaId && supportsMobile) assignments.push({ mediaAssetId: ad.mobileMediaId, format: 'MOBILE' })
    if (ad?.mobileMediaId && !supportsMobile && !ad?.desktopMediaId) assignments.push({ mediaAssetId: ad.mobileMediaId, format: primaryFormat })
    return assignments
  })

  // Progressive creative editing: only ONE format is shown at a time. When the
  // placement supports a single format it is auto-selected.
  const [selectedCreativeFormat, setSelectedCreativeFormat] = useState<AdvertisementFormat | null>(() => {
    const placementFormats = getPlacementFormats(ad?.placement || '')
    if (placementFormats.length === 1) return placementFormats[0]
    return creativeAssignments[0]?.format || placementFormats[0] || null
  })

  const createResolver = zodResolver(CreateAdSchema)
  const updateResolver = zodResolver(UpdateAdSchema)

  const form = useForm<CreateAdInput | UpdateAdInput>({
    resolver: isEditMode ? updateResolver as any : createResolver as any,
    defaultValues: {
      title: ad?.title || '',
      slug: ad?.slug || '',
      description: ad?.description || '',
      placement: ad?.placement || undefined,
      type: ad?.type || undefined,
      action: ad?.action || 'DISPLAY_ONLY',
      buttonVariant: ad?.buttonVariant || 'PRIMARY',
      desktopMediaId: ad?.desktopMediaId || undefined,
      mobileMediaId: ad?.mobileMediaId || undefined,
      altText: ad?.altText || '',
      bannerUrl: ad?.bannerUrl || '',
      buttonLabel: ad?.buttonLabel || '',
      buttonUrl: ad?.buttonUrl || '',
      openInNewTab: ad?.openInNewTab ?? true,
      displayOrder: ad?.displayOrder ?? 0,
      priority: ad?.priority ?? 10,
      startDate: ad?.startDate ? new Date(ad.startDate) : undefined,
      endDate: ad?.endDate ? new Date(ad.endDate) : undefined,
      isEnabled: ad?.isEnabled ?? false,
      isArchived: ad?.isArchived ?? false,
      showDesktop: ad?.showDesktop ?? true,
      showTablet: ad?.showTablet ?? true,
      showMobile: ad?.showMobile ?? true,
      internalNotes: ad?.internalNotes || '',
      isDismissible: ad?.isDismissible ?? false,
      locationTarget: ad?.locationTarget || initialLocationTarget,
      companyId: ad?.companyId || companyId,
      creativeAssignments: creativeAssignments.map(({ mediaAssetId, format }) => ({ mediaAssetId, format })),
    } as any,
  })

  const watchAction = form.watch('action')
  const watchTitle = form.watch('title')
  const watchDescription = form.watch('description')
  const watchBannerUrl = form.watch('bannerUrl')
  const watchButtonLabel = form.watch('buttonLabel')
  const watchPlacement = form.watch('placement')
  const watchLocationTarget = form.watch('locationTarget') as any

  const needsButton = useMemo(() => watchAction === 'BUTTON_ONLY' || watchAction === 'BANNER_AND_BUTTON', [watchAction])

  const { assets: mediaAssets } = useMediaAssets({ limit: 50 })

  // Preview / validation panels consume the assigned creatives so they always
  // reflect what is currently assigned, not a separate legacy media field.
  const desktopMedia = useMemo(() => {
    const assignment = creativeAssignments.find((a) => a.format !== 'MOBILE') || creativeAssignments[0]
    if (!assignment) return undefined
    return assignment.asset || mediaAssets.find((a: MediaAsset) => a.id === assignment.mediaAssetId)
  }, [creativeAssignments, mediaAssets])
  const mobileMedia = useMemo(() => {
    const assignment = creativeAssignments.find((a) => a.format === 'MOBILE') || creativeAssignments[0]
    if (!assignment) return undefined
    return assignment.asset || mediaAssets.find((a: MediaAsset) => a.id === assignment.mediaAssetId)
  }, [creativeAssignments, mediaAssets])

  // When the placement changes, reset the active creative format and
  // auto-select the single supported format when applicable.
  useEffect(() => {
    const placementFormats = getPlacementFormats(watchPlacement || '')
    setSelectedCreativeFormat((current) => {
      if (placementFormats.length === 1) return placementFormats[0]
      return current && placementFormats.includes(current) ? current : placementFormats[0] || null
    })
  }, [watchPlacement])

  // Only the advertisement types valid for the selected placement are shown.
  // If a single type is valid it is selected automatically.
  useEffect(() => {
    const valid = getValidTypesForPlacement(watchPlacement || '')
    const current = form.getValues('type')
    if (valid.length === 1 && current !== valid[0]) {
      form.setValue('type', valid[0], { shouldDirty: false })
    } else if (valid.length > 1 && current && !valid.includes(current as AdType)) {
      form.setValue('type', valid[0], { shouldDirty: false })
    }
  }, [watchPlacement, form])

  const dirtyFields = useMemo(() => {
    const fields = form.formState.dirtyFields
    const changed: string[] = []
    if (fields.title) changed.push('Title')
    if (fields.placement) changed.push('Placement')
    if (fields.type) changed.push('Type')
    if (fields.action) changed.push('Action')
    if (fields.desktopMediaId) changed.push('Desktop Image')
    if (fields.mobileMediaId) changed.push('Mobile Image')
    if (fields.buttonLabel) changed.push('Button Label')
    if (fields.priority) changed.push('Priority')
    if (fields.startDate) changed.push('Start Date')
    if (fields.endDate) changed.push('End Date')
    return changed
  }, [form.formState.dirtyFields])

  // Draft handling
  useEffect(() => {
    if (!isEditMode && !ad) {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
        if (saved) {
          const draft = JSON.parse(saved)
          if (draft.timestamp && Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) setShowDraftPrompt(true)
        }
      } catch {
        // ignore
      }
    }
  }, [isEditMode, ad])

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        form.reset(draft.data)
        toast.success('Draft restored')
        setShowDraftPrompt(false)
      }
    } catch {
      toast.error('Failed to restore draft')
    }
  }, [form])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
    setShowDraftPrompt(false)
  }, [])

  // Auto-save draft
  useEffect(() => {
    if (!isEditMode && form.formState.isDirty) {
      const timeout = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ data: form.getValues(), timestamp: Date.now() }))
        } catch {
          // ignore
        }
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [isEditMode, form.formState.isDirty, form.getValues])

  // Unsaved changes protection
  useEffect(() => {
    const currentDirty = form.formState.isDirty
    setIsDirty(currentDirty)
    if (!currentDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [form.formState.isDirty])

  // Auto-generate slug
  useEffect(() => {
    if (!isEditMode && watchTitle) {
      const slug = watchTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      form.setValue('slug', slug, { shouldDirty: false })
    }
  }, [watchTitle, isEditMode, form])

  const onSubmit = useCallback(async (data: CreateAdInput | UpdateAdInput) => {
    if (sessionStatus === 'loading') {
      toast.error('Sign-in session is loading. Please try again.')
      return
    }
    if (sessionStatus !== 'authenticated' || !user?.id) {
      toast.error('You must be logged in')
      return
    }
    setIsSubmitting(true)
    try {
      const url = isEditMode && ad ? `/api/admin/ads/${ad.id}` : '/api/admin/ads'
      const method = isEditMode ? 'PUT' : 'POST'
      const assignments = creativeAssignments.filter((assignment) => isFormatCompatible(watchPlacement || '', assignment.format)).map(({ mediaAssetId, format }) => ({ mediaAssetId, format }))
      const desktopFallback = assignments.find((assignment) => assignment.format !== 'MOBILE')?.mediaAssetId || assignments[0]?.mediaAssetId || ''
      const mobileFallback = assignments.find((assignment) => assignment.format === 'MOBILE')?.mediaAssetId || desktopFallback
      const payloadData = {
        ...data,
        creativeAssignments: assignments,
        desktopMediaId: desktopFallback,
        mobileMediaId: mobileFallback,
        companyId: requestContext ? requestContext.companyId : (owner.type === 'COMPANY' ? owner.companyId : null),
        ...(requestId ? { requestId } : {}),
      }
      const payload = isEditMode ? payloadData : { ...payloadData, createdById: user.id }
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} advertisement`)
      toast.success(`Advertisement ${isEditMode ? 'updated' : 'created'} successfully`)
      clearDraft()
      form.reset(data)
      // When created from a company request, link the ad to the request and
      // mark it FULFILLED so the audit trail is complete.
      if (!isEditMode && requestId && result.ad?.id) {
        try {
          await fetch(`/api/admin/company-ad-requests/${requestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ advertisementId: result.ad.id, status: 'FULFILLED' }),
          })
        } catch {
          // Linking is best-effort; the advertisement itself was created.
        }
      }
      onSuccess?.(result.ad)
      router.push('/admin/ads/list')
      router.refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [user, sessionStatus, isEditMode, ad, form, onSuccess, router, clearDraft, creativeAssignments, watchPlacement, requestId, owner, requestContext])

  const availableCreativeFormats = getPlacementFormats(watchPlacement || '')
  const updateCreative = useCallback((format: AdvertisementFormat, asset: MediaAsset | null) => {
    setCreativeAssignments((current) => {
      const next = current.filter((assignment) => assignment.format !== format)
      if (asset) next.push({ mediaAssetId: asset.id, format, asset })
      form.setValue('creativeAssignments', next.map(({ mediaAssetId, format: assignmentFormat }) => ({ mediaAssetId, format: assignmentFormat })), { shouldDirty: true })
      if (format === 'HORIZONTAL') form.setValue('desktopMediaId', asset?.id || '', { shouldDirty: true })
      if (format === 'MOBILE') form.setValue('mobileMediaId', asset?.id || '', { shouldDirty: true })
      return next
    })
  }, [form])

  const handleDelete = useCallback(async () => {
    if (!ad?.id) return
    try {
      const response = await fetch(`/api/admin/ads/${ad.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      toast.success('Advertisement deleted')
      router.push('/admin/ads/list')
      router.refresh()
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Failed to delete') }
  }, [ad, router])

  if (showDraftPrompt) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Unsaved Draft Found</CardTitle><CardDescription>You have an unsaved advertisement draft from a previous session.</CardDescription></CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={restoreDraft}>Restore Draft</Button>
            <Button variant="outline" onClick={clearDraft}>Start Fresh</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)}>
        {/* Sticky Preview Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border -mx-6 px-6 py-3 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              {onCancel && (
                <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Edit Advertisement' : 'New Advertisement'}</h1>
                <p className="text-xs text-muted-foreground">{isEditMode ? `Editing: ${ad?.title}` : 'Create a new advertisement campaign'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isEditMode && ad && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDuplicateDialog(true)}><Copy className="mr-2 h-4 w-4" />Duplicate</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowArchiveDialog(true)}><Archive className="mr-2 h-4 w-4" />Archive</Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                </>
              )}
              <Button type="button" variant="outline" size="sm" onClick={onCancel || (() => router.back())}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || sessionStatus === 'loading'} size="sm">
                {isSubmitting ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />Saving...</> : <><Save className="mr-2 h-4 w-4" />{isEditMode ? 'Update' : 'Create'}</>}
              </Button>
            </div>
          </div>
          {isDirty && dirtyFields.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 flex items-center gap-2 text-xs text-amber-600"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Unsaved changes: {dirtyFields.join(', ')}</span>
            </motion.div>
          )}
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="type">Type & Placement</TabsTrigger>
                <TabsTrigger value="display">Display</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
              </TabsList>

              {/* Basic Info */}
              <TabsContent value="basic" className="space-y-6 mt-6">
                <Card>
                  <CardHeader><CardTitle>Advertisement Information</CardTitle><CardDescription>Basic information about your advertisement</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="e.g., Summer Home Loan Special" {...field} value={field.value ?? ''} maxLength={200} /></FormControl><FormDescription>Optional · {field.value?.length || 0}/200 characters</FormDescription><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="slug" render={({ field }) => (
                      <FormItem><FormLabel>Slug</FormLabel><FormControl><Input placeholder="auto-generated-from-title" {...field} disabled={isEditMode} /></FormControl><FormDescription>{isEditMode ? 'Slug cannot be changed after creation' : 'Auto-generated from title'}</FormDescription><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe this advertisement..." {...field} value={field.value || ''} maxLength={1000} /></FormControl><FormDescription>{(field.value || '').length}/1000 characters</FormDescription><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="internalNotes" render={({ field }) => (
                      <FormItem><FormLabel>Internal Notes</FormLabel><FormControl><Textarea placeholder="Admin-only notes..." {...field} value={field.value || ''} maxLength={500} /></FormControl><FormDescription>{(field.value || '').length}/500 characters</FormDescription><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>

                {watchPlacement === 'BROKER_LISTING_LOCAL' && (
                  <Card>
                    <CardHeader><CardTitle>US Location Target</CardTitle><CardDescription>Local broker-listing resources are shown only within this validated target radius.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="locationTarget" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <USLocationPicker
                              value={field.value ? { ...field.value, normalizedAddress: field.value.locationLabel } as any : undefined}
                              onChange={(location) => field.onChange(location ? {
                                locationLabel: location.normalizedAddress,
                                countryCode: 'US',
                                city: location.city,
                                state: location.state,
                                zip: location.zip,
                                googlePlaceId: location.placeId,
                                latitude: location.latitude,
                                longitude: location.longitude,
                                radiusMiles: field.value?.radiusMiles || 25,
                              } : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="locationTarget" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target radius (miles)</FormLabel>
                          <FormControl>
                            <TargetRadiusControl
                              value={field.value?.radiusMiles || 25}
                              onChange={(radiusMiles) => field.onChange(field.value ? { ...field.value, radiusMiles } : { locationLabel: '', countryCode: 'US', latitude: 0, longitude: 0, radiusMiles })}
                              locationLabel={field.value?.locationLabel}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      {watchLocationTarget && <p className="text-xs text-muted-foreground">Coordinates are resolved and validated server-side from the selected Google place.</p>}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader><CardTitle>Status</CardTitle><CardDescription>Control whether this advertisement is active</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    <FormField control={form.control} name="isEnabled" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded border p-4">
                        <div className="space-y-0.5"><FormLabel>Enabled</FormLabel><FormDescription>When enabled, this advertisement is active and visible</FormDescription></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="isArchived" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded border p-4">
                        <div className="space-y-0.5"><FormLabel>Archived</FormLabel><FormDescription>Archived advertisements are hidden from all placements</FormDescription></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="isDismissible" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded border p-4">
                        <div className="space-y-0.5"><FormLabel>Dismissible</FormLabel><FormDescription>Allow users to close this advertisement</FormDescription></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Schedule</CardTitle><CardDescription>When this advertisement is active</CardDescription></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="endDate" render={({ field }) => (
                        <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Type & Placement */}
              <TabsContent value="type" className="space-y-6 mt-6">
                <PlacementGuide placement={watchPlacement} />
                <PlacementSpecs placement={watchPlacement} />

                <Card>
                  <CardHeader><CardTitle>Placement</CardTitle><CardDescription>Choose where this advertisement will appear. Heights and formats shown come from the canonical placement specification.</CardDescription></CardHeader>
                  <CardContent>
                    <FormField control={form.control} name="placement" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PlacementPicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                         <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <OwnerSelector
                      value={owner}
                      onChange={setOwner}
                      requestContext={requestContext}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Advertisement Type</CardTitle><CardDescription>Only types valid for the selected placement are shown</CardDescription></CardHeader>
                  <CardContent>
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {getValidTypesForPlacement(watchPlacement || '').map((type) => (
                            <button key={type} type="button" aria-pressed={field.value === type} onClick={() => field.onChange(type)} className={cn('flex flex-col items-center gap-2 p-4 rounded border-2 transition-all', field.value === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
                              <span className="text-sm font-medium text-center">{AD_TYPE_LABELS[type]}</span>
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Action Type</CardTitle><CardDescription>Define what happens when users interact with this ad</CardDescription></CardHeader>
                  <CardContent>
                    <FormField control={form.control} name="action" render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {ACTION_OPTIONS.map((option) => (
                            <button key={option.value} type="button" onClick={() => field.onChange(option.value)} className={cn('flex flex-col items-start gap-1 p-4 rounded border-2 transition-all text-left', field.value === option.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
                              <span className="font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.needsButton && option.needsUrl ? 'Shows button with link' : option.needsUrl ? 'Banner is clickable' : 'Display only, no interaction'}</span>
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                {needsButton && (
                  <Card>
                    <CardHeader><CardTitle>Button Settings</CardTitle><CardDescription>Configure the call-to-action button</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="buttonLabel" render={({ field }) => (
                        <FormItem><FormLabel>Button Label *</FormLabel><FormControl><Input placeholder="e.g., Apply Now" {...field} maxLength={50} /></FormControl><FormDescription>{(field.value || '').length}/50 characters</FormDescription><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="buttonUrl" render={({ field }) => (
                        <FormItem><FormLabel>Button Link *</FormLabel><FormControl><Input placeholder="https://example.com/apply" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="buttonVariant" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Variant</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger></FormControl>
                            <SelectContent>{BUTTON_VARIANT_OPTIONS.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="openInNewTab" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded border p-4">
                          <div className="space-y-0.5"><FormLabel>Open in New Tab</FormLabel><FormDescription>Open the button link in a new browser tab</FormDescription></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Display */}
              <TabsContent value="display" className="space-y-6 mt-6">
                <Card>
                  <CardHeader><CardTitle>Priority & Order</CardTitle><CardDescription>Control the rank of this advertisement within its placement</CardDescription></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="priority" render={({ field }) => (
                        <FormItem><FormLabel>Priority</FormLabel><FormControl><Input type="number" min={1} max={100} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} /></FormControl><FormDescription>1 = highest priority, 100 = lowest</FormDescription><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="displayOrder" render={({ field }) => (
                        <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormDescription>0 = first in placement</FormDescription><FormMessage /></FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Device Targeting</CardTitle><CardDescription>Choose which devices see this advertisement</CardDescription></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField control={form.control} name="showDesktop" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded border p-3">
                          <div className="flex items-center gap-2"><Monitor className="h-4 w-4" /><FormLabel className="mb-0">Desktop</FormLabel></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="showTablet" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded border p-3">
                          <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /><FormLabel className="mb-0">Tablet</FormLabel></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="showMobile" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded border p-3">
                          <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /><FormLabel className="mb-0">Mobile</FormLabel></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Media */}
              <TabsContent value="media" className="space-y-6 mt-6">
                {watchPlacement ? (() => {
                  const spec = getPlacementSpec(watchPlacement)
                  if (!spec) return null
                  const placementInfo = getPlacementInfo(watchPlacement)
                  const isFullWidthTop = placementInfo?.specs.maxDisplayHeight !== undefined
                  const maxDisplayHeight = placementInfo?.specs.maxDisplayHeight
                  const displayHeights = [
                    { device: 'Desktop', value: getDisplayHeight(watchPlacement, 'desktop') },
                    { device: 'Tablet', value: getDisplayHeight(watchPlacement, 'tablet') },
                    { device: 'Mobile', value: getDisplayHeight(watchPlacement, 'mobile') },
                  ]
                  return (
                    <Card>
                      <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <CardTitle>Creative Requirements</CardTitle>
                            <CardDescription>This placement expects specific creative sizes. Upload media that matches the selected format.</CardDescription>
                          </div>
                          {placementInfo?.label ? <Badge variant="secondary">{placementInfo.label}</Badge> : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {placementInfo?.page ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Appears on</span>
                            <span className="text-foreground">{placementInfo.page}</span>
                            <span>·</span>
                            <span>{placementInfo.position}</span>
                          </div>
                        ) : null}

                        <div className="rounded border border-border bg-muted/30 p-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Responsive Display Height
                            {isFullWidthTop && maxDisplayHeight ? <span className="ml-2 text-primary">· Max {maxDisplayHeight}px on desktop</span> : null}
                          </p>
                          <div className="grid grid-cols-3 gap-3">
                            {displayHeights.map(({ device, value }) => (
                              <div key={device} className="rounded bg-card p-3 text-center">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{device}</p>
                                <p className="mt-1 text-lg font-bold text-foreground">{value}px</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {isFullWidthTop && maxDisplayHeight ? `Maximum Displayed Height: ${maxDisplayHeight}px on desktop. ` : ''}
                            The slot owns the banner height; the image never expands it.
                          </p>
                        </div>

                        <div className="rounded border border-border bg-muted/30 p-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Creative Sizes by Format</p>
                          <ul className="space-y-2">
                            {spec.formats.map((format) => {
                              const desktop = getRequiredDimensions(watchPlacement, format, 'desktop')
                              const mobileDim = getRequiredDimensions(watchPlacement, format, 'mobile')
                              return (
                                <li key={format} className="rounded bg-card px-3 py-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-foreground">{format}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Desktop {desktop.width} × {desktop.height}px · {desktop.aspectRatio}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Mobile {mobileDim.width} × {mobileDim.height}px · {mobileDim.aspectRatio}
                                    </span>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>

                        {isFullWidthTop && (
                          <div className="rounded border border-border bg-muted/30 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tips for a full-width banner</p>
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground">
                              <li>Use a wide horizontal creative for the best fit</li>
                              <li>Keep important text and logos inside the safe area</li>
                              <li>Avoid tall artwork — it will be scaled to fit</li>
                              <li>Do not upload unnecessarily tall creatives</li>
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })() : null}
                <Card>
                  <CardHeader>
                    <CardTitle>Assigned Creatives</CardTitle>
                    <CardDescription>Existing creative assignments are preserved when you edit. Replacing a creative only changes that format — nothing else is removed.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {creativeAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No creative is assigned yet. Use the Creative Editor below.</p>
                    ) : (
                      creativeAssignments.map((assignment) => {
                        const supported = isFormatCompatible(watchPlacement || '', assignment.format)
                        const required = getRequiredDimensions(watchPlacement || 'BROKER_LISTING', assignment.format, assignment.format === 'MOBILE' ? 'mobile' : 'desktop')
                        const asset = assignment.asset || mediaAssets.find((candidate: MediaAsset) => candidate.id === assignment.mediaAssetId)
                        const matches = asset?.width && asset?.height ? asset.width === required.width && asset.height === required.height : null
                        return (
                          <div key={assignment.format} className="flex flex-wrap items-center gap-3 rounded border border-border p-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {assignment.format}
                                <span className="text-xs text-muted-foreground"> · {required.width} × {required.height} px ({required.aspectRatio})</span>
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{asset?.fileName || assignment.mediaAssetId}</p>
                              {asset?.width && asset?.height ? <p className="text-xs text-muted-foreground">Uploaded {asset.width} × {asset.height} px</p> : null}
                            </div>
                            {!supported ? (
                              <Badge variant="destructive">Not supported for placement</Badge>
                            ) : matches === true ? (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">✓ Matches</Badge>
                            ) : matches === false ? (
                              <Badge variant="destructive">✕ Mismatch</Badge>
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                {(() => {
                  const allowedFormats = availableCreativeFormats
                  const selectedFormat = selectedCreativeFormat && allowedFormats.includes(selectedCreativeFormat) ? selectedCreativeFormat : allowedFormats[0] || null
                  if (!selectedFormat || !watchPlacement) {
                    return (
                      <Card>
                        <CardHeader><CardTitle>Creative Editor</CardTitle><CardDescription>Select a placement to configure its creative.</CardDescription></CardHeader>
                      </Card>
                    )
                  }
                  const formatReq = getCreativeRequirementForFormat(watchPlacement, selectedFormat)
                  const selectedAssignment = creativeAssignments.find((creative) => creative.format === selectedFormat)
                  const selectedAsset = selectedAssignment?.asset || mediaAssets.find((candidate: MediaAsset) => candidate.id === selectedAssignment?.mediaAssetId) || null
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle>Creative Editor</CardTitle>
                        <CardDescription>Pick a format, then upload or select an image that matches its exact required resolution. Other assigned creatives are preserved.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {allowedFormats.length > 1 ? (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Creative Format</p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {allowedFormats.map((format) => {
                                const req = getCreativeRequirementForFormat(watchPlacement, format)
                                const isSelected = selectedFormat === format
                                const alreadyAssigned = creativeAssignments.some((creative) => creative.format === format)
                                return (
                                  <button
                                    key={format}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setSelectedCreativeFormat(format)}
                                    className={cn('rounded border p-4 text-left transition-colors', isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50')}
                                  >
                                    <span className="font-medium">{req.label}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground">{req.width} × {req.height} px</span>
                                    <span className="block text-xs text-muted-foreground">Aspect ratio: {req.aspectRatio}</span>
                                    {alreadyAssigned ? (
                                      <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Assigned</span>
                                    ) : null}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {formatReq.label} is the only supported format for this placement and is selected automatically.
                          </p>
                        )}
                        <div className="rounded border border-border p-4">
                          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold">{formatReq.label} Creative</p>
                              <p className="text-xs text-muted-foreground">Required resolution: {formatReq.width} × {formatReq.height} px · {formatReq.aspectRatio}</p>
                            </div>
                            {selectedAssignment ? <Badge variant="secondary">Assigned</Badge> : null}
                          </div>
                          <MediaSelector
                            value={selectedAssignment?.mediaAssetId || null}
                            selectedAsset={selectedAsset}
                            label={`${formatReq.label} image`}
                            description={`Required: ${formatReq.width} × ${formatReq.height}px · ${formatReq.aspectRatio}. Select from Media Library or upload a new creative.`}
                            folder="Advertisements"
                            placement={watchPlacement}
                            format={selectedFormat}
                            requiredWidth={formatReq.width}
                            requiredHeight={formatReq.height}
                            onChange={(selected) => updateCreative(selectedFormat, selected)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })()}

                <Card>
                  <CardHeader><CardTitle>Banner URL (Alternative)</CardTitle><CardDescription>Use a direct URL instead of media library (optional)</CardDescription></CardHeader>
                  <CardContent>
                    <FormField control={form.control} name="bannerUrl" render={({ field }) => (
                      <FormItem><FormLabel>Banner URL</FormLabel><FormControl><Input placeholder="/uploads/banners/summer-special.webp" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Preview Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      Preview
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <div className="flex border border-border rounded-md">
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewDevice('desktop')} className={previewDevice === 'desktop' ? 'bg-accent' : ''}><Monitor className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewDevice('mobile')} className={previewDevice === 'mobile' ? 'bg-accent' : ''}><Smartphone className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={previewBackground.id}
                      onChange={(e) => setPreviewBackground(PREVIEW_BACKGROUNDS.find(b => b.id === e.target.value) || PREVIEW_BACKGROUNDS[0])}
                      className="text-xs border border-border rounded-md px-2 py-1 bg-background"
                    >
                      {PREVIEW_BACKGROUNDS.map(bg => (
                        <option key={bg.id} value={bg.id}>{bg.label}</option>
                      ))}
                    </select>
                    <div className="flex border border-border rounded-md">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewZoom(z => Math.max(50, z - 25))}><ZoomOut className="h-3 w-3" /></Button>
                      <span className="text-xs px-2 py-1 border-x border-border flex items-center">{previewZoom}%</span>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewZoom(z => Math.min(100, z + 25))}><ZoomIn className="h-3 w-3" /></Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewZoom(100)}><Maximize className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn('border border-border rounded overflow-hidden transition-all', previewBackground.bg)}>
                    <div className={cn('p-4 space-y-3 transition-all', previewDevice === 'mobile' ? 'max-w-[280px] mx-auto' : 'w-full')} style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}>
                      <PlacementPreview
                        placement={watchPlacement}
                        desktopMedia={desktopMedia}
                        mobileMedia={mobileMedia}
                        bannerUrl={watchBannerUrl}
                        title={watchTitle || undefined}
                        description={watchDescription}
                        buttonLabel={watchButtonLabel}
                        action={watchAction}
                        previewDevice={previewDevice}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary (review) */}
              {(() => {
                const activeFormat = selectedCreativeFormat && availableCreativeFormats.includes(selectedCreativeFormat) ? selectedCreativeFormat : availableCreativeFormats[0] || null
                const summaryFormatReq = activeFormat && watchPlacement ? getCreativeRequirementForFormat(watchPlacement, activeFormat) : null
                const summaryAsset = activeFormat ? creativeAssignments.find((c) => c.format === activeFormat)?.asset : undefined
                const watchType = form.watch('type')
                const watchIsEnabled = form.watch('isEnabled')
                const watchStartDate = form.watch('startDate')
                const watchEndDate = form.watch('endDate')
                const companyLabel = ad?.companyId || companyId
                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Placement</dt><dd className="text-right font-medium">{watchPlacement || '—'}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Type</dt><dd className="text-right">{watchType ? AD_TYPE_LABELS[watchType as AdType] : '—'}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Action</dt><dd className="text-right">{watchAction || '—'}</dd></div>
                        {summaryFormatReq ? (
                          <>
                            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Creative format</dt><dd className="text-right">{summaryFormatReq.label}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Required resolution</dt><dd className="text-right">{summaryFormatReq.width} × {summaryFormatReq.height} px</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Uploaded resolution</dt><dd className="text-right">{summaryAsset?.width && summaryAsset?.height ? `${summaryAsset.width} × ${summaryAsset.height} px` : '—'}</dd></div>
                          </>
                        ) : null}
                        {companyLabel ? <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Company</dt><dd className="truncate text-right">Linked</dd></div> : null}
                        {requestId ? <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Request</dt><dd className="text-right">Linked</dd></div> : null}
                        {watchPlacement === 'BROKER_LISTING_LOCAL' && watchLocationTarget ? (
                          <>
                            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Target</dt><dd className="truncate text-right">{watchLocationTarget.locationLabel || `${watchLocationTarget.city || ''}, ${watchLocationTarget.state || ''}`}</dd></div>
                            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Radius</dt><dd className="text-right">{watchLocationTarget.radiusMiles} miles</dd></div>
                          </>
                        ) : null}
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Schedule</dt><dd className="text-right">{watchStartDate ? new Date(watchStartDate).toLocaleDateString() : '—'} → {watchEndDate ? new Date(watchEndDate).toLocaleDateString() : '—'}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd className="text-right">{watchIsEnabled ? 'Enabled' : 'Disabled'}</dd></div>
                      </dl>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Image Validation */}
              <ImageValidationPanel
                asset={previewDevice === 'mobile' ? mobileMedia : desktopMedia}
                placement={watchPlacement}
              />

              {/* Image Metadata */}
              <ImageMetadataPanel
                asset={previewDevice === 'mobile' ? mobileMedia : desktopMedia}
              />

              {/* Activity Timeline */}
              <ActivityTimeline advertisement={ad} />

              {/* Publish Readiness */}
              <PublishReadinessChecklist advertisement={ad} />
            </div>
          </div>
        </div>
      </form>
      </Form>

      {/* Duplicate Dialog */}
      {isEditMode && ad && (
        <DuplicateDialog
          open={showDuplicateDialog}
          onOpenChange={setShowDuplicateDialog}
          adId={ad.id}
          onSuccess={(dup) => router.push(`/admin/ads/${dup.id}/edit`)}
        />
      )}

      {/* Archive Dialog */}
      {isEditMode && ad && (
        <ArchiveDialog
          open={showArchiveDialog}
          onOpenChange={setShowArchiveDialog}
          adId={ad.id}
          adTitle={ad.title}
          onSuccess={() => router.push('/admin/ads/list')}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Advertisement</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete &quot;{ad?.title}&quot; and all associated data.
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

function PlacementPreview({
  placement,
  desktopMedia,
  mobileMedia,
  bannerUrl,
  title,
  description,
  buttonLabel,
  action,
  previewDevice,
}: {
  placement: string | undefined
  desktopMedia: MediaAsset | undefined
  mobileMedia: MediaAsset | undefined
  bannerUrl: string | undefined
  title: string | undefined
  description: string | undefined
  buttonLabel: string | undefined
  action: string | undefined
  previewDevice: 'desktop' | 'mobile'
}) {
  if (!placement) {
    return (
      <div className="aspect-video rounded-md border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Select a placement to preview</p>
        </div>
      </div>
    )
  }

  const asset = previewDevice === 'mobile' ? mobileMedia : desktopMedia
  const imageUrl = asset?.thumbnailUrl || asset?.fileUrl || bannerUrl
  const layout = getAdvertisementLayout(placement)
  const hasText = Boolean(title || description || (buttonLabel && (action === 'BUTTON_ONLY' || action === 'BANNER_AND_BUTTON')))

  if (placement === 'BROKER_LISTING_LOCAL') {
    // The real public broker-listing placement is a compact responsive square
    // card grid (3 → 2 → 1 columns), NOT a horizontal strip. Preview it that way.
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="relative aspect-square overflow-hidden rounded-md bg-muted">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={title || 'Preview'} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto" />
                  <p className="px-2 text-[10px] text-muted-foreground">No media selected</p>
                </div>
              )}
              {hasText ? (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-white">
                  {title ? <p className="line-clamp-1 text-xs font-semibold sm:text-sm">{title}</p> : null}
                  {description ? <p className="mt-0.5 line-clamp-1 text-[11px] text-white/90 sm:text-xs">{description}</p> : null}
                  {buttonLabel && (action === 'BUTTON_ONLY' || action === 'BANNER_AND_BUTTON') ? (
                    <span className="mt-1 inline-flex rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white sm:text-xs">{buttonLabel}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Renders responsively as compact square cards: 3 columns (desktop) · 2 (tablet) · 1 (mobile).</p>
      </div>
    )
  }

  if (!imageUrl && !title) {
    return (
      <div className={cn('rounded-md border-2 border-dashed border-border flex items-center justify-center bg-muted/50', layout.slotClassName)}>
        <div className="text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No media selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full overflow-hidden rounded-md bg-muted', layout.slotClassName)}>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={title || 'Preview'} className="h-full w-full object-contain" />
      )}
      {hasText ? (
        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-white sm:p-3">
          {title ? <p className="line-clamp-1 text-xs font-semibold sm:text-sm">{title}</p> : null}
          {description ? <p className="mt-0.5 line-clamp-1 text-[11px] text-white/90 sm:text-xs">{description}</p> : null}
          {buttonLabel && (action === 'BUTTON_ONLY' || action === 'BANNER_AND_BUTTON') ? (
            <span className="mt-1 inline-flex rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white sm:text-xs">{buttonLabel}</span>
          ) : null}
        </div>
      ) : null}
      {!hasText && title && !imageUrl ? <p className="text-sm font-medium truncate">{title}</p> : null}
    </div>
  )
}
