/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { AnimatedContainer } from '@/components/design/AnimatedContainer'
import { Section } from '@/components/design/Section'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'
import { cn } from '@/lib/utils'

const validateName = (name: string): string => {
  if (!name.trim()) return 'Name is required'
  if (name.trim().length < 2) return 'Name must be at least 2 characters'
  return ''
}

const validateEmail = (email: string): string => {
  if (!email.trim()) return 'Email is required'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return 'Please enter a valid email address'
  return ''
}

const validatePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return 'Phone number is required'
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith('1')))) return 'Please enter a valid US phone number'
  return ''
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {
      name: validateName(formData.name),
      email: validateEmail(formData.email),
      phone: validatePhone(formData.phone),
    }
    if (!formData.subject.trim()) newErrors.subject = 'Subject is required'
    if (!formData.message.trim()) newErrors.message = 'Message is required'
    if (formData.message.trim().length < 10) newErrors.message = 'Message must be at least 10 characters'
    setErrors(newErrors)
    return !Object.values(newErrors).some((e) => e !== '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast.error('Please correct the highlighted fields.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      toast.success('Message sent successfully! We will get back to you soon.')
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Section className="bg-surface">
        <AnimatedContainer>
          <div className="text-center max-w-3xl mx-auto">
             <h1 className="heading-1 text-text-main mb-4">Contact</h1>
            <p className="text-xl text-text-muted">
              Have questions? Reach out to our team and we&apos;ll get back to you within 24 hours.
            </p>
          </div>
        </AnimatedContainer>
      </Section>

      <Section className="bg-background">
        <AnimatedContainer>
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <h2 className="heading-3 text-text-main">Get in Touch</h2>
              <p className="text-text-muted leading-relaxed">
                We&apos;re here to help. Whether you&apos;re looking for a mortgage broker or have questions
                about our platform, our team is ready to assist you.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                     <h3 className="font-semibold text-text-main mb-1">Our Office</h3>
                     <p className="text-text-muted">
                       539 W Commerce St.<br />
                       Dallas, TX 75208
                     </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-main mb-1">Phone</h3>
                    <p className="text-text-muted">1-800-466-3562</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-main mb-1">Email</h3>
                    <p className="text-text-muted">support@homeloanmarket.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-main mb-1">Business Hours</h3>
                    <p className="text-text-muted">
                      Monday - Friday: 9:00 AM - 7:00 PM<br />
                      Saturday: 10:00 AM - 4:00 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card card-hover">
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <h3 className="text-xl font-semibold text-text-main mb-4">
                  Send us a message
                </h3>

                <FormInput
                  label="Full Name"
                  name="name"
                  placeholder="John Doe"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  error={errors.name}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    error={errors.email}
                  />
                  <FormInput
                    label="Phone"
                    name="phone"
                     placeholder="+1 (555) 987-6540"
                    required
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    error={errors.phone}
                  />
                </div>

                <FormInput
                  label="Subject"
                  name="subject"
                  placeholder="How can we help?"
                  required
                  value={formData.subject}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  error={errors.subject}
                />

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-text-main">
                    Message <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    placeholder="Tell us about your inquiry..."
                    rows={5}
                    className={cn(
                      'w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-base transition-all duration-200 placeholder:text-text-muted/50 resize-y focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
                      errors.message && 'border-destructive focus:border-destructive focus:ring-destructive/15'
                    )}
                    required
                  />
                  {errors.message && (
                    <p className="text-xs text-destructive">{errors.message}</p>
                  )}
                </div>

                <PremiumButton
                  type="submit"
                  loading={loading}
                  loadingText="Sending..."
                  fullWidth
                  leftIcon={!loading && <Send className="h-4 w-4" />}
                >
                  Send Message
                </PremiumButton>

                {errors.submit && (
                  <p className="text-sm text-destructive">{errors.submit}</p>
                )}
              </form>
            </div>
          </div>
        </AnimatedContainer>
      </Section>
    </div>
  )
}
