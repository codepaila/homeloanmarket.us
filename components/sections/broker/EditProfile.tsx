/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sections/broker/EditProfile.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Banknote,
  Users,
  Award,
  X,
  Plus,
  Save,
  Shield,
  Languages,
  AlertCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useUserPermissions } from '@/hooks/useCurrentUser'
import ImageUpload from '@/components/ImageUpload'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Form Schema based on Prisma schema
const profileSchema = z.object({
  // Broker Information
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  companyName: z.string().optional(),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  profileSlug: z.string().min(2, 'Profile slug must be at least 2 characters'),
  logo: z.string().optional(),
  coverImage: z.string().optional(),

  // Contact Information
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 digits').optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),

  // Address
  officeAddress: z.string().min(10, 'Address must be at least 10 characters'),
  city: z.string().min(2, 'City must be at least 2 characters'),
  state: z.string().min(2, 'State must be at least 2 characters'),
  zipCode: z.string().length(5, 'ZIP Code must be 5 digits'),

  // Professional Details
  experienceYears: z.coerce.number().min(0, 'Experience cannot be negative').max(50, 'Maximum 50 years'),
  specializations: z.array(z.string()).min(1, 'Select at least one specialization'),
  serviceCities: z.array(z.string()),
  languages: z.array(z.string()).min(1, 'Select at least one language'),

  // Additional Info
  registrationNumber: z.string().optional(),
  panNumber: z.string().length(10, 'Tax ID must be 10 characters').optional().or(z.literal('')),

  // Social Links
  facebook: z.string().url().optional().or(z.literal('')),
  twitter: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
  instagram: z.string().url().optional().or(z.literal('')),

  // Profile visibility
  isVisible: z.boolean().default(true),
})

type ProfileFormData = z.infer<typeof profileSchema>

// Options for selection
const specializationOptions = [
  'Home Purchase',
  'Refinance',
  'FHA Loan',
  'VA Loan',
  'USDA Loan',
  'Jumbo Loan',
  'Conventional Loan',
  'Construction Loan',
  'Home Equity Loan',
  'Cash-Out Refinance'
]

const usCities = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
  'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
  'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte',
  'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Washington DC'
]

const languageOptions = ['English', 'Spanish']

interface EditBrokerProfileProps {
  broker: any
}

