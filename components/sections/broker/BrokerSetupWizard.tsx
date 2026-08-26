/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sections/broker/BrokerSetupWizard.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Building,
  Phone,
  Mail,
  Globe,
  Briefcase,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Shield,
  Check,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { US_STATES } from '@/lib/us-states'
import ImageUpload from '@/components/ImageUpload'
import { USLocationPicker, type SelectedUSLocation } from '@/components/location/USLocationPicker'
import type { LucideIcon } from 'lucide-react'

type StepDef = { id: number; title: string; icon: LucideIcon }

// Step 1 Schema - Basic Information
const basicInfoSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  companyName: z.string().optional(),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  logo: z.string().optional(),
  profileImage: z.string().optional(),
  coverImage: z.string().optional(),
  profileSlug: z.string().min(2, 'Profile slug must be at least 2 characters'),
})

// Step 2 Schema - Contact Information
const contactInfoSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 digits').optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  officeAddress: z.string().min(10, 'Address must be at least 10 characters'),
  city: z.string().min(2, 'City must be at least 2 characters'),
  state: z.string().min(2, 'State must be at least 2 characters'),
  pinCode: z.string().length(5, 'ZIP Code must be 5 digits'),
  // The office location must be a Google-resolved US place selected from the
  // autocomplete suggestions. A manually typed address without a place
  // selection is rejected so the stored coordinates always match the address.
  location: z.object({
    placeId: z.string(),
    normalizedAddress: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).refine(
    (value) => Boolean(value.placeId),
    'Select a validated US office location from the suggestions',
  ),
})

// Step 3 Schema - Professional Details
const professionalSchema = z.object({
  experienceYears: z.coerce.number().min(0, 'Experience cannot be negative').max(50, 'Maximum 50 years'),
  // NMLS ID is required to complete US broker onboarding (presence + format).
  nmls: z.string().trim().regex(/^\d{4,10}$/, 'NMLS ID must be 4–10 digits'),
  // At least one licensed US state is required.
  licenseStates: z.array(z.string()).min(1, 'Select at least one licensed state'),
})

// Step 4 Schema - Registration Details
const registrationSchema = z.object({
  registrationNumber: z.string().optional(),
  // US tax identifier (EIN / individual tax ID). The underlying field name
  // stays `panNumber` for backward compatibility; it is displayed as a US tax
  // identifier and never reinterpreted as an India PAN.
  panNumber: z.string().max(20, 'Tax ID / EIN must be 20 characters or fewer').optional().or(z.literal('')),
})

