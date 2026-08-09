'use client'

import { useActionState } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MediaSelector } from '@/components/admin/media/MediaSelector'
import type { MediaAsset } from '@/lib/advertisements/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type BlogInitialValues = {
  id?: string
  title: string
  slug: string
  excerpt: string
  content: string
  coverImage: string | null
  author: string
  category: string
  tags: string[]
  isPublished: boolean
  seoTitle: string | null
  seoDescription: string | null
}

type FormAction = (previousState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>

function TextField({ label, name, defaultValue, rows }: { label: string; name: string; defaultValue: string; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {rows ? (
        <textarea id={name} name={name} defaultValue={defaultValue} rows={rows} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      ) : (
        <input id={name} name={name} defaultValue={defaultValue} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      )}
    </div>
  )
}

export function BlogForm({
  action,
  initial,
  assets,
}: {
  action: FormAction
  initial: BlogInitialValues
  assets: MediaAsset[]
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [coverImage, setCoverImage] = useState(initial.coverImage || '')

  return (
    <form action={formAction} className="space-y-6">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Article</CardTitle>
          <CardDescription>Content shown on the public blog.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Title" name="title" defaultValue={initial.title} />
          </div>
          <TextField label="Slug" name="slug" defaultValue={initial.slug} />
          <TextField label="Author" name="author" defaultValue={initial.author} />
          <TextField label="Category" name="category" defaultValue={initial.category} />
          <TextField label="Tags (comma separated)" name="tags" defaultValue={initial.tags.join(', ')} />
          <div className="sm:col-span-2">
            <TextField label="Excerpt" name="excerpt" defaultValue={initial.excerpt} />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Content" name="content" defaultValue={initial.content} rows={12} />
          </div>
          <div className="sm:col-span-2">
            <MediaSelector
              value={coverImage}
              selectedAsset={assets.find((asset) => asset.fileUrl === coverImage) || null}
              label="Featured Image"
              description="Select existing media or upload a new article image."
              folder="Blog"
              onChange={(asset) => setCoverImage(asset?.fileUrl || '')}
            />
            <input type="hidden" name="coverImage" value={coverImage} readOnly />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <label htmlFor="isPublished" className="flex items-center gap-2 text-sm font-medium">
              <input id="isPublished" name="isPublished" type="checkbox" defaultChecked={initial.isPublished} className="h-4 w-4" />
              Published
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">SEO</CardTitle>
          <CardDescription>Article-specific metadata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <TextField label="SEO Title" name="seoTitle" defaultValue={initial.seoTitle || ''} />
          <TextField label="SEO Description" name="seoDescription" defaultValue={initial.seoDescription || ''} />
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save Article'}
      </Button>
    </form>
  )
}
