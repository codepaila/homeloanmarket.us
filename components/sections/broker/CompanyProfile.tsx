// components/sections/broker/CompanyProfile.tsx
'use client'

import { useState, useEffect } from 'react'
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
  Upload,
  FileText,
  Shield,
  CheckCircle,
  Star,
  Languages,
  ArrowLeft,
  Crown,
  AlertCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import Link from 'next/link'

// Company Profile Schema
const companyProfileSchema = z.object({
  // Company Information
  companyName: z.string().optional(),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  profileSlug: z.string().min(2, 'Profile slug must be at least 2 characters'),
  
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
  
  // Profile settings
  isVisible: z.boolean().default(true),
})

type CompanyProfileFormData = z.infer<typeof companyProfileSchema>

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

const indianCities = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
  'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
  'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte',
  'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Washington DC'
]

const languageOptions = ['English', 'Spanish']

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

interface CompanyProfileProps {
  user: any
  broker: any
}

export function CompanyProfile({ user, broker }: CompanyProfileProps) {
  const router = useRouter()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoPreview, setLogoPreview] = useState(broker?.logo || '')
  const [coverPreview, setCoverPreview] = useState(broker?.coverImage || '')
  const [newSpec, setNewSpec] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newLang, setNewLang] = useState('')
  const [newBank, setNewBank] = useState('')
  const [bankPartnerships, setBankPartnerships] = useState<string[]>([])
  
  // Check subscription for restrictions
  const hasActiveSubscription = broker?.subscription?.isActive || false
  const subscriptionPlan = broker?.subscription?.plan || 'FREE'
  const maxServiceCities = hasActiveSubscription ? Infinity : 1
  const canAddMultipleCities = hasActiveSubscription

  // Load bank partnerships
  useEffect(() => {
    if (broker?.bankPartners) {
      const banks = broker.bankPartners.map((bank: any) => bank.bankName)
      setBankPartnerships(banks)
    }
  }, [broker])

  const form = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileSchema) as any,
    defaultValues: {
      companyName: broker?.companyName || '',
      description: broker?.description || '',
      profileSlug: broker?.profileSlug || '',
      
      phone: broker?.phone || '',
      whatsapp: broker?.whatsapp || '',
      email: broker?.email || '',
      website: broker?.website || '',
      
      officeAddress: broker?.officeAddress || '',
      city: broker?.city || '',
      state: broker?.state || '',
      zipCode: broker?.zipCode || '',
      
      experienceYears: broker?.experienceYears || 0,
      specializations: broker?.specializations || ['Home Loan'],
      serviceCities: broker?.serviceCities || [],
      languages: broker?.languages || ['English', 'Hindi'],
      
      registrationNumber: broker?.registrationNumber || '',
      panNumber: broker?.panNumber || '',
      
      isVisible: broker?.isVisible ?? true,
    }
  })

  const currentServiceCities = form.watch('serviceCities') || []

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')

      const response = await fetch('/api/brokers/me/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setLogoPreview(data.url)
        toast.success('Logo uploaded successfully')
      } else {
        toast.error('Failed to upload logo')
      }
    } catch (error) {
      toast.error('Error uploading logo')
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'cover')

      const response = await fetch('/api/brokers/me/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setCoverPreview(data.url)
        toast.success('Cover image uploaded successfully')
      } else {
        toast.error('Failed to upload cover image')
      }
    } catch (error) {
      toast.error('Error uploading cover image')
    }
  }

  const handleAddItem = (field: keyof CompanyProfileFormData, value: string) => {
    const current = form.getValues(field) as string[]
    if (value.trim() && !current.includes(value.trim())) {
      form.setValue(field, [...current, value.trim()])
    }
  }

  const handleRemoveItem = (field: keyof CompanyProfileFormData, value: string) => {
    const current = form.getValues(field) as string[]
    form.setValue(field, current.filter(item => item !== value))
  }

  const handleAddBankPartnership = () => {
    if (newBank.trim() && !bankPartnerships.includes(newBank.trim())) {
      setBankPartnerships([...bankPartnerships, newBank.trim()])
      setNewBank('')
    }
  }

  const handleRemoveBankPartnership = (bank: string) => {
    setBankPartnerships(bankPartnerships.filter(b => b !== bank))
  }

  const saveBankPartnerships = async () => {
    try {
      const response = await fetch(`/api/brokers/${broker?.id}/banks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankPartnerships.map(bank => ({
          bankName: bank,
          bankType: 'PRIVATE' // Default
        }))),
      })

      if (response.ok) {
        toast.success('Bank partnerships saved')
      } else {
        toast.error('Failed to save bank partnerships')
      }
    } catch (error) {
      toast.error('Error saving bank partnerships')
    }
  }

  const onSubmit = async (data: CompanyProfileFormData) => {
    try {
      setIsSubmitting(true)

      // Validate service cities limit for free users
      if (!hasActiveSubscription && data.serviceCities.length > maxServiceCities) {
        toast.error(`Free Plan limited to ${maxServiceCities} service city. Please upgrade to add more cities.`)
        return
      }

      const payload = {
        ...data,
        logo: logoPreview,
        coverImage: coverPreview,
        bankPartnerships: bankPartnerships
      }

      const response = await fetch('/api/brokers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update profile')
      }

      // Save bank partnerships
      if (bankPartnerships.length > 0) {
        await saveBankPartnerships()
      }

      toast.success('Company profile updated successfully!')
      
      // Refresh to get updated data
      router.refresh()
      
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/broker/profile')}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Button>
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/broker/profile/personal">
              Edit Personal Profile
            </Link>
          </Button>
        </div>
      </div>

      {/* Subscription Banner */}
      {!hasActiveSubscription && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-warning" />
              <div>
                <h4 className="font-medium text-warning">Free Plan Limitations</h4>
                <p className="text-sm text-amber-700">
                  You can only add {maxServiceCities} service city on the free plan
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              asChild
            >
              <Link href="/broker/subscription">
                Upgrade
              </Link>
            </Button>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Branding Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Branding
              </CardTitle>
              <CardDescription>
                Add your company logo and cover image
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cover Image */}
              <div className="space-y-4">
                <FormLabel>Cover Image</FormLabel>
                <div className="relative h-48 w-full rounded-lg border-2 border-dashed border-border overflow-hidden">
                  {coverPreview ? (
                    <img 
                      src={coverPreview} 
                      alt="Cover" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center bg-muted">
                      <Building className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Upload cover image</p>
                    </div>
                  )}
                  <label 
                    htmlFor="cover-upload"
                    className="absolute bottom-4 right-4 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90"
                  >
                    <Upload className="h-4 w-4 inline mr-1" />
                    Upload
                    <input
                      id="cover-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Logo */}
              <div className="space-y-4">
                <FormLabel>Company Logo</FormLabel>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border overflow-hidden">
                      {logoPreview ? (
                        <img 
                          src={logoPreview} 
                          alt="Logo" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-muted">
                          <Building className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <label 
                      htmlFor="logo-upload"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4 text-white" />
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload your company logo (Recommended: 400×400px)
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLogoPreview('')}
                    >
                      Remove Logo
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Basic details about your company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
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

                <FormField
                  control={form.control}
                  name="profileSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile URL *</FormLabel>
                      <FormControl>
                        <div className="flex items-center">
                           <span className="text-muted-foreground mr-2">homeloanmarket.com/</span>
                          <Input 
                            placeholder="your-profile" 
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, '-')
                                .replace(/-+/g, '-')
                                .replace(/^-|-$/g, '')
                              field.onChange(value)
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your public profile URL
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
                    <FormLabel>Company Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your company, expertise, and services"
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
                         <Input placeholder="XX-XXXXXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                How clients can reach you
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
                        <div className="flex items-center">
                          <Phone className="absolute ml-3 h-4 w-4 text-muted-foreground" />
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
                        <div className="flex items-center">
                          <Mail className="absolute ml-3 h-4 w-4 text-muted-foreground" />
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
                        <div className="flex items-center">
                          <Globe className="absolute ml-3 h-4 w-4 text-muted-foreground" />
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
                      <div className="flex items-center">
                        <MapPin className="absolute ml-3 h-4 w-4 text-muted-foreground" />
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

              <div className="grid gap-4 md:grid-cols-4">
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

          {/* Professional Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Professional Details</CardTitle>
              <CardDescription>
                Your expertise and service areas
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
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Specializations *</h4>
                    <p className="text-sm text-muted-foreground">Loan types you specialize in</p>
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="specializations"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex gap-2">
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
                                    setNewSpec('')
                                  }
                                }}
                                className="w-48"
                              />
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => {
                                  handleAddItem('specializations', newSpec)
                                  setNewSpec('')
                                }}
                                disabled={!newSpec.trim()}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Service Cities with subscription restriction */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Service Cities</h4>
                    <p className="text-sm text-muted-foreground">
                      Cities where you provide services
                      {!hasActiveSubscription && (
                        <span className="text-warning ml-1">
                          (Limited to {maxServiceCities} city on free plan)
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {currentServiceCities.length} / {maxServiceCities} selected
                  </span>
                </div>
                
                <FormField
                  control={form.control}
                  name="serviceCities"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Select 
                              onValueChange={(value) => {
                                if (currentServiceCities.length < maxServiceCities) {
                                  handleAddItem('serviceCities', value)
                                } else {
                                  toast.error(`Free Plan limited to ${maxServiceCities} city. Upgrade to add more.`)
                                }
                              }}
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
                                {indianCities.map((city) => (
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
                            {canAddMultipleCities && (
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Custom city"
                                  value={newCity}
                                  onChange={(e) => setNewCity(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddItem('serviceCities', newCity)
                                      setNewCity('')
                                    }
                                  }}
                                  className="w-48"
                                />
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  onClick={() => {
                                    handleAddItem('serviceCities', newCity)
                                    setNewCity('')
                                  }}
                                  disabled={!newCity.trim()}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {!hasActiveSubscription && currentServiceCities.length >= maxServiceCities && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-warning" />
                                <p className="text-sm text-warning">
                                  Free Plan limited to 1 service city.{" "}
                                  <Button
                                    type="button"
                                    variant="link"
                                    className="p-0 h-auto text-warning underline"
                                    asChild
                                  >
                                    <Link href="/broker/subscription">
                                      Upgrade to add more cities
                                    </Link>
                                  </Button>
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Languages */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Languages *</h4>
                    <p className="text-sm text-muted-foreground">Languages you can communicate in</p>
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="languages"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <div className="space-y-3">
                          <div className="flex gap-2">
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
                                    setNewLang('')
                                  }
                                }}
                                className="w-48"
                              />
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => {
                                  handleAddItem('languages', newLang)
                                  setNewLang('')
                                }}
                                disabled={!newLang.trim()}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bank Partnerships Card */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Partnerships</CardTitle>
              <CardDescription>
                Banks you have tie-ups with
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Select 
                    value={newBank} 
                    onValueChange={setNewBank}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankOptions.map((bank) => (
                        <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddBankPartnership}
                    disabled={!newBank.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {bankPartnerships.map((bank: string) => (
                    <Badge key={bank} variant="outline" className="gap-1 py-1.5 px-3">
                      <Banknote className="h-3 w-3" />
                      {bank}
                      <button
                        type="button"
                        onClick={() => handleRemoveBankPartnership(bank)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Control your profile visibility
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
                  className={broker?.verificationStatus === 'VERIFIED' ? 'bg-green-50 text-green-700 border-green-200 mb-2' : 'mb-2'}
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

          {/* Submit Buttons */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t pt-4">
            <div className="flex justify-between items-center">
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/broker/profile')}
                >
                  Cancel
                </Button>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset()
                    setLogoPreview(broker?.logo || '')
                    setCoverPreview(broker?.coverImage || '')
                    setBankPartnerships(broker?.bankPartners?.map((b: any) => b.bankName) || [])
                  }}
                  disabled={!form.formState.isDirty}
                >
                  Reset Changes
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Company Profile
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  )
}