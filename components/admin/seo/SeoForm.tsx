'use client'

import { useActionState } from 'react'
import type { SiteSettings } from '@/lib/site/settings'
import { updateSiteSettings } from '@/actions/site-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SeoForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(updateSiteSettings, undefined)

  return (
    <form action={action} className="space-y-6">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-600">SEO settings saved.</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Default Metadata</CardTitle>
          <CardDescription>Used by the public site metadata and open graph output.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-1.5">
            <label htmlFor="seoTitle" className="text-sm font-medium">
              Default Title
            </label>
            <input id="seoTitle" name="seoTitle" defaultValue={settings.seoTitle} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="seoDescription" className="text-sm font-medium">
              Default Description
            </label>
            <textarea id="seoDescription" name="seoDescription" defaultValue={settings.seoDescription} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Social Profiles</CardTitle>
          <CardDescription>Public social profile links used in footer and structured data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="socialFacebook" className="text-sm font-medium">Facebook</label>
            <input id="socialFacebook" name="socialFacebook" defaultValue={settings.socialFacebook || ''} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="socialTwitter" className="text-sm font-medium">Twitter / X</label>
            <input id="socialTwitter" name="socialTwitter" defaultValue={settings.socialTwitter || ''} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="socialLinkedIn" className="text-sm font-medium">LinkedIn</label>
            <input id="socialLinkedIn" name="socialLinkedIn" defaultValue={settings.socialLinkedIn || ''} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="socialInstagram" className="text-sm font-medium">Instagram</label>
            <input id="socialInstagram" name="socialInstagram" defaultValue={settings.socialInstagram || ''} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="socialYouTube" className="text-sm font-medium">YouTube</label>
            <input id="socialYouTube" name="socialYouTube" defaultValue={settings.socialYouTube || ''} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save SEO Settings'}
      </Button>
    </form>
  )
}
