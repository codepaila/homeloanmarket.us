/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sections/broker/BrokerSetupWizard.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
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
  MapPin,
  Check,
  CreditCard,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { US_STATES } from '@/lib/us-states'
import { isValidUsZip } from '@/lib/location/broker-location'
import ImageUpload from '@/components/ImageUpload'
import { USLocationPicker, type SelectedUSLocation } from '@/components/location/USLocationPicker'
import { PricingCard } from '@/components/design/PricingCard'
import type { LucideIcon } from 'lucide-react'

type StepDef = { id: number; title: string; icon: LucideIcon }

// Step 1 Schema - Basic Profile
const basicInfoSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  companyName: z.string().optional(),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  logo: z.string().optional(),
  profileImage: z.string().optional(),
  // coverImage: z.string().optional(),
})

// Step 2 Schema - Contact Information (independently saveable; later-step
// fields such as NMLS, license states, and the Google-resolved location are
// owned by their own steps and never block this one).
const contactInfoSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 digits').optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
})

// Step 3 Schema - Professional Details
const professionalSchema = z.object({
  experienceYears: z.coerce.number().min(0, 'Experience cannot be negative').max(50, 'Maximum 50 years'),
  // NMLS ID is required to complete US broker onboarding (presence + format).
  nmls: z.string().trim().regex(/^\d{4,10}$/, 'NMLS ID must be 4–10 digits'),
  // At least one licensed US state is required.
  licenseStates: z.array(z.string()).min(1, 'Select at least one licensed state'),
})

// Step 4 Schema - Location / Service Area (Google-resolved US office location).
const locationSchema = z.object({
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
  // The structured address fields are derived from the Google place where
  // available, and completed manually only where Google is missing them.
  // officeAddress/city/state are validated as a group in handleNext (so each
  // missing field is reported with an actionable toast). ZIP is required at the
  // schema level: an empty ZIP keeps the user on the Location step with the
  // inline "ZIP Code is required." error under the field. `isValidUsZip` is the
  // canonical US ZIP rule (5 digits or 5+4) shared with the server-side
  // finalization contract — the user may NOT advance until the ZIP is valid.
  officeAddress: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  pinCode: z.string().trim().min(1, 'ZIP Code is required.').refine(isValidUsZip, 'Please enter a valid US ZIP code.'),
})

// Step 4a Schema - Registration Details (retained for backward-compatible
// payload shape; not part of the customer-visible step flow).
const registrationSchema = z.object({
  registrationNumber: z.string().optional(),
  // US tax identifier (EIN / individual tax ID). The underlying field name
  // stays `panNumber` for backward compatibility; it is displayed as a US tax
  // identifier and never reinterpreted as an India PAN.
  panNumber: z.string().max(20, 'Tax ID / EIN must be 20 characters or fewer').optional().or(z.literal('')),
})

