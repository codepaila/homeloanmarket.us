/* eslint-disable @typescript-eslint/no-explicit-any */
// components/forms/BrokerContactForm.tsx
'use client'
import React, { useState, useEffect } from 'react'
import {
  GetCountries,
  GetCity,
  CitySelect,
  GetState,
  CountrySelect,
  StateSelect,
} from 'react-country-state-city'
import 'react-country-state-city/dist/react-country-state-city.css'
import { Send, AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'
import HoldCaptcha from '@/components/HoldCaptcha'
import { FormInput } from '@/components/design/FormInput'
import { FormTextarea } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'

interface ContactFormProps {
  brokerId?: string
  brokerSlug: string
  brokerName?: string
  brokerEmail?: string
  brokerPhone?: string
}

interface FormData {
  firstName: string
  lastName: string
  email: string
  city: string
  state: string
  country: string
  phone: string
  subject: string
  message: string
  contactType: string
  propertyType: string
  loanType: string
  loanAmount: string
  timeline: string
  agreeToMarketing: boolean
  agreeToTerms: boolean
}

export default function ContactForm({
  brokerId,
  brokerSlug,
  brokerName = 'Mortgage Originator',
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormData, string>> & { captcha?: string }
  >({})
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false)
  const [countries, setCountries] = useState<any[]>([])
  const [states, setStates] = useState<any[]>([])
  const [cities, setCities] = useState<any[]>([])
  const [selectedCountry, setSelectedCountry] = useState<any>(null)
  const [selectedState, setSelectedState] = useState<any>(null)

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
          country: 'United States',
    subject: '',
    message: '',
    contactType: 'email',
    propertyType: '',
    loanType: '',
    loanAmount: '',
    timeline: 'exploring',
    agreeToMarketing: false,
    agreeToTerms: true,
  })

  // Load countries on component mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const countriesList = await GetCountries()
        setCountries(countriesList)

        // Find United States in the list
        const unitedStates = countriesList.find(
          (country: any) =>
            country.name === 'United States' || country.name === 'united states'
        )

        if (unitedStates) {
          setSelectedCountry(unitedStates)
          setFormData((prev) => ({ ...prev, country: unitedStates.name }))
        }
      } catch (error) {
        console.error('Error loading countries:', error)
        toast.error('Failed to load countries')
      }
    }

    loadCountries()
  }, [])

  // Load states when country changes
  useEffect(() => {
    const loadStates = async () => {
      if (!selectedCountry?.id) return

      try {
        const statesList = await GetState(selectedCountry.id)
        setStates(statesList)
        setFormData((prev) => ({
          ...prev,
          state: '',
          city: '',
        }))
      } catch (error) {
        console.error('Error loading states:', error)
        toast.error('Failed to load states')
      }
    }

    loadStates()
  }, [selectedCountry])

  // Load cities when state changes
  useEffect(() => {
    const loadCities = async () => {
      if (!selectedCountry?.id || !selectedState?.id) return

      try {
        const citiesList = await GetCity(selectedCountry.id, selectedState.id)
        setCities(citiesList)
        setFormData((prev) => ({ ...prev, city: '' }))
      } catch (error) {
        console.error('Error loading cities:', error)
        toast.error('Failed to load cities')
      }
    }

    if (selectedState?.id) {
      loadCities()
    }
  }, [selectedCountry, selectedState])

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> & {
      captcha?: string
    } = {}

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!/^[\d\s\-\+\(\)]{10,}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    if (!formData.country) newErrors.country = 'Country is required'
    if (!formData.state) newErrors.state = 'State is required'
    if (!formData.city) newErrors.city = 'City is required'
    if (!formData.message.trim()) newErrors.message = 'Message is required'
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms'
    if (!isCaptchaVerified) newErrors.captcha = 'Please complete the verification'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please correct the highlighted fields.')
      return
    }

    if (!isCaptchaVerified) {
      toast.error('Please complete the security verification')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contacts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brokerId,
          brokerSlug,
          brokerName,
          ...formData,
          name: `${formData.firstName} ${formData.lastName}`,
          loanAmount: formData.loanAmount ? parseFloat(formData.loanAmount) : null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(
          `Your message has been sent to ${brokerName}. They will contact you soon.`
        )

        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          city: '',
          state: '',
    country: 'United States',
          subject: '',
          message: '',
          contactType: 'email',
          propertyType: '',
          loanType: '',
          loanAmount: '',
          timeline: 'exploring',
          agreeToMarketing: false,
          agreeToTerms: true,
        })
        setErrors({})
        setIsCaptchaVerified(false)
        setSelectedState(null)
        setCities([])

        // Optionally track conversion
        if (typeof window !== 'undefined' && (window as any).gtag) {
          ;(window as any).gtag('event', 'contact_form_submitted', {
            broker_id: brokerId || brokerSlug,
            broker_name: brokerName,
          })
        }
      } else {
        toast.error(result.error || 'Failed to send message. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error('Something went wrong. Please try again or contact support.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target

    // Clear error for this field when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (name: keyof FormData, checked: boolean) => {
    // Clear error for this field when user checks
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }

    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSelectChange = (name: keyof FormData, value: string) => {
    // Clear error for this field when user selects
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCityChange = (city: any) => {
    setFormData((prev) => ({ ...prev, city: city?.name || '' }))
    setErrors((prev) => ({ ...prev, city: undefined }))
  }

  const handleStateChange = (state: any) => {
    setSelectedState(state)
    setFormData((prev) => ({ ...prev, state: state?.name || '' }))
    setErrors((prev) => ({ ...prev, state: undefined }))
  }

  const handleCountryChange = (country: any) => {
    setSelectedCountry(country)
    setFormData((prev) => ({ ...prev, country: country?.name || '' }))
    setErrors((prev) => ({ ...prev, country: undefined }))
  }

  return (
    <div className="space-y-8">
      {/* Personal Information */}
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-foreground">Your Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            label="First Name"
            name="firstName"
            required
            value={formData.firstName}
            onChange={handleChange}
            placeholder="John"
            error={errors.firstName}
          />
          <FormInput
            label="Last Name"
            name="lastName"
            required
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Doe"
            error={errors.lastName}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            label="Email Address"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="john@example.com"
            error={errors.email}
          />
          <FormInput
            label="Phone Number"
            name="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={handleChange}
             placeholder="+1 (555) 987-6540"
            error={errors.phone}
          />
        </div>

        {/* Country, State, City Selection */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                Country <span className="text-destructive">*</span>
              </Label>
              <div
                className={
                  errors.country
                    ? 'rounded border border-destructive/60 p-1'
                    : 'rounded border border-border p-1'
                }
              >
                <CountrySelectField
                  defaultValue={formData.country as any}
                  onChange={handleCountryChange}
                />
              </div>
              {errors.country && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.country}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                State <span className="text-destructive">*</span>
              </Label>
              <div
                className={
                  errors.state
                    ? 'rounded border border-destructive/60 p-1'
                    : 'rounded border border-border p-1'
                }
              >
                <StateSelectField
                  countryid={selectedCountry?.id as any}
                  defaultValue={formData.state as any}
                  onChange={handleStateChange}
                />
              </div>
              {errors.state && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.state}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              City <span className="text-destructive">*</span>
            </Label>
            <div
              className={
                errors.city
                  ? 'rounded border border-destructive/60 p-1'
                  : 'rounded border border-border p-1'
              }
            >
              <CitySelect
                countryid={selectedCountry?.id}
                stateid={selectedState?.id}
                onChange={handleCityChange}
                defaultValue={cities[0]}
                placeHolder="Select City"
                containerClassName="w-full"
                inputClassName="w-full p-2 border border-border rounded-md"
              />
            </div>
            {errors.city && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.city}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-foreground">Your Message</h3>
        <FormInput
          label="Subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          placeholder="e.g., Mortgage Inquiry"
        />

        <FormTextarea
          label="Your Message"
          name="message"
          required
          rows={4}
          value={formData.message}
          onChange={handleChange}
          placeholder={`Please provide details about your mortgage needs...`}
          error={errors.message}
        />

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Preferred Contact Method
          </Label>
          <Select
            value={formData.contactType}
            onValueChange={(value) => handleSelectChange('contactType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select contact method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone Call</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Security Verification */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">Security Verification</h3>
        <HoldCaptcha
          onChange={setIsCaptchaVerified}
          duration={3}
          cooldownDuration={30}
        />
        {!isCaptchaVerified && errors.captcha && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>{errors.captcha}</span>
          </div>
        )}
      </div>

      {/* Terms & Consent */}
      <div className="space-y-4">
        <div className="flex items-start space-x-2">
          <Checkbox
            id="agreeToTerms"
            name="agreeToTerms"
            checked={formData.agreeToTerms}
            onCheckedChange={(checked) =>
              handleCheckboxChange('agreeToTerms', checked as boolean)
            }
            className={errors.agreeToTerms ? 'border-destructive' : ''}
          />
          <Label htmlFor="agreeToTerms" className="text-sm text-muted-foreground">
            I agree that {brokerName} can contact me regarding mortgage services.
            I understand that I can unsubscribe at any time.
          </Label>
        </div>
        {errors.agreeToTerms && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>{errors.agreeToTerms}</span>
          </div>
        )}

        <div className="flex items-start space-x-2">
          <Checkbox
            id="agreeToMarketing"
            name="agreeToMarketing"
            checked={formData.agreeToMarketing}
            onCheckedChange={(checked) =>
              handleCheckboxChange('agreeToMarketing', checked as boolean)
            }
          />
          <Label htmlFor="agreeToMarketing" className="text-sm text-muted-foreground">
            I would like to receive marketing communications about mortgage
            offers, interest rate updates, and mortgage tips from {brokerName}.
          </Label>
        </div>
      </div>

      {/* Submit Button */}
      <PremiumButton
        type="submit"
        onClick={handleSubmit}
        loading={isSubmitting}
        loadingText="Sending Message..."
        disabled={isSubmitting || !formData.agreeToTerms || !isCaptchaVerified}
        fullWidth
        size="lg"
        leftIcon={!isSubmitting && <Send className="h-4 w-4" />}
      >
        Send Message to {brokerName}
      </PremiumButton>
    </div>
  )
}

// Lightweight wrappers around the third-party selects so they render
// inside the design system's bordered containers.
function CountrySelectField({
  defaultValue,
  onChange,
}: {
  defaultValue: any
  onChange: (country: any) => void
}) {
  return (
    <CountrySelect
      onChange={onChange}
      defaultValue={defaultValue}
      placeHolder="Select Country"
      containerClassName="w-full"
      inputClassName="w-full p-2 border border-border rounded-md"
    />
  )
}

function StateSelectField({
  countryid,
  defaultValue,
  onChange,
}: {
  countryid?: any
  defaultValue: any
  onChange: (state: any) => void
}) {
  return (
    <StateSelect
      countryid={countryid}
      onChange={onChange}
      defaultValue={defaultValue}
      placeHolder="Select State"
      containerClassName="w-full"
      inputClassName="w-full p-2 border border-border rounded-md"
    />
  )
}
