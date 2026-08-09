/* eslint-disable @typescript-eslint/no-explicit-any */
// components/forms/ContactForm.tsx
'use client'
import React, { useState } from "react";
import {GetCountries, CitySelect } from "react-country-state-city";
import "react-country-state-city/dist/react-country-state-city.css";
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'


interface ContactFormProps {
  brokerId: string
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
  brokerName = 'Mortgage Broker',
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    city: '',
    contactType: 'email',
    propertyType: '',
    loanType: '',
    loanAmount: '',
    timeline: 'exploring',
    agreeToMarketing: false,
    agreeToTerms: true
  })
 React.useEffect(() => {
    GetCountries().then((_countries) => {
       console.log(_countries.find((value) => value.name === "United States"))
    });
  }, [GetCountries]);
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    
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
    
    if (!formData.message.trim()) newErrors.message = 'Message is required'
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please correct the highlighted fields.')
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
        toast.success(`Your message has been sent to ${brokerName}. They will contact you soon.`)
        
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          city: '',
          phone: '',
          subject: '',
          message: '',
          contactType: 'email',
          propertyType: '',
          loanType: '',
          loanAmount: '',
          timeline: 'exploring',
          agreeToMarketing: false,
          agreeToTerms: true
        })
        setErrors({})

        // Optionally track conversion
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'contact_form_submitted', {
            broker_id: brokerId,
            broker_name: brokerName
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
    
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (name: keyof FormData, checked: boolean) => {
    // Clear error for this field when user checks
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
    
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleSelectChange = (name: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
 
    <div className="space-y-6">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
              className={errors.firstName ? 'border-red-500' : ''}
            />
            {errors.firstName && (
              <p className="text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Doe"
              className={errors.lastName ? 'border-red-500' : ''}
            />
            {errors.lastName && (
              <p className="text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={handleChange}
               placeholder="+1 (555) 987-6540"
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone}</p>
            )}
          </div>
        </div>
        <div className="city">
            {/* <CitySelect
        countryid={101}
        stateid={101}
        onChange={(_city) => setFormData((pre) => ({...pre,city: _city}))}
        defaultValue={formData.city}
        placeHolder="Select City"
      /> */}
        </div>
      </div>

      {/* Loan Information (Optional) */}
      {/* <div className="space-y-4">
        <h3 className="text-lg font-semibold">Loan Information (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="loanType">Loan Type</Label>
            <Select
              value={formData.loanType}
              onValueChange={(value) => handleSelectChange('loanType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select loan type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home_purchase">Home Purchase</SelectItem>
                <SelectItem value="refinance">Refinance</SelectItem>
                <SelectItem value="fha">FHA Loan</SelectItem>
                <SelectItem value="va">VA Loan</SelectItem>
                <SelectItem value="usda">USDA Loan</SelectItem>
                <SelectItem value="jumbo">Jumbo Loan</SelectItem>
                <SelectItem value="conventional">Conventional Loan</SelectItem>
                <SelectItem value="construction">Construction Loan</SelectItem>
                <SelectItem value="home_equity">Home Equity Loan</SelectItem>
                <SelectItem value="cash_out_refinance">Cash-Out Refinance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="propertyType">Property Type</Label>
            <Select
              value={formData.propertyType}
              onValueChange={(value) => handleSelectChange('propertyType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="independent_house">Independent House</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
                <SelectItem value="plot">Plot</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
             <Label htmlFor="loanAmount">Loan Amount ($)</Label>
            <Input
              id="loanAmount"
              name="loanAmount"
              type="number"
              min="0"
              value={formData.loanAmount}
              onChange={handleChange}
              placeholder="e.g., 5000000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeline">When are you planning?</Label>
          <Select
            value={formData.timeline}
            onValueChange={(value) => handleSelectChange('timeline', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">Immediately</SelectItem>
              <SelectItem value="1-3_months">Within 1-3 months</SelectItem>
              <SelectItem value="3-6_months">Within 3-6 months</SelectItem>
              <SelectItem value="exploring">Just exploring options</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div> */}

      {/* Message */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="e.g., Mortgage Inquiry"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Your Message *</Label>
          <Textarea
            id="message"
            name="message"
            required
            rows={4}
            value={formData.message}
            onChange={handleChange}
            placeholder={`Please provide details about your mortgage needs...`}
            className={`min-h-[120px] ${errors.message ? 'border-red-500' : ''}`}
          />
          {errors.message && (
            <p className="text-sm text-red-500">{errors.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactType">Preferred Contact Method</Label>
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
            className={errors.agreeToTerms ? 'border-red-500' : ''}
          />
          <Label htmlFor="agreeToTerms" className="text-sm">
            I agree that {brokerName} can contact me regarding mortgage services. 
            I understand that I can unsubscribe at any time.
          </Label>
        </div>
        {errors.agreeToTerms && (
          <p className="text-sm text-red-500">{errors.agreeToTerms}</p>
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
          <Label htmlFor="agreeToMarketing" className="text-sm">
            I would like to receive marketing communications about mortgage offers, 
            interest rate updates, and mortgage tips from {brokerName}.
          </Label>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        onClick={handleSubmit}
        disabled={isSubmitting || !formData.agreeToTerms}
        className="w-full"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending Message...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Message to {brokerName}
          </>
        )}
      </Button>
    </div>
  
  )
}