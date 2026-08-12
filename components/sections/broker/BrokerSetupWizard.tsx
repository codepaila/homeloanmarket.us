/* eslint-disable @typescript-eslint/no-explicit-any */
// components/broker/BrokerSetupWizard.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
import { Progress } from '@/components/ui/progress'
import {
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Briefcase,
  Banknote,
  X,
  Plus,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Shield,
  FileText,
  Upload,
  Check,
  AlertCircle,
  Languages
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import ImageUpload from '@/components/ImageUpload'
import { USLocationPicker, type SelectedUSLocation } from '@/components/location/USLocationPicker'

// Step 1 Schema - Basic Information
const basicInfoSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  companyName: z.string().optional(),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  logo: z.string().optional(),
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
  zipCode: z.string().length(5, 'ZIP Code must be 5 digits'),
  location: z.object({
    placeId: z.string().optional(),
    normalizedAddress: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
})

// Step 3 Schema - Professional Details
const professionalSchema = z.object({
  experienceYears: z.coerce.number().min(0, 'Experience cannot be negative').max(50, 'Maximum 50 years'),
  specializations: z.array(z.string()).min(1, 'Select at least one specialization'),
  serviceCities: z.array(z.string()).min(1, 'Select at least one city'),
  languages: z.array(z.string()).min(1, 'Select at least one language'),
  bankPartnerships: z.array(z.string()),
})

// Step 4 Schema - Registration Details
const registrationSchema = z.object({
  registrationNumber: z.string().optional(),
  // registrationNumber: z.string().min(5, 'Registration number is required'),
  panNumber: z.string().length(10, 'Tax ID must be 10 characters').optional().or(z.literal('')),
  gstNumber: z.string().length(15, 'Tax ID must be 15 characters').optional().or(z.literal('')),
})

// Step 5 Schema - Verification Documents
const documentsSchema = z.object({
  panCard: z.string().optional().or(z.literal('')),
  aadhaarCard: z.string().optional().or(z.literal('')),
  addressProof: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof basicInfoSchema> &
  z.infer<typeof contactInfoSchema> &
  z.infer<typeof professionalSchema> &
  z.infer<typeof registrationSchema> &
  z.infer<typeof documentsSchema>

const steps = [
  { id: 1, title: 'Basic Info', icon: Building },
  { id: 2, title: 'Contact', icon: Phone },
  { id: 3, title: 'Professional', icon: Briefcase },
  // { id: 4, title: 'Registration', icon: Shield },
  // { id: 5, title: 'Documents', icon: FileText },
  { id: 4, title: 'Review', icon: CheckCircle },
]

interface BrokerSetupWizardProps {
  user: any
  initialData?: Partial<FormData>
  initialStep?: number
}

export function BrokerSetupWizard({ user, initialData = {}, initialStep = 1 }: BrokerSetupWizardProps) {
  const router = useRouter()
  const { update: refreshSession } = useSession()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { name: string; url: string }>>({})
  const [newSpec, setNewSpec] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newLang, setNewLang] = useState('')
  const [newBank, setNewBank] = useState('')

  // Common US cities for selection
  const usCities = [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
    'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
    'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte',
    'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Washington DC'
  ]

  // Specialization options
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

  // Language options
  const languageOptions = ['English', 'Spanish']

  // Bank options
  const bankOptions = [
    'Chase Bank',
    'Bank of America',
    'Wells Fargo',
    'Citibank',
    'U.S. Bank',
    'PNC Bank',
    'TD Bank',
    'Capital One',
    'Discover Bank',
    'Rocket Mortgage',
    'Fifth Third Bank',
    'KeyBank',
    'Regions Bank',
    'BBVA USA',
    'Santander Bank'
  ]

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
      profileSlug: '',
      phone: '',
      whatsapp: '',
      email: '',
      website: '',
      officeAddress: '',
      city: '',
      state: '',
       zipCode: '',
       location: undefined,
      experienceYears: 0,
       specializations: ['Home Purchase'],
      serviceCities: [],
       languages: ['English', 'Spanish'],
      bankPartnerships: [],
      registrationNumber: '',
      panNumber: '',
      gstNumber: '',
      panCard: '',
      aadhaarCard: '',
      addressProof: '',
      ...initialData,
    }
  })

  const progress = (currentStep / steps.length) * 100

  // Handle adding items to array fields
  const handleAddItem = (field: 'specializations' | 'serviceCities' | 'languages' | 'bankPartnerships', value: string) => {
    const current = form.getValues(field) as string[]
    const trimmedValue = value.trim()

    if (!trimmedValue) return

    if (!current.includes(trimmedValue)) {
      form.setValue(field, [...current, trimmedValue])
    }

    // Clear input
    switch (field) {
      case 'specializations': setNewSpec(''); break
      case 'serviceCities': setNewCity(''); break
      case 'languages': setNewLang(''); break
      case 'bankPartnerships': setNewBank(''); break
    }
  }

  // Handle removing items from array fields
  const handleRemoveItem = (field: 'specializations' | 'serviceCities' | 'languages' | 'bankPartnerships', value: string) => {
    const current = form.getValues(field) as string[]
    form.setValue(field, current.filter(item => item !== value))
  }

  const handleNext = async () => {
    let isValid = true

    // Validate current step before proceeding
    switch (currentStep) {
      case 1:
        isValid = await form.trigger(['displayName', 'description', 'profileSlug'])
        break
      case 2:
        isValid = await form.trigger(['phone', 'officeAddress', 'city', 'state', 'zipCode'])
        break
      case 3:
        isValid = await form.trigger(['experienceYears', 'specializations', 'serviceCities', 'languages'])
        break
      // case 4:
      //   isValid = await form.trigger(['registrationNumber'])
      //   break
      // case 5:
      //   const uploadedCount = Object.keys(uploadedDocs).length
      //   if (uploadedCount < 2) {
      //     toast.error('Please upload at least 2 documents for verification')
      //     isValid = false
      //   } else {
      //     isValid = true
      //   }
        // break
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

  // const handleUploadDocument = async (field: string, file: File) => {
  //   try {
  //     const mockUrl = URL.createObjectURL(file)
      
  //     setUploadedDocs(prev => ({
  //       ...prev,
  //       [field]: {
  //         name: file.name,
  //         url: mockUrl
  //       }
  //     }))

  //     form.setValue(field as any, mockUrl)
  //     toast.success(`${field.replace(/([A-Z])/g, ' $1')} uploaded successfully`)
  //   } catch (error) {
  //     toast.error('Failed to upload document')
  //   }
  // }

  // const handleRemoveDocument = (field: string) => {
  //   const newDocs = { ...uploadedDocs }
  //   delete newDocs[field]
  //   setUploadedDocs(newDocs)
  //   form.setValue(field as any, '')
  // }

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
        zipCode: data.zipCode,
        location: data.location,
        experienceYears: data.experienceYears,
        specializations: data.specializations,
        serviceCities: data.serviceCities,
        languages: data.languages,
        bankPartnerships: data.bankPartnerships,
        registrationNumber: data.registrationNumber,
        panNumber: data.panNumber,
        gstNumber: data.gstNumber,
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

      toast.success('Mortgage broker profile created successfully!')

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
        return (
          <Step3ProfessionalInfo 
            form={form}
            specializationOptions={specializationOptions}
            languageOptions={languageOptions}
            bankOptions={bankOptions}
            indianCities={usCities}
            newSpec={newSpec}
            setNewSpec={setNewSpec}
            newCity={newCity}
            setNewCity={setNewCity}
            newLang={newLang}
            setNewLang={setNewLang}
            newBank={newBank}
            setNewBank={setNewBank}
            handleAddItem={handleAddItem}
            handleRemoveItem={handleRemoveItem}
          />
        )
      // case 4:
      //   return <Step4RegistrationInfo form={form} />
      // case 5:
      //   return (
      //     <Step5Documents 
      //       form={form}
      //       uploadedDocs={uploadedDocs}
      //       onUpload={handleUploadDocument}
      //       onRemove={handleRemoveDocument}
      //     />
      //   )
      case 4:
        return <Step6Review form={form} uploadedDocs={uploadedDocs} />
      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Become a Verified Mortgage Broker</h1>
            <p className="text-muted-foreground mt-2">
              Complete your profile to start receiving loan applications and leads
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Step {currentStep} of {steps.length}</div>
            <div className="text-lg font-bold text-primary">
              {Math.round(progress)}% Complete
            </div>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
        
        {/* Step Indicators */}
        <div className="flex justify-between mt-4">
          {steps.map((step) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isCompleted = step.id < currentStep
            
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`
                  h-10 w-10 rounded-full flex items-center justify-center mb-2
                  ${isCompleted ? 'bg-success/15 text-success border-2 border-success/50' : 
                    isActive ? 'bg-primary text-white border-2 border-primary' : 
                    'bg-muted text-muted-foreground border-2 border-border'}
                `}>
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span className={`
                  text-sm font-medium
                  ${isActive ? 'text-primary' : 
                    isCompleted ? 'text-success' : 
                    'text-muted-foreground'}
                `}>
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const Icon = steps[currentStep - 1]?.icon || Building
              return <Icon className="h-6 w-6" />
            })()}
            {steps[currentStep - 1]?.title}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Tell us about your company'}
            {currentStep === 2 && 'Add your contact information'}
            {currentStep === 3 && 'Share your professional expertise'}
            {/* {currentStep === 4 && 'Add registration details'} */}
            {/* {currentStep === 5 && 'Upload verification documents'} */}
          {currentStep === 4 && 'Review and submit your application'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="overflow-visible">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {renderStep()}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6 border-t">
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
                        Create Profile
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Side Info Card */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Shield className="h-6 w-6 text-primary mt-1" />
            <div>
              <h3 className="font-medium text-foreground mb-2">Why Get Verified?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Get featured in broker directory</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Receive verified leads from borrowers</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Build trust with verification badge</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Access premium features and analytics</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Step 1: Basic Information
function Step1BasicInfo({ form }: any) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Company Information</h3>
        
        {/* Logo Upload */}
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
    </div>
  )
}