// Step 5 Schema - Verification Documents (retained for payload stability).
const documentsSchema = z.object({
  panCard: z.string().optional().or(z.literal('')),
  addressProof: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof basicInfoSchema> &
  z.infer<typeof contactInfoSchema> &
  z.infer<typeof professionalSchema> &
  z.infer<typeof locationSchema> &
  z.infer<typeof registrationSchema> &
  z.infer<typeof documentsSchema>

const steps: StepDef[] = [
  { id: 1, title: 'Basic Profile', icon: Building },
  { id: 2, title: 'Contact', icon: Phone },
  { id: 3, title: 'Professional & Licensing', icon: Shield },
  { id: 4, title: 'Location', icon: MapPin },
  { id: 5, title: 'Review', icon: CheckCircle },
  { id: 6, title: 'Plan', icon: CreditCard },
]

// Step-level heading + description shown under the progress bar.
const STEP_META: Record<number, { title: string; description: string }> = {
  1: { title: 'Basic Profile', description: 'Tell buyers who you are and set up your public profile.' },
  2: { title: 'Contact Information', description: 'How clients can reach you. Each step saves independently.' },
  3: { title: 'Professional & Licensing', description: 'Add your NMLS ID and the states where you hold a mortgage license.' },
  4: { title: 'Office Location', description: 'Select a validated US office location for your marketplace listing.' },
  5: { title: 'Review your information', description: 'Confirm everything is correct before completing your profile.' },
  6: { title: 'Subscription Plan', description: 'Choose the plan that works best for your business.' },
}

// Success message shown once AFTER a step's draft save actually succeeds. The
// message is keyed by the CURRENT step being saved (not the next one), so the
// Location step reports "Office location saved successfully." and never claims
// success before the PATCH response arrives.
const STEP_SUCCESS_MESSAGES: Record<number, string> = {
  1: 'Basic profile saved successfully.',
  2: 'Contact information saved successfully.',
  3: 'Professional details saved successfully.',
  4: 'Office location saved successfully.',
  5: 'Profile reviewed successfully.',
}

interface BrokerSetupWizardProps {
  user: any
  initialData?: Partial<FormData>
  initialStep?: number
  subscription?: { isActive?: boolean | null; status?: string | null; plan?: string | null } | null
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

export function BrokerSetupWizard({ initialData = {}, initialStep = 1, subscription = null }: BrokerSetupWizardProps) {
  const router = useRouter()
  const { update: refreshSession } = useSession()
  // Clamp the server-persisted step into the canonical step range so a stale
  // draft (from an older wizard revision) always resumes on a real step.
  const [currentStep, setCurrentStep] = useState(
    Math.min(Math.max(Number.isInteger(initialStep) ? initialStep : 1, 1), steps.length),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Per-step save guard: prevents double-click duplicate PATCH requests and
  // drives the "Saving…" state on the Continue button.
  const [savingStep, setSavingStep] = useState(false)
  // Used to bring the Location step into view when its validation fails so the
  // user always sees WHY Next did not advance.
  const locationSectionRef = useRef<HTMLDivElement>(null)
  // Set when the Step 6 FREE flow activates the subscription, so onSubmit can
  // finalize before the server-rendered `subscription` prop refreshes. A plain
  // state (not a ref) keeps onSubmit form/ref-hook linter friendly. See the
  // guard in onSubmit.
  const [freeActivatedOverride, setFreeActivatedOverride] = useState(false)
  const markFreeActivated = () => setFreeActivatedOverride(true)
  // Verification document uploads are not part of the current flow; the field
  // is retained so the completion payload shape stays stable.
  const uploadedDocs: Record<string, { name: string; url: string }> = {}

  const form = useForm<FormData>({
    resolver: zodResolver(
      basicInfoSchema
        .merge(contactInfoSchema)
        .merge(professionalSchema)
        .merge(locationSchema)
        .merge(registrationSchema)
        .merge(documentsSchema)
    ) as any,
    defaultValues: {
      displayName: '',
      companyName: '',
      description: '',
      logo: '',
      profileImage: '',
      phone: '',
      whatsapp: '',
      email: '',
      website: '',
      experienceYears: 0,
      nmls: '',
      licenseStates: [],
      location: undefined,
      officeAddress: '',
      city: '',
      state: '',
      pinCode: '',
      registrationNumber: '',
      panNumber: '',
      panCard: '',
      addressProof: '',
      ...restoreInitialData(initialData),
    }
  })

  const progress = (currentStep / steps.length) * 100

  // Persist an EXPLICITLY cleared office location into the onboarding draft so
  // the cleared state survives a refresh/resume. `location` is sent as null —
  // JSON serialization drops undefined values, which would leave the stale
  // draft location (e.g. Dallas, TX) in place and resurrect it on reload.
  // Guarded by `savingStep` so this save can never race/overwrite a Next save.
  const persistClearedLocation = async () => {
    if (savingStep) return
    setSavingStep(true)
    try {
      const response = await fetch('/api/broker-registration/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: null,
          officeAddress: '',
          city: '',
          state: '',
          pinCode: '',
          currentStep,
        }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        console.warn('[LOCATION] clearing could not be persisted:', result?.error || 'Unknown error')
      }
    } catch (error) {
      // Best-effort persistence: the cleared local state remains authoritative
      // for the current session; the next successful save corrects the draft.
      console.warn('[LOCATION] clearing could not be persisted:', error)
    } finally {
      setSavingStep(false)
    }
  }

  const handleNext = async () => {
    let isValid = true

    // Validate only the fields owned by the current step. Later-step fields
    // never block an earlier step, so a valid Contact step always advances.
    switch (currentStep) {
      case 1:
        isValid = await form.trigger(['displayName', 'description'])
        break
      case 2:
        isValid = await form.trigger(['phone', 'whatsapp', 'email', 'website'])
        break
      case 3:
        isValid = await form.trigger(['experienceYears', 'nmls', 'licenseStates'])
        break
      case 4:
        isValid = await form.trigger(['location', 'officeAddress', 'city', 'state', 'pinCode'])
        break
      case 5:
        // Review -> Plan gate: validate the ENTIRE profile before the user can
        // reach plan selection. An incomplete profile/location must never reach
        // Step 6. This reuses the existing per-step schemas (no duplicate rules).
        isValid = await form.trigger()
        break
    }

    // NEVER advance silently: a validation failure must always tell the user
    // why Next did nothing and keep them on the current step.
    if (!isValid) {
      if (currentStep === 4) {
        // Field-by-field validation of the Location step with actionable,
        // accurate feedback. The derived address fields are completed manually
        // only where Google is missing them, so each missing/invalid field is
        // reported precisely rather than as a generic failure.
        const locationValue = form.getValues('location') as SelectedUSLocation | undefined
        const address = (form.getValues('officeAddress') || '').trim()
        const city = (form.getValues('city') || '').trim()
        const state = (form.getValues('state') || '').trim()
        const zip = (form.getValues('pinCode') || '').trim()

        if (!locationValue || !locationValue.placeId) {
          toast.error('Please select your office location from the Google suggestions.')
        } else if (typeof locationValue.latitude !== 'number' || typeof locationValue.longitude !== 'number'
            || Number.isNaN(locationValue.latitude) || Number.isNaN(locationValue.longitude)) {
          // Coordinates always come from the selected Google place; a selected
          // place without valid coordinates cannot be saved.
          toast.error('The selected location is missing valid coordinates. Please select the exact match from the Google suggestions.')
        } else if (!address) {
          toast.error('Please enter your office address.')
        } else if (!city) {
          toast.error('Please enter your city.')
        } else if (!state) {
          toast.error('Please enter your state.')
        } else if (!zip) {
          toast.error("Google couldn't detect the ZIP code. Please enter it to continue.")
          // Focus the ZIP field so the inline "ZIP Code is required." error is
          // seen next to where the user needs to type.
          form.setFocus('pinCode')
        } else if (!/^\d{5}(-\d{4})?$/.test(zip)) {
          toast.error('Please enter a valid US ZIP code.')
          form.setFocus('pinCode')
        }
        // Bring the Location step into view so the inline field error is seen.
        requestAnimationFrame(() => locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      } else if (currentStep === 5) {
        // Review -> Plan gate failure. Distinguish an incomplete location from
        // an incomplete profile so the toast is actionable and accurate.
        const locationValue = form.getValues('location') as SelectedUSLocation | undefined
        const address = (form.getValues('officeAddress') || '').trim()
        const city = (form.getValues('city') || '').trim()
        const state = (form.getValues('state') || '').trim()
        const zip = (form.getValues('pinCode') || '').trim()
        const locationIncomplete = !locationValue?.placeId || !address || !city || !state || !zip
        toast.error(locationIncomplete
          ? 'Please complete your office location before choosing a plan.'
          : 'Please complete your broker profile before choosing a plan.')
      } else {
        toast.error('Please fix the highlighted fields before continuing.')
      }
      return
    }

    if (currentStep < steps.length) {
      // Double-submit protection: a single save in flight per step.
      if (savingStep) return
      setSavingStep(true)
      try {
        const response = await fetch('/api/broker-registration/onboarding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form.getValues(), currentStep: currentStep + 1 }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to save onboarding progress')
        setCurrentStep(prev => prev + 1)
        // Success feedback fires exactly once per successful user save (the
        // PATCH already succeeded above). Never shown before the response is ok.
        toast.success(STEP_SUCCESS_MESSAGES[currentStep])
      } catch (error) {
        const serverMessage = error instanceof Error && error.message ? error.message : ''
        if (currentStep === 4) {
          // Prefer the server's safe user-facing message (e.g. an auth/origin
          // error); fall back to a clear location-specific message for generic
          // or network failures.
          toast.error(serverMessage && serverMessage !== 'Unable to save onboarding progress'
            ? serverMessage
            : "We couldn't save your location. Please try again.")
        } else {
          toast.error(serverMessage || 'Unable to save onboarding progress')
        }
      } finally {
        setSavingStep(false)
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
      // Never finalize without an ACTIVE subscription. The server enforces this
      // too (POST /api/brokers), but the client must not issue the request if
      // the subscription is still pending/incomplete — the plan step wires the
      // finalize button only to the ACTIVE state.
      //
      // `freeActivatedOverride` is set by the Step 6 FREE flow: the FREE
      // endpoint just upserted an ACTIVE subscription server-side, but the
      // `subscription` prop is a server-render snapshot that hasn't refreshed
      // yet. The guard is bypassed ONLY then; a CHECKOUT_PENDING/FEATURED state
      // can never reach finalization.
      if (!(subscription?.isActive && subscription?.status === 'ACTIVE') && !freeActivatedOverride) {
        toast.error("We couldn't finish your broker setup. Please try again.")
        return
      }
      const data = form.getValues()
      const apiData = {
        displayName: data.displayName,
        companyName: data.companyName || data.displayName,
        description: data.description,
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
        // coverImage: data.coverImage,
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

      toast.success('Your broker profile is ready.')

      await refreshSession()

      router.push('/broker/dashboard')

    } catch (error: any) {
      // Never silently fail: surface the server reasons when available, with a
      // stable, actionable fallback for generic/network failures.
      toast.error(error?.message || "We couldn't finish your broker setup. Please try again.")
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
        return <Step4LocationInfo form={form} sectionRef={locationSectionRef} onClearLocation={persistClearedLocation} />
      case 5:
        return <Step6Review form={form} onEditStep={(step: number) => setCurrentStep(step)} />
      case 6:
        return (
          <Step6PlanSelection
            subscription={subscription}
            onFinalize={onSubmit}
            isSubmitting={isSubmitting}
            onFreeActivated={markFreeActivated}
          />
        )
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
      <div className="rounded border bg-card text-card-foreground shadow-sm">
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
                  disabled={currentStep === 1 || isSubmitting || savingStep}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>

                {currentStep < steps.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={savingStep}
                    className="gap-2"
                  >
                    {savingStep ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving…
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : null}
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
                <FormLabel>Full Name *</FormLabel>
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


        </div>

        <p className="text-xs text-muted-foreground">
          Upload from your device only — PNG, JPG, or WEBP up to 5MB. Recommended: logo and profile 400×400px, cover 1600×500px.
        </p>
      </div>
    </div>
  )
}

// Step 2: Contact Information (independently saveable; no later-step fields).
function Step2ContactInfo({ form }: any) {
  return (
    <div className="space-y-6">
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

// Step 4: Location / Service Area — Google-resolved US office location. The
// picker owns the validated place and derives the structured address fields.
// `onClearLocation` fires only for the explicit "Clear location" action and
// lets the wizard persist the cleared state so it survives a refresh.
//
// Manual-fallback preservation: when a NEW Google place is selected, Google-
// derived address/city/state/ZIP replace the old values, but any field the NEW
// Google result is missing keeps its current manually-entered value (e.g. a
// ZIP the broker typed for the previous selection). Stale values are never
// carried into a field the new result DOES provide.
function Step4LocationInfo({ form, sectionRef, onClearLocation }: any) {
  return (
    <div ref={sectionRef} className="space-y-6">
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
                  onClear={onClearLocation}
                  onChange={(location) => {
                    field.onChange(location)
                    if (location) {
                      // Google-derived values always replace the previous ones.
                      // Where the NEW result is missing a field, keep the
                      // current (possibly manually entered) value so a manual
                      // fallback survives a reselect.
                      const prev = form.getValues()
                      form.setValue('officeAddress', location.normalizedAddress || (prev.officeAddress || ''))
                      form.setValue('city', location.city || (prev.city || ''))
                      form.setValue('state', location.state || (prev.state || ''))
                      form.setValue('pinCode', location.zip || (prev.pinCode || ''))
                      // A Google-provided (or preserved manual) ZIP that is now
                      // valid clears any stale inline "ZIP Code is required."
                      // error immediately, so a prior failed Next never leaves a
                      // lingering error after the ZIP becomes valid.
                      if (isValidUsZip(form.getValues('pinCode'))) form.clearErrors('pinCode')
                    } else {
                      // Clearing the selected place resets EVERY derived address
                      // field and the canonical location field (including any
                      // prior validation error/dirty state) so no stale location
                      // or stale display can survive a clear.
                      //
                      // The canonical location must be set to `undefined` with
                      // setValue — NOT reset with resetField. resetField restores
                      // defaultValues, which merge the persisted draft via
                      // `...restoreInitialData(initialData)`, so a saved location
                      // (e.g. Dallas, TX) would be rehydrated and reappear after
                      // Clear. setValue(undefined) keeps the cleared value
                      // authoritative against any rerender / initialData replay.
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
        {/* Manual fallback fields. Shown only while a Google place is selected.
            Each field is auto-filled from Google when available; when Google is
            missing a value the broker can type it here. Values remain tied to
            the selected Google place (coordinates/placeId are never editable),
            and editing never replaces the Google selection. */}
        {(() => {
          const selected = form.watch('location') as SelectedUSLocation | undefined
          return selected && selected.placeId ? (
          <div className="space-y-4 rounded-md border p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Complete any fields Google couldn&apos;t detect. Your selection stays tied to the Google place above.
            </p>
            <FormField
              control={form.control}
              name="officeAddress"
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Office Address *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Street address"
                      {...f}
                      value={f.value || ''}
                      aria-label="Office address"
                    />
                  </FormControl>
                  <FormDescription>
                    {f.value ? 'Detected by Google' : 'Enter manually — Google couldn\'t detect this value.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="city"
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...f} value={f.value || ''} aria-label="City" />
                    </FormControl>
                    <FormDescription>
                      {f.value ? 'Detected by Google' : 'Enter manually — Google couldn\'t detect this value.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>State *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. FL" {...f} value={f.value || ''} aria-label="State" />
                    </FormControl>
                    <FormDescription>
                      {f.value ? 'Detected by Google' : 'Enter manually — Google couldn\'t detect this value.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pinCode"
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>ZIP Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="12345 or 12345-6789"
                        inputMode="numeric"
                        {...f}
                        value={f.value || ''}
                        aria-label="ZIP Code"
                        onChange={(event) => {
                          f.onChange(event)
                          // The moment the typed ZIP is valid, clear the stale
                          // inline error so "ZIP Code is required." never lingers
                          // after the user corrects the field.
                          if (isValidUsZip(event.target.value)) form.clearErrors('pinCode')
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {f.value ? 'Detected by Google' : "Google couldn't detect the ZIP code. Please enter the ZIP code for this office."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          ) : null
        })()}
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

        <div className="grid gap-4 md:grid-cols-2 items-start">
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
      title: 'Basic Profile',
      icon: Building,
      step: 1,
      fields: [
        { label: 'Full Name', value: formValues.displayName },
        { label: 'Company Name', value: formValues.companyName || 'Not provided' },
        { label: 'About', value: formValues.description },
      ]
    },
    {
      title: 'Contact',
      icon: Phone,
      step: 2,
      fields: [
        { label: 'Phone', value: formValues.phone },
        { label: 'WhatsApp', value: formValues.whatsapp || 'Not provided' },
        { label: 'Business Email', value: formValues.email || 'Not provided' },
        { label: 'Website', value: formValues.website || 'Not provided' },
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
      title: 'Location',
      icon: MapPin,
      step: 4,
      fields: [
        { label: 'Office Address', value: formValues.officeAddress },
        { label: 'City / State / ZIP', value: [formValues.city, formValues.state, formValues.pinCode].filter(Boolean).join(', ') },
        { label: 'Source', value: formValues.location && formValues.location.placeId ? 'Google-verified location' : 'Not selected' },
      ]
    },
    {
      title: 'Profile Media',
      icon: Briefcase,
      step: 1,
      fields: [
        { label: 'Profile Photo', value: formValues.profileImage ? 'Uploaded' : 'Not provided' },
        // { label: 'Cover Photo', value: formValues.coverImage ? 'Uploaded' : 'Not provided' },
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
          <div key={index} className="overflow-hidden rounded border">
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

     
    </div>
  )
}

// Step 6: Subscription Plan Selection — FREE or FEATURED (Mortgage Expert).
//
// Plans are resolved from the canonical broker plan system (GET
// /api/subscription/plans → BrokerSubscriptionPlan table) — never hardcoded.
// Selecting a plan reuses the existing registration subscription endpoints:
//   - FREE             → POST /api/broker-registration/subscription/free
//   - FEATURED         → POST /api/broker-registration/subscription/checkout
// The FEATURED checkout flow preserves CHECKOUT_PENDING/ACTIVE states and the
// Stripe webhook's authority. Finalization always goes through `onFinalize`
// (POST /api/brokers → finalizeBrokerRegistration) and only happens when the
// subscription is ACTIVE — never merely because checkout was started.
type PublicPlan = {
  id: string
  code: string
  name: string
  description: string | null
  price: number // cents
  currency: string
  billingInterval: string
  displayOrder: number
  stripePriceId: string | null
  isActive: boolean
  features: string[]
}

function Step6PlanSelection({ subscription, onFinalize, isSubmitting, onFreeActivated }: any) {
  const router = useRouter()
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  // The `subscription` prop is a server-render snapshot and does not update
  // after the FREE POST. When FREE is activated, this flag bridges the gap so
  // the finalize button appears without needing a refresh.
  const [freeActivated, setFreeActivated] = useState(false)

  const isActive = Boolean(subscription?.isActive && subscription?.status === 'ACTIVE')
  const isCheckoutPending = subscription?.status === 'CHECKOUT_PENDING' && !isActive
  const canFinalize = isActive || freeActivated

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch('/api/subscription/plans')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load plans')
        if (!active) return
        const loadedPlans = Array.isArray(data.plans) ? data.plans : []
        setPlans(loadedPlans.filter((p: PublicPlan) => ['FREE', 'FEATURED'].includes(p.code)))
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'This subscription plan is currently unavailable. Please try again.')
      } finally {
        if (active) setLoadingPlans(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  async function selectFree() {
    if (actionLoading) return
    setActionLoading('FREE')
    setError('')
    try {
      const response = await fetch('/api/broker-registration/subscription/free', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to select FREE')
      setFreeActivated(true)
      onFreeActivated?.()
      toast.success('Free plan selected. Finalizing your broker profile…')
      // Reconcile the server-rendered subscription prop so a future mount of
      // this step (Back → Continue) shows the ACTIVE state directly.
      router.refresh()
      // onFinalize → POST /api/brokers → finalizeBrokerRegistration. The parent
      // freeActivatedOverride bypasses the stale-prop guard because FREE just
      // activated the subscription server-side. onSubmit never rejects — it
      // reports its own toasts — so a finalize failure keeps the user on this
      // step with the finalize button still available.
      await onFinalize()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "We couldn't finish your broker setup. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setActionLoading(null)
    }
  }

  async function selectFeatured(plan: PublicPlan) {
    if (actionLoading) return
    setActionLoading('FEATURED')
    setError('')
    try {
      const response = await fetch('/api/broker-registration/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'FEATURED', priceId: plan.stripePriceId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "We couldn't start checkout. Please try again.")
      toast.success('Mortgage Expert selected. Redirecting you to secure checkout…')
      // The checkout endpoint always returns a Stripe Checkout URL; refuse to
      // silently leave the user stuck on a disabled card if it is ever absent.
      if (!data.url) throw new Error("We couldn't start checkout. Please try again.")
      window.location.assign(data.url)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "We couldn't start checkout. Please try again."
      setError(message)
      toast.error(message)
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Choose your plan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the plan that works best for your business. You can review or change details before finalizing.
        </p>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {loadingPlans ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading plans…
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.id}>
                <PricingCard
                  name={plan.name}
                  description={plan.description || ''}
                  price={plan.price / 100}
                  priceSuffix={`/${plan.billingInterval}`}
                  features={plan.features}
                  stripePriceId={plan.stripePriceId || undefined}
                  code={plan.code}
                  isPopular={plan.code === 'FEATURED'}
                  isCurrent={plan.code === 'FREE'
                    ? freeActivated || (isActive && subscription?.plan === 'FREE')
                    : isActive && subscription?.plan === 'FEATURED'}
                  onSelect={() => {
                    if (plan.code === 'FREE') void selectFree()
                    else void selectFeatured(plan)
                  }}
                  className={actionLoading === plan.code ? 'pointer-events-none opacity-60' : undefined}
                />
              </div>
            ))}
          </div>

          {/* CHECKOUT_PENDING resume state: no duplicate checkout is created —
              the existing checkout endpoint reuses open sessions. */}
          {isCheckoutPending && (
            <p className="text-center text-sm text-muted-foreground">
              Your FEATURED checkout is in progress. Select &quot;Mortgage Expert&quot; to resume, or choose Free to switch plans.
            </p>
          )}

          {/* Finalize appears ONLY when the subscription is ACTIVE — never when
              checkout merely started. FREE activates immediately; FEATURED
              becomes ACTIVE via the Stripe webhook / verify endpoint after the
              return from Stripe. */}
          {canFinalize && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                onClick={() => void onFinalize()}
                disabled={actionLoading !== null || isSubmitting}
                className="gap-2 px-8"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating Profile...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete Broker Profile
                  </>
                )}
              </Button>
            </div>
          )}

          {!isActive && !isCheckoutPending && (
            <p className="text-center text-xs text-muted-foreground">
              Selecting &quot;Free&quot; completes your profile immediately. Selecting &quot;Mortgage Expert&quot; opens secure checkout through Stripe.
            </p>
          )}
        </>
      )}
    </div>
  )
}
