'use client'

import { useActionState, useState } from 'react'
import type { SiteSettings } from '@/lib/site/settings'
import { updateSiteSettings } from '@/actions/site-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MediaSelector } from '@/components/admin/media/MediaSelector'

function Field({ label, name, defaultValue, hint }: { label: string; name: string; defaultValue: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(updateSiteSettings, undefined)
  const [siteLogo, setSiteLogo] = useState(settings.siteLogo || '')
  const [siteFavicon, setSiteFavicon] = useState(settings.siteFavicon || '')

  return (
    <form action={action} className="space-y-6">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-600">Settings saved.</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">General</CardTitle>
          <CardDescription>Core site identity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Site Name" name="siteName" defaultValue={settings.siteName} />
          <Field label="Site URL" name="siteUrl" defaultValue={settings.siteUrl} hint="Production https origin." />
          <div className="sm:col-span-2">
            <Field label="Site Description" name="siteDescription" defaultValue={settings.siteDescription} />
          </div>
          <Field label="Default Currency" name="defaultCurrency" defaultValue={settings.defaultCurrency} />
          <Field label="Timezone" name="timezone" defaultValue={settings.timezone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Contact Information</CardTitle>
          <CardDescription>Contact details shown on the public contact page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact Email" name="contactEmail" defaultValue={settings.contactEmail} />
          <Field label="Contact Phone" name="contactPhone" defaultValue={settings.contactPhone} />
          <div className="sm:col-span-2">
            <Field label="Street Address" name="contactStreet" defaultValue={settings.contactStreet} hint="e.g. 539 W Commerce St." />
          </div>
          <Field label="City" name="contactCity" defaultValue={settings.contactCity} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" name="contactState" defaultValue={settings.contactState} hint="Two-letter code, e.g. TX" />
            <Field label="ZIP Code" name="contactZip" defaultValue={settings.contactZip} />
          </div>
          <Field label="Country" name="contactCountry" defaultValue={settings.contactCountry} />
          <div className="sm:col-span-2">
            <Field label="Business Hours" name="contactBusinessHours" defaultValue={settings.contactBusinessHours} hint="e.g. Mon-Fri 9AM-7PM, Sat 10AM-4PM" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Branding</CardTitle>
          <CardDescription>Choose reusable media for the public site identity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div>
            <MediaSelector
              value={siteLogo}
              label="Site Logo"
              description="Displayed in the public header and footer."
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={(asset) => {
                setSiteLogo(asset?.fileUrl || '')
              }}
            />
            <input type="hidden" name="site.logo" value={siteLogo} readOnly />
          </div>
          <div>
            <MediaSelector
              value={siteFavicon}
              label="Site Favicon"
              description="Displayed as the browser tab icon."
              accept="image/png,image/svg+xml"
              onChange={(asset) => {
                setSiteFavicon(asset?.fileUrl || '')
              }}
            />
            <input type="hidden" name="site.favicon" value={siteFavicon} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Footer</CardTitle>
          <CardDescription>Footer description and copyright text.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Footer Description" name="footerDescription" defaultValue={settings.footerDescription} />
          <Field label="Copyright Text" name="copyrightText" defaultValue={settings.copyrightText} />
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save Settings'}
      </Button>
    </form>
  )
}