export function EditBrokerProfile({ broker }: EditBrokerProfileProps) {
  const router = useRouter()
  const permissions = useUserPermissions()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingTab, setIsSavingTab] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [newSpec, setNewSpec] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newLang, setNewLang] = useState('')

  // Service cities restrictions based on subscription
  const maxServiceCities = permissions.hasActiveSubscription ? Infinity : 1
  const isFreeUser = !permissions.hasActiveSubscription

  // Initialize form with broker data
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      displayName: broker?.displayName || '',
      companyName: broker?.companyName || '',
      description: broker?.description || '',
      profileSlug: broker?.profileSlug || '',
      logo: broker?.logo || '',
      coverImage: broker?.coverImage || '',

      phone: broker?.phone || '',
      whatsapp: broker?.whatsapp || '',
      email: broker?.email || '',
      website: broker?.website || '',

      officeAddress: broker?.officeAddress || '',
      city: broker?.city || '',
      state: broker?.state || '',
      zipCode: broker?.zipCode || '',

      experienceYears: broker?.experienceYears || 0,
      specializations: broker?.specializations || ['Home Purchase'],
      serviceCities: isFreeUser && broker?.serviceCities?.length > 1
        ? [broker?.serviceCities[0]] // Limit to first city for free users
        : (broker?.serviceCities || []),
      languages: broker?.languages || ['English', 'Spanish'],

      registrationNumber: broker?.registrationNumber || '',
      panNumber: broker?.panNumber || '',

      facebook: broker?.facebook || '',
      twitter: broker?.twitter || '',
      linkedin: broker?.linkedin || '',
      instagram: broker?.instagram || '',

      isVisible: broker?.isVisible ?? true,
    }
  })

  // Watch service cities for real-time updates
  const currentServiceCities = form.watch('serviceCities') || []

  // Add item to array field with validation
  const handleAddItem = useCallback((field: keyof ProfileFormData, value: string) => {
    const current = form.getValues(field) as string[]
    const trimmedValue = value.trim()

    if (!trimmedValue) return

    if (field === 'serviceCities' && current.length >= maxServiceCities) {
      toast.error(`Free Plan limited to ${maxServiceCities} city. Upgrade to add more.`)
      return
    }

    if (!current.includes(trimmedValue)) {
      form.setValue(field, [...current, trimmedValue], { shouldDirty: true })
    }

    // Clear input
    if (field === 'specializations') setNewSpec('')
    if (field === 'serviceCities') setNewCity('')
    if (field === 'languages') setNewLang('')
  }, [form, maxServiceCities])

  // Remove item from array field
  const handleRemoveItem = useCallback((field: keyof ProfileFormData, value: string) => {
    const current = form.getValues(field) as string[]
    form.setValue(field, current.filter(item => item !== value), { shouldDirty: true })
  }, [form])

  // Get tab-specific data
  const getTabData = (tab: string): Partial<ProfileFormData> => {
    const formData = form.getValues()
    const tabData: Partial<ProfileFormData> = {}

    switch (tab) {
      case 'basic':
        tabData.displayName = formData.displayName
        tabData.companyName = formData.companyName
        tabData.description = formData.description
        tabData.profileSlug = formData.profileSlug
        tabData.logo = formData.logo
        tabData.coverImage = formData.coverImage
        break
      case 'contact':
        tabData.phone = formData.phone
        tabData.whatsapp = formData.whatsapp
        tabData.email = formData.email
        tabData.website = formData.website
        tabData.officeAddress = formData.officeAddress
        tabData.city = formData.city
        tabData.state = formData.state
        tabData.zipCode = formData.zipCode
        break
      case 'professional':
        tabData.experienceYears = formData.experienceYears
        tabData.specializations = formData.specializations
        tabData.serviceCities = formData.serviceCities
        tabData.languages = formData.languages
        break
      case 'additional':
        tabData.registrationNumber = formData.registrationNumber
        tabData.panNumber = formData.panNumber
        break
      case 'social':
        tabData.facebook = formData.facebook
        tabData.twitter = formData.twitter
        tabData.linkedin = formData.linkedin
        tabData.instagram = formData.instagram
        tabData.isVisible = formData.isVisible
        break
    }

    return tabData
  }

  // Save current tab
  const saveCurrentTab = async () => {
    try {
      setIsSavingTab(true)
      const tabData = getTabData(activeTab)

      const response = await fetch('/api/brokers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tabData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update profile')
      }

      toast.success('Changes saved successfully!')
      form.reset(form.getValues()) // Reset dirty state
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSavingTab(false)
    }
  }

  // Save all changes
  const saveAllChanges = async () => {
    try {
      setIsSubmitting(true)
      const formData = form.getValues()

      const response = await fetch('/api/brokers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update profile')
      }

      toast.success('Profile updated successfully!')

      // Redirect to profile page
      router.push('/broker/profile')
      router.refresh()

    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle tab change with save prompt
  const handleTabChange = async (newTab: string) => {
    if (form.formState.isDirty) {
      const shouldSave = window.confirm('You have unsaved changes. Save before switching tabs?')
      if (shouldSave) {
        await saveCurrentTab()
      }
    }
    setActiveTab(newTab)
  }

  // Reset changes
  const resetChanges = () => {
    form.reset()
    toast.success('Changes reset')
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
         <h1 className="text-3xl font-bold text-foreground mb-2">Edit Mortgage Broker Profile</h1>
        <p className="text-muted-foreground">
          Update your company information, services, and professional details
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(saveAllChanges)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-8 overflow-x-auto overflow-y-hidden">
              <TabsTrigger value="basic">
                <Building className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Basic Info</span>
              </TabsTrigger>
              <TabsTrigger value="contact">
                <Phone className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Contact</span>
              </TabsTrigger>
              <TabsTrigger value="professional">
                <Briefcase className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Professional</span>
              </TabsTrigger>
              {/* <TabsTrigger value="additional">
                <Award className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Additional</span>
              </TabsTrigger> */}
              <TabsTrigger value="social">
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Social</span>
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
                  <div className="space-y-4">
                    <FormLabel>Cover Image</FormLabel>
                    <FormField
                      control={form.control}
                      name="coverImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ImageUpload
                              value={field.value}
                              onChange={field.onChange}
                              type="cover"
                              aspectRatio="cover"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Recommended: 1920×640px. This appears at the top of your profile
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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

              {/* Save button for this tab */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={saveCurrentTab}
                  disabled={isSavingTab || !form.formState.isDirty}
                  className="gap-2"
                >
                  {isSavingTab ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Basic Info
                    </>
                  )}
                </Button>
              </div>
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
                            <Input placeholder="City" {...field} />
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
                            <Input placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                           <FormLabel>ZIP Code *</FormLabel>
                          <FormControl>
                             <Input placeholder="12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Save button for this tab */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={saveCurrentTab}
                  disabled={isSavingTab || !form.formState.isDirty}
                  className="gap-2"
                >
                  {isSavingTab ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Contact Info
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Professional Information Tab */}
            <TabsContent value="professional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Professional Information</CardTitle>
                  <CardDescription>
                    Update your expertise, specializations, and service areas
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

                  <Separator />

                  {/* Specializations */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-medium">Specializations *</h4>
                        <p className="text-sm text-muted-foreground">Select loan types you specialize in</p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {form.watch('specializations')?.length || 0} selected
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select onValueChange={(value) => handleAddItem('specializations', value)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Add specialization" />
                          </SelectTrigger>
                          <SelectContent>
                            {specializationOptions.map((spec) => (
                              <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Custom specialization"
                            value={newSpec}
                            onChange={(e) => setNewSpec(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddItem('specializations', newSpec)
                              }
                            }}
                            className="min-w-0"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleAddItem('specializations', newSpec)}
                            disabled={!newSpec.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {form.watch('specializations')?.map((spec: string) => (
                          <Badge key={spec} variant="secondary" className="gap-1 py-1.5 px-3">
                            {spec}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem('specializations', spec)}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Service Cities with subscription restriction */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-medium">Service Cities</h4>
                        <p className="text-sm text-muted-foreground">
                          Cities where you provide services
                          {isFreeUser && (
                            <span className="text-amber-600 ml-1">
                              (Limited to 1 city on free plan)
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {currentServiceCities.length} / {maxServiceCities} selected
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select
                          onValueChange={(value) => handleAddItem('serviceCities', value)}
                          disabled={currentServiceCities.length >= maxServiceCities}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={
                              currentServiceCities.length >= maxServiceCities
                                ? "Limit reached"
                                : "Add service city"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {usCities.map((city) => (
                              <SelectItem
                                key={city}
                                value={city}
                                disabled={currentServiceCities.includes(city)}
                              >
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {permissions.hasActiveSubscription && (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Custom city"
                              value={newCity}
                              onChange={(e) => setNewCity(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddItem('serviceCities', newCity)
                                }
                              }}
                              className="min-w-0"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleAddItem('serviceCities', newCity)}
                              disabled={!newCity.trim()}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {isFreeUser && currentServiceCities.length >= maxServiceCities && (
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            Free Plan limited to 1 service city.{" "}
                            <Button
                              type="button"
                              variant="link"
                              className="p-0 h-auto text-amber-800 underline"
                              onClick={() => router.push('/broker/subscription')}
                            >
                              Upgrade to add more cities
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {currentServiceCities.map((city: string) => (
                          <Badge key={city} variant="outline" className="gap-1 py-1.5 px-3">
                            <MapPin className="h-3 w-3" />
                            {city}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem('serviceCities', city)}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Languages */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-medium">Languages *</h4>
                        <p className="text-sm text-muted-foreground">Languages you can communicate in</p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {form.watch('languages')?.length || 0} selected
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select onValueChange={(value) => handleAddItem('languages', value)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Add language" />
                          </SelectTrigger>
                          <SelectContent>
                            {languageOptions.map((lang) => (
                              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Custom language"
                            value={newLang}
                            onChange={(e) => setNewLang(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddItem('languages', newLang)
                              }
                            }}
                            className="min-w-0"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleAddItem('languages', newLang)}
                            disabled={!newLang.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {form.watch('languages')?.map((lang: string) => (
                          <Badge key={lang} variant="secondary" className="gap-1 py-1.5 px-3">
                            <Languages className="h-3 w-3" />
                            {lang}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem('languages', lang)}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save button for this tab */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={saveCurrentTab}
                  disabled={isSavingTab || !form.formState.isDirty}
                  className="gap-2"
                >
                  {isSavingTab ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Professional Info
                    </>
                  )}
                </Button>
              </div>
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
                            10-character Permanent Account Number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Save button for this tab */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={saveCurrentTab}
                  disabled={isSavingTab || !form.formState.isDirty}
                  className="gap-2"
                >
                  {isSavingTab ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Additional Info
                    </>
                  )}
                </Button>
              </div>
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

              {/* Save button for this tab */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={saveCurrentTab}
                  disabled={isSavingTab || !form.formState.isDirty}
                  className="gap-2"
                >
                  {isSavingTab ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Social & Settings
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Submit Buttons */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t pt-4 pb-6 -mx-4 px-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 max-w-6xl mx-auto">
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/broker/profile')}
                >
                  Cancel
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetChanges}
                  disabled={!form.formState.isDirty}
                  className="order-2 sm:order-1"
                >
                  Reset Changes
                </Button>
                <div className="flex gap-3 order-1 sm:order-2">
                  {/* <Button
                    type="button"
                    onClick={saveCurrentTab}
                    disabled={isSavingTab || !form.formState.isDirty}
                    className="gap-2"
                  >
                    {isSavingTab ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Tab
                      </>
                    )}
                  </Button> */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving All...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save All Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}
