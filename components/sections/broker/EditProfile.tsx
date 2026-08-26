/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sections/broker/EditProfile.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Briefcase,
  Users,
  X,
  Save,
  Shield,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import ImageUpload from '@/components/ImageUpload'
import { ProfileImageUpload } from '@/components/brokers/ProfileImageUpload'
import { CoverImageUpload } from '@/components/brokers/CoverImageUpload'
import { USLocationPicker, type SelectedUSLocation } from '@/components/location/USLocationPicker'
import { US_STATES } from '@/lib/us-states'
import { isSafeHttpUrl } from '@/lib/broker-social-links'

// Form Schema based on Prisma schema
const profileSchema = z.object({
  // Broker Information
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  companyName: z.string().optional(),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  profileSlug: z.string().min(2, 'Profile slug must be at least 2 characters'),
  logo: z.string().optional(),

  // Contact Information
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 digits').optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),

  // Address
  officeAddress: z.string().min(10, 'Address must be at least 10 characters'),
  city: z.string().min(2, 'City must be at least 2 characters'),
  state: z.string().min(2, 'State must be at least 2 characters'),
  pinCode: z.string().length(5, 'ZIP Code must be 5 digits'),
  location: z.object({
    placeId: z.string(),
    normalizedAddress: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),

  // Professional Details
  experienceYears: z.coerce.number().min(0, 'Experience cannot be negative').max(50, 'Maximum 50 years'),

  // US Licensing
  nmls: z.string().trim().regex(/^\d{4,10}$/, 'NMLS ID must be 4–10 digits'),
  licenseStates: z.array(z.string()).min(1, 'Select at least one licensed state'),

  // Additional Info
  registrationNumber: z.string().optional(),
  panNumber: z.string().max(20, 'Tax ID / EIN must be 20 characters or fewer').optional().or(z.literal('')),

  // Social Links
  facebook: z.string().trim().refine((v) => v === '' || isSafeHttpUrl(v), 'Enter a valid https:// URL').optional().or(z.literal('')),
  twitter: z.string().trim().refine((v) => v === '' || isSafeHttpUrl(v), 'Enter a valid https:// URL').optional().or(z.literal('')),
  linkedin: z.string().trim().refine((v) => v === '' || isSafeHttpUrl(v), 'Enter a valid https:// URL').optional().or(z.literal('')),
  instagram: z.string().trim().refine((v) => v === '' || isSafeHttpUrl(v), 'Enter a valid https:// URL').optional().or(z.literal('')),

  // Profile visibility
  isVisible: z.boolean().default(true),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface EditBrokerProfileProps {
  broker: any
}

// Build the location-picker shape from a saved Broker record so the selected
// Google place (and its coordinates) is restored when editing the profile.
function locationFromBroker(broker: any) {
  if (!broker?.googlePlaceId) return undefined
  const geo = broker.location && typeof broker.location === 'object'
    ? broker.location as { coordinates?: unknown }
    : null
  const coordinates = Array.isArray(geo?.coordinates) && geo.coordinates.length === 2
    ? (geo.coordinates as [number, number])
    : null
  return {
    placeId: broker.googlePlaceId,
    normalizedAddress: broker.normalizedAddress || broker.officeAddress || '',
    city: broker.city || '',
    state: broker.state || '',
    zip: broker.pinCode || '',
    latitude: coordinates ? coordinates[1] : 0,
    longitude: coordinates ? coordinates[0] : 0,
  }
}

// Map of form fields → their owning tab. Used to drive cross-tab validation
// (switch to the first tab that contains an error, then focus its field) and
// to render per-tab error indicators.
const TAB_FIELDS = {
  basic: ['displayName', 'companyName', 'profileSlug', 'description'],
  contact: ['phone', 'whatsapp', 'email', 'website', 'location', 'officeAddress', 'city', 'state', 'pinCode'],
  professional: ['experienceYears', 'nmls', 'licenseStates'],
  social: ['facebook', 'twitter', 'linkedin', 'instagram'],
} as const

type TabName = keyof typeof TAB_FIELDS

// Deterministic field order so the "first invalid field" is predictable.
const FIELD_ORDER = [
  ...TAB_FIELDS.basic,
  ...TAB_FIELDS.contact,
  ...TAB_FIELDS.professional,
  ...TAB_FIELDS.social,
] as string[]

const TAB_TO_FIELD: Record<string, TabName> = {}
for (const tab of Object.keys(TAB_FIELDS) as TabName[]) {
  for (const field of TAB_FIELDS[tab]) TAB_TO_FIELD[field] = tab
}

function tabForField(field: string): TabName | undefined {
  return TAB_TO_FIELD[field]
}

function computeTabErrors(errors: Record<string, unknown>): Record<TabName, number> {
  const counts: Record<TabName, number> = { basic: 0, contact: 0, professional: 0, social: 0 }
  for (const tab of Object.keys(TAB_FIELDS) as TabName[]) {
    for (const field of TAB_FIELDS[tab]) {
      if (errors[field]) counts[tab] += 1
    }
  }
  return counts
}

// Focus + scroll to an invalid field. react-hook-form's Controller sets the
// `name` attribute on the underlying DOM input, so a generic selector works
// without adding ids to every field.
function focusField(field: string) {
  const el = document.querySelector<HTMLElement>(`[name="${field}"], [id="${field}"]`)
  el?.focus()
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function TabErrorBadge({ count }: { count: number }) {
  return (
    <Badge
      variant="destructive"
      className="h-5 min-w-5 px-1.5"
      aria-label={`${count} error${count === 1 ? '' : 's'}`}
    >
      {count}
    </Badge>
  )
}

export function EditBrokerProfile({ broker }: EditBrokerProfileProps) {
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  // Initialize form with broker data
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      displayName: broker?.displayName || '',
      companyName: broker?.companyName || '',
      description: broker?.description || '',
      profileSlug: broker?.profileSlug || '',
      logo: broker?.logo || '',

      phone: broker?.phone || '',
      whatsapp: broker?.whatsapp || '',
      email: broker?.email || '',
      website: broker?.website || '',

      officeAddress: broker?.officeAddress || '',
      city: broker?.city || '',
      state: broker?.state || '',
      pinCode: broker?.pinCode || '',
      location: locationFromBroker(broker),

      experienceYears: broker?.experienceYears || 0,
      nmls: broker?.nmls || '',
      licenseStates: Array.isArray(broker?.licenseStates) ? broker.licenseStates : [],

      registrationNumber: broker?.registrationNumber || '',
      panNumber: broker?.panNumber || '',

      facebook: broker?.socialLinks?.facebook || '',
      twitter: broker?.socialLinks?.twitter || '',
      linkedin: broker?.socialLinks?.linkedin || '',
      instagram: broker?.socialLinks?.instagram || '',

      isVisible: broker?.isVisible ?? true,
    }
  })

  // Guard against double-submission: the submit button is disabled while a save
  // is in flight, and this state check rejects any stray duplicate event.
  const saveChanges = async (data: ProfileFormData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/brokers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update profile')
      }

      toast.success('✓ Changes saved')
      // Re-base the form on the saved state so "Reset Changes" restores the
      // last save (never the database).
      form.reset(data)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cross-tab validation: on an invalid submit, collect errors (react-hook-form
  // has already validated every registered field), switch to the first tab that
  // contains an error, and move focus to the first invalid field.
  const onInvalidSubmit = () => {
    const errors = form.formState.errors as Record<string, unknown>
    for (const field of FIELD_ORDER) {
      if (errors[field]) {
        const tab = tabForField(field)
        if (tab) setActiveTab(tab)
        window.setTimeout(() => focusField(field), 0)
        break
      }
    }
  }

  // Reset restores the last loaded/saved server state. It never touches the DB.
  const resetChanges = () => {
    if (form.formState.isDirty && !window.confirm('Discard your unsaved changes?')) return
    form.reset()
    toast.success('Changes reset')
  }

  // Cancel leaves the edit page, warning when there are unsaved changes.
  const handleCancel = () => {
    if (form.formState.isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return
    router.push('/broker/profile')
  }

  // Warn on browser unload / navigation away with unsaved changes.
  useEffect(() => {
    if (!form.formState.isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [form.formState.isDirty])

  const tabErrors = useMemo(
    () => computeTabErrors(form.formState.errors as Record<string, unknown>),
    [form.formState.errors]
  )

  return (
    <div className="max-w-6xl mx-auto  ">
      {/* Header */}
      <div className="mb-8">
         <h1 className="text-3xl font-bold text-foreground mb-2">Edit Mortgage Originator Profile</h1>
        <p className="text-muted-foreground">
          Update your company information, services, and professional details
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(saveChanges, onInvalidSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-8 overflow-x-auto overflow-y-hidden">
              <TabsTrigger value="basic">
                <Building className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Basic Info</span>
                {tabErrors.basic > 0 && <TabErrorBadge count={tabErrors.basic} />}
              </TabsTrigger>
              <TabsTrigger value="contact">
                <Phone className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Contact</span>
                {tabErrors.contact > 0 && <TabErrorBadge count={tabErrors.contact} />}
              </TabsTrigger>
              <TabsTrigger value="professional">
                <Briefcase className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Professional</span>
                {tabErrors.professional > 0 && <TabErrorBadge count={tabErrors.professional} />}
              </TabsTrigger>
              {/* <TabsTrigger value="additional">
                <Award className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Additional</span>
              </TabsTrigger> */}
              <TabsTrigger value="social">
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Social</span>
                {tabErrors.social > 0 && <TabErrorBadge count={tabErrors.social} />}
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Update your company profile details and images
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <FormLabel>Professional Profile Image</FormLabel>
                    <ProfileImageUpload
                      value={broker?.profileImage}
                      uploadUrl="/api/brokers/me/profile-image"
                      removeUrl="/api/brokers/me/profile-image"
                      label="Profile image"
                      helperText="Professional mortgage originator photo shown on public cards and profile."
                    />
                  </div>

                  <div className="space-y-4">
                    <FormLabel>Cover Photo</FormLabel>
                    <CoverImageUpload
                      value={broker?.coverImage}
                      uploadUrl="/api/brokers/me/cover-image"
                      removeUrl="/api/brokers/me/cover-image"
                      onUploaded={() => router.refresh()}
                      label="Cover photo"
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload from your device only — the admin Media Library is never used for mortgage originator profile photos.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <FormLabel>Company Logo</FormLabel>
                    <FormField
                      control={form.control}
                      name="logo"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                              <ImageUpload
                                value={field.value}
                                onChange={field.onChange}
                                type="logo"
                              />
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Upload your logo (Recommended: 400×400px, PNG or JPG)
                                </p>
                                {field.value && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => field.onChange('')}
                                  >
                                    Remove Logo
                                  </Button>
                                )}
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>



                  {/* Basic Info Fields */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name as shown to clients" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your company name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="profileSlug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile URL Slug *</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                             <span className="text-muted-foreground mr-2 whitespace-nowrap">homeloanmarket.com/</span>
                            <Input
                              placeholder="your-profile-name"
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9-]/g, '-')
                                  .replace(/-+/g, '-')
                                  .replace(/^-|-$/g, '')
                                field.onChange(value)
                              }}
                              className="min-w-0"
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          This will be your public profile URL
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your experience, expertise, and services"
                            rows={4}
                            className="resize-none min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This appears on your public profile
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

            </TabsContent>

            {/* Contact Information Tab */}
            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>
                    Update your contact details and office address
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                 placeholder="+1 (555) 123-4560"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="whatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp Number</FormLabel>
                          <FormControl>
                             <Input placeholder="+1 (555) 987-6540" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="email"
                                placeholder="contact@company.com"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="https://example.com"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <USLocationPicker
                            value={field.value as SelectedUSLocation | undefined}
                            onChange={(location) => {
                              field.onChange(location)
                              if (location) {
                                form.setValue('officeAddress', location.normalizedAddress)
                                form.setValue('city', location.city)
                                form.setValue('state', location.state)
                                form.setValue('pinCode', location.zip)
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* The address fields below are auto-filled from the selected
                      Google place. Manually editing any of them clears the place
                      selection so the stored coordinates can never mismatch the
                      address text — the broker must re-select a place. */}
                  <FormField
                    control={form.control}
                    name="officeAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Office Address *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Enter complete office address"
                              className="pl-10"
                              {...field}
                              onChange={(event) => {
                                field.onChange(event)
                                form.setValue('location', undefined)
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="City"
                              {...field}
                              onChange={(event) => {
                                field.onChange(event)
                                form.setValue('location', undefined)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="State"
                              {...field}
                              onChange={(event) => {
                                field.onChange(event)
                                form.setValue('location', undefined)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pinCode"
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel>ZIP Code *</FormLabel>
                          <FormControl>
                             <Input
                               placeholder="12345"
                               inputMode="numeric"
                               {...field}
                               onChange={(event) => {
                                 field.onChange(event)
                                 form.setValue('location', undefined)
                               }}
                             />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

            </TabsContent>

            {/* Professional Information Tab */}
            <TabsContent value="professional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Professional Information</CardTitle>
                  <CardDescription>
                    Update your experience and professional details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Experience */}
                  <FormField
                    control={form.control}
                    name="experienceYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of Experience *</FormLabel>
                        <FormControl>
                          <div className="relative max-w-xs">
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              {...field}
                              className="pl-12"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              <Briefcase className="h-5 w-5" />
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* US Licensing */}
                  <Separator />
                  <FormField
                    control={form.control}
                    name="nmls"
                    render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel>NMLS ID *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="12345678"
                            inputMode="numeric"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Your National Multistate Licensing System identifier (4–10 digits).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="licenseStates"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License States *</FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            <Select
                              onValueChange={(value) => {
                                const current = field.value || []
                                if (!current.includes(value)) field.onChange([...current, value])
                              }}
                            >
                              <SelectTrigger className="w-full sm:max-w-xs">
                                <SelectValue placeholder="Add a licensed state" />
                              </SelectTrigger>
                              <SelectContent>
                                {US_STATES.filter((state) => !(field.value || []).includes(state.code)).map((state) => (
                                  <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex flex-wrap gap-2 min-h-[40px]">
                              {(field.value || []).map((code: string) => (
                                <Badge key={code} variant="outline" className="gap-1 py-1.5 px-3">
                                  {US_STATES.find((state) => state.code === code)?.name || code}
                                  <button
                                    type="button"
                                    aria-label={`Remove ${code}`}
                                    onClick={() => field.onChange((field.value || []).filter((c: string) => c !== code))}
                                    className="hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Select every US state where you are licensed to originate mortgages. At least one is required.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

            </TabsContent>

            {/* Additional Information Tab */}
            <TabsContent value="additional" className="space-y-6">
              <Card>
                <CardHeader>
                   <CardTitle>Registration & Tax ID Details</CardTitle>
                   <CardDescription>
                     Add your registration and tax ID details for verification
                   </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="registrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Number</FormLabel>
                          <FormControl>
                             <Input placeholder="State registration or EIN" {...field} />
                          </FormControl>
                          <FormDescription>
                            Your business registration number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="panNumber"
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel>Tax ID Number</FormLabel>
                           <FormControl>
                             <Input
                               placeholder="XX-XXXXXXX"
                               {...field}
                              onChange={(e) => {
                                const value = e.target.value.toUpperCase()
                                field.onChange(value)
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Your business tax identifier (EIN or individual tax ID)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

            </TabsContent>

            {/* Social & Features Tab */}
            <TabsContent value="social" className="space-y-6">
              <div className="grid gap-6">
                {/* Social Links Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Social Media Links</CardTitle>
                    <CardDescription>
                      Add your social media profiles to increase credibility
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="facebook"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facebook</FormLabel>
                          <FormControl>
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-l-lg bg-blue-100 flex items-center justify-center border border-r-0">
                                <span className="text-info font-semibold">f</span>
                              </div>
                              <Input
                                placeholder="https://facebook.com/yourcompany"
                                className="rounded-l-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="twitter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twitter</FormLabel>
                          <FormControl>
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-l-lg bg-blue-100 flex items-center justify-center border border-r-0">
                                <span className="text-blue-400 font-semibold">𝕏</span>
                              </div>
                              <Input
                                placeholder="https://twitter.com/yourcompany"
                                className="rounded-l-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="linkedin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn</FormLabel>
                          <FormControl>
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-l-lg bg-blue-100 flex items-center justify-center border border-r-0">
                                <span className="text-blue-700 font-semibold">in</span>
                              </div>
                              <Input
                                placeholder="https://linkedin.com/company/yourcompany"
                                className="rounded-l-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="instagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram</FormLabel>
                          <FormControl>
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-l-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center border border-r-0">
                                <span className="text-white font-semibold">IG</span>
                              </div>
                              <Input
                                placeholder="https://instagram.com/yourcompany"
                                className="rounded-l-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Profile Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>
                      Control your profile visibility and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="isVisible"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Profile Visibility</FormLabel>
                            <FormDescription>
                              Make your profile visible in search results
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Verification Status */}
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Verification Status</h4>
                      </div>
                      <Badge 
                        variant="outline"
                        className={broker?.verificationStatus === 'VERIFIED' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                      >
                        {broker?.verificationStatus === 'VERIFIED' ? 'Verified' : 'Verification Required'}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {broker?.verificationStatus === 'VERIFIED'
                          ? 'Your profile is verified and visible to clients'
                          : 'Complete verification to access all features'}
                      </p>
                      {broker?.verificationStatus !== 'VERIFIED' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => router.push('/broker/profile/verification')}
                        >
                          Complete Verification
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Submit Buttons */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t pt-4 pb-6 -mx-4 px-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 max-w-6xl mx-auto">
              <div className="flex w-full sm:w-auto items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetChanges}
                  disabled={!form.formState.isDirty}
                >
                  Reset Changes
                </Button>
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2 w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