// Step 2: Contact Information
function Step2ContactInfo({ form }: any) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Contact Information</h3>

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
                      form.setValue('zipCode', location.zip)
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
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
      </div>
    </div>
  )
}

// Step 3: Professional Information
function Step3ProfessionalInfo({ 
  form, 
  specializationOptions, 
  languageOptions, 
  bankOptions, 
  indianCities,
  newSpec,
  setNewSpec,
  newCity,
  setNewCity,
  newLang,
  setNewLang,
  newBank,
  setNewBank,
  handleAddItem,
  handleRemoveItem 
}: any) {
  return (
    <div className="space-y-8">
      {/* Experience */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Professional Experience</h3>
        
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
      </div>

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
                 {specializationOptions.map((spec: string) => (
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

      {/* Service Cities */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-medium">Service Cities *</h4>
            <p className="text-sm text-muted-foreground">Cities where you provide services</p>
          </div>
          <span className="text-sm text-muted-foreground">
            {form.watch('serviceCities')?.length || 0} selected
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select onValueChange={(value) => handleAddItem('serviceCities', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add service city" />
              </SelectTrigger>
              <SelectContent>
                 {indianCities.map((city: string) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>

          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {form.watch('serviceCities')?.map((city: string) => (
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
                 {languageOptions.map((lang: string) => (
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

      <Separator />

      {/* Bank Partnerships */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-medium">Bank Partnerships</h4>
            <p className="text-sm text-muted-foreground">Banks you have tie-ups with (optional)</p>
          </div>
          <span className="text-sm text-muted-foreground">
            {form.watch('bankPartnerships')?.length || 0} selected
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select onValueChange={(value) => handleAddItem('bankPartnerships', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add bank partnership" />
              </SelectTrigger>
              <SelectContent>
                 {bankOptions.map((bank: string) => (
                  <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="Other bank"
                value={newBank}
                onChange={(e) => setNewBank(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddItem('bankPartnerships', newBank)
                  }
                }}
                className="min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddItem('bankPartnerships', newBank)}
                disabled={!newBank.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {form.watch('bankPartnerships')?.map((bank: string) => (
              <Badge key={bank} variant="outline" className="gap-1 py-1.5 px-3">
                <Banknote className="h-3 w-3" />
                {bank}
                <button
                  type="button"
                  onClick={() => handleRemoveItem('bankPartnerships', bank)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 4: Registration Information
function Step4RegistrationInfo({ form }: any) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Registration Details</h3>
        <p className="text-muted-foreground">
          Provide your registration details for verification
        </p>
        
        <FormField
          control={form.control}
          name="registrationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Registration Number *</FormLabel>
              <FormControl>
                 <Input placeholder="State registration or EIN" {...field} />
              </FormControl>
              <FormDescription>
                Your business registration number for verification
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
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

          <FormField
            control={form.control}
            name="gstNumber"
            render={({ field }) => (
              <FormItem>
                 <FormLabel>Tax ID / EIN</FormLabel>
                 <FormControl>
                   <Input placeholder="12-3456789" {...field} />
                 </FormControl>
                 <FormDescription>
                   9-digit Employer Identification Number
                 </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  )
}

// Step 5: Verification Documents
function Step5Documents({ form, uploadedDocs, onUpload, onRemove }: any) {
  const documents = [
    {
      id: 'panCard',
      label: 'Tax ID Document',
      description: 'Upload clear image of your tax ID document',
      required: true
    },
    {
      id: 'aadhaarCard',
      label: 'Government ID',
      description: 'Upload front and back of government-issued photo ID',
      required: true
    },
    {
      id: 'addressProof',
      label: 'Address Proof',
      description: 'Utility bill or bank statement',
      required: true
    }
  ]

  const handleFileChange = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(field, file)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Verification Documents</h3>
        <p className="text-muted-foreground">
          Upload required documents for verification. All documents are securely stored and only used for verification purposes.
        </p>
      </div>

      <div className="space-y-4">
        {documents.map((doc) => {
          const isUploaded = uploadedDocs[doc.id]
          
          return (
            <div key={doc.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    {doc.label}
                    {doc.required && <span className="text-xs text-destructive">*Required</span>}
                  </h4>
                  <p className="text-sm text-muted-foreground">{doc.description}</p>
                </div>
                
                {isUploaded ? (
                  <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="h-3 w-3" />
                    Uploaded
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Pending
                  </Badge>
                )}
              </div>
              
              {isUploaded ? (
                <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-success" />
                      <span className="font-medium text-success">{isUploaded.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(isUploaded.url, '_blank')}
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRemove(doc.id)}
                        className="text-destructive hover:text-destructive hover:border-destructive/40"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <label htmlFor={`upload-${doc.id}`}>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-foreground/25 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG up to 5MB</p>
                    </div>
                    <input
                      id={`upload-${doc.id}`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange(doc.id, e)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-info/10 border border-info/25 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-info mt-0.5" />
          <div>
            <h4 className="font-medium text-info mb-1">Document Security</h4>
            <ul className="text-sm text-info space-y-1">
              <li>• All documents are encrypted and securely stored</li>
              <li>• Documents are only used for verification purposes</li>
              <li>• We never share your documents with third parties</li>
              <li>• Verification typically takes 2-3 business days</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 6: Review
function Step6Review({ form, uploadedDocs }: any) {
  const formValues = form.getValues()

  const formatValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None'
    }
    return value || 'Not provided'
  }

  const sections = [
    {
      title: 'Basic Information',
      icon: Building,
      fields: [
        { label: 'Display Name', value: formValues.displayName },
        { label: 'Company Name', value: formValues.companyName || 'Not provided' },
        { label: 'Description', value: formValues.description },
        { label: 'Profile URL', value: `homeloanmarket.com/${formValues.profileSlug}` },
      ]
    },
    {
      title: 'Contact Details',
      icon: Phone,
      fields: [
        { label: 'Phone Number', value: formValues.phone },
        { label: 'WhatsApp Number', value: formValues.whatsapp || 'Not provided' },
        { label: 'Business Email', value: formValues.email || 'Not provided' },
        { label: 'Website', value: formValues.website || 'Not provided' },
        { label: 'Office Address', value: formValues.officeAddress },
        { label: 'City', value: formValues.city },
        { label: 'State', value: formValues.state },
        { label: 'ZIP Code', value: formValues.zipCode },
      ]
    },
    {
      title: 'Professional Information',
      icon: Briefcase,
      fields: [
        { label: 'Years of Experience', value: `${formValues.experienceYears} years` },
        { label: 'Specializations', value: formatValue(formValues.specializations) },
        { label: 'Service Cities', value: formatValue(formValues.serviceCities) },
        { label: 'Languages', value: formatValue(formValues.languages) },
        { label: 'Bank Partnerships', value: formatValue(formValues.bankPartnerships) },
      ]
    },
    // {
    //   title: 'Registration Details',
    //   icon: Shield,
    //   fields: [
    //     { label: 'Registration Number', value: formValues.registrationNumber },
    //     { label: 'Tax ID / EIN', value: formValues.gstNumber || 'Not provided' },
    //   ]
    // },
    // {
    //   title: 'Documents Uploaded',
    //   icon: FileText,
    //   fields: Object.keys(uploadedDocs).map(key => ({
    //     label: key.replace(/([A-Z])/g, ' $1').trim(),
    //     value: uploadedDocs[key].name
    //   }))
    // }
  ]

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Review Your Application</h3>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Please review all information before submitting. You can go back to any step to make changes.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((section, index) => (
          <div key={index} className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <section.icon className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium text-foreground">{section.title}</h4>
              </div>
            </div>
            <div className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {section.fields.map((field, idx) => (
                  <div key={idx}>
                    <div className="text-sm text-muted-foreground mb-1">{field.label}</div>
                    <div className="font-medium text-foreground">{formatValue(field.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Shield className="h-6 w-6 text-warning mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-yellow-900 mb-2">Important Information</h4>
            <ul className="space-y-2 text-sm text-yellow-800">
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-600 mt-1.5 flex-shrink-0" />
                <span>Your application will be reviewed within 2-3 business days</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-600 mt-1.5 flex-shrink-0" />
                <span>You will receive email updates about your verification status</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-600 mt-1.5 flex-shrink-0" />
                <span>Once verified, your profile will be visible in the broker directory</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-600 mt-1.5 flex-shrink-0" />
                <span>You can update your profile information anytime after verification</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