// Step 5 Schema - Verification Documents
const documentsSchema = z.object({
  panCard: z.string().optional().or(z.literal('')),
  addressProof: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof basicInfoSchema> &
  z.infer<typeof contactInfoSchema> &
  z.infer<typeof professionalSchema> &
  z.infer<typeof registrationSchema> &
  z.infer<typeof documentsSchema>

const steps: StepDef[] = [
  { id: 1, title: 'Profile', icon: Building },
  { id: 2, title: 'Contact', icon: Phone },
  { id: 3, title: 'Licensing', icon: Shield },
  { id: 4, title: 'Review', icon: CheckCircle },
]

// Step-level heading + description shown under the progress bar.
const STEP_META: Record<number, { title: string; description: string }> = {
  1: { title: 'Basic Information', description: 'Tell buyers who you are and set up your public profile.' },
  2: { title: 'Contact & Office Location', description: 'Add your contact details and validated US office location.' },
  3: { title: 'Licensing', description: 'Add your NMLS ID and the states where you hold a mortgage license.' },
  4: { title: 'Review & Submit', description: 'Confirm everything is correct, then complete your setup.' },
}

interface BrokerSetupWizardProps {
  user: any
  initialData?: Partial<FormData>
  initialStep?: number
}

// Older onboarding drafts persisted the postal code as `zipCode`. The canonical
// schema field is `pinCode`; map legacy drafts so a resumed wizard restores the
// ZIP correctly and the current step always sees canonical field names.
function restoreInitialData(initialData: Partial<FormData>): Partial<FormData> {
  const restored: Record<string, unknown> = { ...initialData }
  if ('zipCode' in restored && !('pinCode' in restored)) {
    restored.pinCode = restored.zipCode
    delete restored.zipCode
  }
  return restored as Partial<FormData>
}

// Compact horizontal stepper: completed = check, active = icon, upcoming = number.
// Labels hide below `md`; the "Step X of Y" text always communicates position.
function Stepper({ steps, currentStep }: { steps: StepDef[]; currentStep: number }) {
  return (
    <ol className="flex min-w-0 items-center gap-1.5" aria-label="Onboarding progress">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep
        const isCompleted = step.id < currentStep
        const Icon = step.icon
        return (
          <li key={step.id} className="flex min-w-0 items-center gap-1.5">
            <span
              aria-current={isActive ? 'step' : undefined}
              className={`
                flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs
                ${isCompleted ? 'border-success/60 bg-success/10 text-success' :
                  isActive ? 'border-primary bg-primary text-primary-foreground' :
                  'border-border bg-background text-muted-foreground'}
              `}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : isActive ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : <span>{step.id}</span>}
            </span>
            <span
              className={`hidden truncate text-xs font-medium md:block ${
                isActive ? 'text-foreground' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/70'
              }`}
            >
              {step.title}
            </span>
            {index < steps.length - 1 && <span className="mx-1 h-px w-4 bg-border sm:w-6" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

export function BrokerSetupWizard({ initialData = {}, initialStep = 1 }: BrokerSetupWizardProps) {
  const router = useRouter()
  const { update: refreshSession } = useSession()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Verification document uploads are not part of the current flow; the field
  // is retained so the completion payload shape stays stable.
  const uploadedDocs: Record<string, { name: string; url: string }> = {}

  const form = useForm<FormData>({
    resolver: zodResolver(
      basicInfoSchema
        .merge(contactInfoSchema)
        .merge(professionalSchema)
        .merge(registrationSchema)
        .merge(documentsSchema)
    ) as any,
    defaultValues: {
      displayName: '',
      companyName: '',
      description: '',
      logo: '',
      profileImage: '',
      coverImage: '',
      profileSlug: '',
      phone: '',
      whatsapp: '',
      email: '',
      website: '',
      officeAddress: '',
      city: '',
      state: '',
      pinCode: '',
      location: undefined,
      experienceYears: 0,
      nmls: '',
      licenseStates: [],
      registrationNumber: '',
      panNumber: '',
      panCard: '',
      addressProof: '',
      ...restoreInitialData(initialData),
    }
  })

  const progress = (currentStep / steps.length) * 100

  const handleNext = async () => {
    let isValid = true

    // Validate current step before proceeding
    switch (currentStep) {
      case 1:
        isValid = await form.trigger(['displayName', 'description', 'profileSlug'])
        break
      case 2:
        isValid = await form.trigger(['phone', 'officeAddress', 'city', 'state', 'pinCode', 'location'])
        break
      case 3:
        isValid = await form.trigger(['experienceYears', 'nmls', 'licenseStates'])
        break
    }

    if (isValid && currentStep < steps.length) {
      try {
        const response = await fetch('/api/broker-registration/onboarding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form.getValues(), currentStep: currentStep + 1 }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to save onboarding progress')
        setCurrentStep(prev => prev + 1)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to save onboarding progress')
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const onSubmit = async () => {
    try {
      setIsSubmitting(true)
      const data = form.getValues()
      const apiData = {
        displayName: data.displayName,
        companyName: data.companyName || data.displayName,
        description: data.description,
        profileSlug: data.profileSlug,
        logo: data.logo,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        website: data.website,
        officeAddress: data.officeAddress,
        city: data.city,
        state: data.state,
        pinCode: data.pinCode,
        location: data.location,
        experienceYears: data.experienceYears,
        nmls: data.nmls,
        licenseStates: data.licenseStates,
        registrationNumber: data.registrationNumber,
        panNumber: data.panNumber,
        profileImage: data.profileImage,
        coverImage: data.coverImage,
        documents: uploadedDocs
      }

      const response = await fetch('/api/brokers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create broker profile')
      }

      toast.success('Mortgage originator profile created successfully!')

      await refreshSession()

      router.push('/broker/dashboard')

    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1BasicInfo form={form} />
      case 2:
        return <Step2ContactInfo form={form} />
      case 3:
        return <Step3ProfessionalInfo form={form} />
      case 4:
        return <Step6Review form={form} onEditStep={(step: number) => setCurrentStep(step)} />
      default:
        return null
    }
  }

  const meta = STEP_META[currentStep] ?? STEP_META[1]

  return (
    <div className="w-full">
      {/* Progress region */}
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Stepper steps={steps} currentStep={currentStep} />
          <span className="shrink-0 text-sm font-medium text-muted-foreground">
            Step {currentStep} of {steps.length}
          </span>
        </div>
        <Progress value={progress} className="h-1.5" aria-label={`${Math.round(progress)} percent complete`} />
        <div>
          <h2 className="text-xl font-semibold text-foreground">{meta.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-5 sm:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {renderStep()}

              {/* Navigation Buttons */}
              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1 || isSubmitting}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>

                {currentStep < steps.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="gap-2"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Creating Profile...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Complete Setup
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}

// Step 1: Basic Information
function Step1BasicInfo({ form }: any) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company profile</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name *</FormLabel>
                <FormControl>
                  <Input placeholder="How you want to appear to clients" {...field} />
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
                  <Input placeholder="Your registered company name (optional)" {...field} />
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
                  <span className="mr-2 whitespace-nowrap text-sm text-muted-foreground">homeloanmarket.com/</span>
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
              <FormLabel>About You *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your expertise, experience, and services"
                  rows={4}
                  className="resize-none"
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
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile media</h3>
          <span className="text-xs text-muted-foreground">Optional</span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Logo Upload */}
          <FormField
            control={form.control}
            name="logo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Logo</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap items-center gap-3">
                    <ImageUpload value={field.value} onChange={field.onChange} type="logo" />
                    {field.value && (
                      <Button type="button" variant="outline" size="sm" onClick={() => field.onChange('')}>
                        Remove
                      </Button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Profile Photo Upload */}
          <FormField
            control={form.control}
            name="profileImage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile Photo</FormLabel>
                <FormControl>
                  <div className="flex flex-wrap items-center gap-3">
                    <ImageUpload value={field.value} onChange={field.onChange} type="profile" />
                    {field.value && (
                      <Button type="button" variant="outline" size="sm" onClick={() => field.onChange('')}>
                        Remove
                      </Button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Cover Photo Upload */}
          <FormField
            control={form.control}
            name="coverImage"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Cover Photo</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <ImageUpload value={field.value} onChange={field.onChange} type="cover" aspectRatio="cover" />
                    {field.value && (
                      <Button type="button" variant="outline" size="sm" onClick={() => field.onChange('')}>
                        Remove Cover
                      </Button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Upload from your device only — PNG, JPG, or WEBP up to 5MB. Recommended: logo and profile 400×400px, cover 1600×500px.
        </p>
      </div>
    </div>
  )
}

// Step 2: Contact Information
function Step2ContactInfo({ form }: any) {
  return (
    <div className="space-y-6">
      {/* Office Location — the picker owns its label + confirmed-value panel */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Office location</h3>
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
                    } else {
                      // Clearing the selected place clears the derived address
                      // fields so a mismatched combination is never persisted.
                      form.setValue('officeAddress', '')
                      form.setValue('city', '')
                      form.setValue('state', '')
                      form.setValue('pinCode', '')
                      form.setValue('location', undefined)
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact details</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="+1 (555) 123-4560" className="pl-9" {...field} />
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

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" placeholder="contact@company.com" className="pl-9" {...field} />
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
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="https://example.com" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  )
}

// Step 3: Licensing & Experience
function Step3ProfessionalInfo({ form }: any) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Experience</h3>
        <FormField
          control={form.control}
          name="experienceYears"
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel>Years of Experience *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type="number" min="0" max="50" className="pl-9" {...field} />
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Licensing</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="nmls"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NMLS ID *</FormLabel>
                <FormControl>
                  <Input placeholder="12345678" inputMode="numeric" {...field} />
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
                  <div className="space-y-2">
                    <Select
                      onValueChange={(value) => {
                        const current = field.value || []
                        if (!current.includes(value)) field.onChange([...current, value])
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Add a licensed state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.filter((state) => !(field.value || []).includes(state.code)).map((state) => (
                          <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1.5">
                      {(field.value || []).map((code: string) => (
                        <Badge key={code} variant="outline" className="gap-1 py-1 px-2.5">
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          License States are the states where you report being licensed. NMLS format validation does not perform
          external NMLS verification.
        </p>
      </div>
    </div>
  )
}

// Step 4: Review
function Step6Review({ form, onEditStep }: any) {
  const formValues = form.getValues()

  const formatValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None'
    }
    return value || 'Not provided'
  }

  const sections = [
    {
      title: 'Profile',
      icon: Building,
      step: 1,
      fields: [
        { label: 'Display Name', value: formValues.displayName },
        { label: 'Company Name', value: formValues.companyName || 'Not provided' },
        { label: 'Profile URL', value: `homeloanmarket.com/${formValues.profileSlug}` },
        { label: 'About', value: formValues.description },
      ]
    },
    {
      title: 'Contact & Office',
      icon: Phone,
      step: 2,
      fields: [
        { label: 'Phone', value: formValues.phone },
        { label: 'WhatsApp', value: formValues.whatsapp || 'Not provided' },
        { label: 'Business Email', value: formValues.email || 'Not provided' },
        { label: 'Website', value: formValues.website || 'Not provided' },
        { label: 'Office Address', value: formValues.officeAddress },
        { label: 'City / State / ZIP', value: [formValues.city, formValues.state, formValues.pinCode].filter(Boolean).join(', ') },
      ]
    },
    {
      title: 'Licensing',
      icon: Shield,
      step: 3,
      fields: [
        { label: 'Years of Experience', value: `${formValues.experienceYears} years` },
        { label: 'NMLS ID', value: formValues.nmls || 'Not provided' },
        { label: 'License States', value: formatValue(formValues.licenseStates) },
      ]
    },
    {
      title: 'Profile Media',
      icon: Briefcase,
      step: 1,
      fields: [
        { label: 'Profile Photo', value: formValues.profileImage ? 'Uploaded' : 'Not provided' },
        { label: 'Cover Photo', value: formValues.coverImage ? 'Uploaded' : 'Not provided' },
        { label: 'Company Logo', value: formValues.logo ? 'Uploaded' : 'Not provided' },
      ]
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-success" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-foreground">Review your information</h3>
      </div>

      <div className="space-y-3">
        {sections.map((section, index) => (
          <div key={index} className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <section.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h4 className="text-sm font-medium text-foreground">{section.title}</h4>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(section.step)}
              >
                Edit
              </Button>
            </div>
            <dl className="grid gap-x-6 gap-y-2.5 px-4 py-3 sm:grid-cols-2">
              {section.fields.map((field, idx) => (
                <div key={idx} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="truncate text-sm font-medium text-foreground">{formatValue(field.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
        <div className="flex items-start gap-2.5">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <div className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">After you submit</p>
            <ul className="space-y-1">
              <li>Your application will be reviewed within 2–3 business days.</li>
              <li>You will receive email updates about your verification status.</li>
              <li>You can update your profile information anytime after verification.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}