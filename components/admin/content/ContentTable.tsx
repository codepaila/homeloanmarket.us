'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { deleteBlog, toggleBlogPublished } from '@/actions/content'

type ContentRow = {
  id: string
  title: string
  slug: string
  category: string
  isPublished: boolean
  publishedAt: Date | null
  updatedAt: Date
}

export function ContentTable({ posts, search, status }: { posts: ContentRow[]; search: string; status: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setFilter = (key: 'search' | 'status', value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/admin/content?${next.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input
            placeholder="Search by title..."
            defaultValue={search}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setFilter('search', event.currentTarget.value)
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={status}
            onChange={(event) => setFilter('status', event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <Button asChild>
          <Link href="/admin/content/new">
            <Plus className="mr-2 h-4 w-4" />
            New Article
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No articles found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pl-5 pr-4 font-medium">Title</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Updated</th>
                    <th className="py-3 pl-4 pr-5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b last:border-0">
                      <td className="max-w-[280px] py-3 pl-5 pr-4">
                        <p className="truncate font-medium">{post.title}</p>
                        <p className="truncate text-xs text-muted-foreground">/{post.slug}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary">{post.category}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {post.isPublished ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" variant="secondary">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Draft
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(post.updatedAt).toLocaleDateString()}</td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => startTransition(() => toggleBlogPublished(post.id).then(() => router.refresh()))}
                          >
                            {post.isPublished ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/content/${post.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              if (window.confirm('Delete this article?')) startTransition(() => deleteBlog(post.id).then(() => router.refresh()))
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
