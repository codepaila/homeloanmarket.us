'use client'
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { toast } from 'react-hot-toast'
import {
  ArrowRight,
  Phone,
  Clock,
  Mail,
  MapPin,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  CheckCircle2,
} from 'lucide-react'
import type { SiteSettings } from '@/lib/site/settings'
import Image from 'next/image'

const footerColumns = [
  // {
  //   title: 'Resources',
  //   links: [
  //     { name: 'Mortgage Broker Directory', href: '/brokers' },
  //     { name: 'Mortgage Guides', href: '/guides' },
  //     { name: 'Articles', href: '/blog' },
  //     { name: 'Mortgage Calculator', href: '/calculator' },
  //     { name: 'FAQ', href: '/faq' },
  //   ],
  // },
  {
    title: 'Company',
    links: [
      { name: 'About Us', href: '/about' },
      { name: 'Contact', href: '/contact' },
      { name: 'Subscription Plans', href: '/subscription' },
      { name: 'Become a Mortgage Broker', href: '/register' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Privacy Policy', href: '/privacy-policy' },
      { name: 'Terms & Conditions', href: '/terms-of-service' },
    ],
  },
]

const SOCIAL_ICONS = {
  facebook: Facebook,
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
} as const

export default function Footer({ settings }: { settings?: SiteSettings }) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [newsletterError, setNewsletterError] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)

  const contactInfo = [
    { icon: Phone, label: 'Phone', value: settings?.contactPhone || '+1-800-000-0000' },
    { icon: Mail, label: 'Email', value: settings?.contactEmail || 'support@homeloanmarket.com' },
    { icon: MapPin, label: 'Office', value: settings?.contactAddress || 'United States' },
    { icon: Clock, label: 'Hours', value: 'Mon–Fri: 9am – 6pm' },
  ]

  const socialLinks = (Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[]).map((key) => {
    const settingKey =
      key === 'facebook' ? 'socialFacebook' :
        key === 'twitter' ? 'socialTwitter' :
          key === 'linkedin' ? 'socialLinkedIn' :
            key === 'instagram' ? 'socialInstagram' : 'socialYouTube'
    return { name: key, href: settings?.[settingKey] || '', icon: SOCIAL_ICONS[key] }
  }).filter((social) => social.href)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setNewsletterError('')
    setNewsletterLoading(true)
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to subscribe')
      setSubscribed(true)
      setEmail('')
      toast.success('Subscribed successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to subscribe'
      setNewsletterError(message)
      toast.error(message)
    } finally {
      setNewsletterLoading(false)
    }
  }

  return (
    <footer className="border-t border-border bg-bg-deep">
      <div className="container-custom">
        {/* Newsletter strip */}
        <div className="flex flex-col items-center justify-between gap-6 border-b border-border py-10 lg:flex-row">
          <div>
            <h3 className="text-xl font-bold text-text-main">
              Get mortgage insights in your inbox
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              Market updates, eligibility tips, and mortgage advice. No
              unwanted emails, unsubscribe anytime.
            </p>
          </div>
          <form
            onSubmit={handleSubscribe}
            className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-border bg-background p-1.5 shadow-soft"
          >
            <Mail className="ml-3 h-4 w-4 flex-shrink-0 text-text-muted" />
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              aria-label="Email for newsletter"
              className="w-full bg-transparent py-2 text-sm text-text-main outline-none placeholder:text-text-muted/60"
            />
            <button
              type="submit"
              disabled={newsletterLoading}
              className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-all hover:bg-primary/90"
            >
              {subscribed ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Subscribed
                </>
              ) : (
                <>
                  {newsletterLoading ? 'Submitting…' : 'Subscribe'}
                  {!newsletterLoading && <ArrowRight className="h-3.5 w-3.5" />}
                </>
              )}
            </button>
          </form>
          {newsletterError && <p className="mt-2 text-sm text-destructive" role="alert">{newsletterError}</p>}
        </div>

        {/* Main footer grid */}
        <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {/* Brand */}
          <div className="space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              {settings?.siteLogo ? (
                <Image
                  width={300}
                  height={100} src={settings.siteLogo} alt={settings.siteName} className="h-9 max-w-40 object-contain" />
              ) : (
                <>
                  <Image
                    width={350}
                    height={200}
                    src="/assets/logo.png"
                    alt="HomeLoanMarket"
                    className="h-12 max-w-52 md:max-w-56 object-contain"
                  />
                </>
              )}
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-text-muted">
              {settings?.footerDescription || 'HomeLoanMarket helps home buyers find and compare verified mortgage brokers across the United States.'}
            </p>
            <div className="flex gap-2">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  aria-label={social.name}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
                >
                  <social.icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerColumns.map((column) => (
            <div key={column.title} className="space-y-3.5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-main">
                {column.title}
              </h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
                    >
                      {link.name}
                      <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div className="space-y-3.5 lg:col-span-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-text-main">
              Contact
            </h3>
            <ul className="space-y-3">
              {contactInfo.map((item) => (
                <li key={item.label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span>
                    <span className="block text-xs text-text-muted">
                      {item.label}
                    </span>
                    <span className="text-sm font-medium text-text-main">
                      {item.value}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border py-6 text-sm text-text-muted sm:flex-row">
          <p>
            {settings?.copyrightText || `© ${new Date().getFullYear()} HomeLoanMarket. All rights reserved.`}
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy-policy" className="transition-colors hover:text-primary">
              Privacy
            </Link>
            <Link href="/terms-of-service" className="transition-colors hover:text-primary">
              Terms
            </Link>
            <Link href="/contact" className="transition-colors hover:text-primary">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
