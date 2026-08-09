'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { deleteFaq, moveFaq, toggleFaq } from '@/actions/faqs'

type FaqRow = {
  id: string
  question: string
  category: string | null
  isActive: boolean
  displayOrder: number
  updatedAt: Date
}

export function FaqTable({ faqs, search, status }: { faqs: FaqRow[]; search: string; status: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setFilter = (key: 'search' | 'status', value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/admin/faqs?${next.toString()}`)
  }

  const refresh = () => router.refresh()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input
            placeholder="Search by question..."
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
          <Link href="/admin/faqs/new">
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {faqs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No FAQs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pl-5 pr-4 font-medium">Question</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Order</th>
                    <th className="py-3 px-4 font-medium">Updated</th>
                    <th className="py-3 pl-4 pr-5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {faqs.map((faq, index) => (
                    <tr key={faq.id} className="border-b last:border-0">
                      <td className="max-w-[320px] py-3 pl-5 pr-4">
                        <p className="truncate font-medium">{faq.question}</p>
                      </td>
                      <td className="py-3 px-4">
                        {faq.category ? <Badge variant="secondary">{faq.category}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {faq.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" variant="secondary">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Draft
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={pending || index === 0} onClick={() => startTransition(() => moveFaq(faq.id, 'up').then(refresh))}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-6 text-center tabular-nums">{faq.displayOrder}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={pending || index === faqs.length - 1} onClick={() => startTransition(() => moveFaq(faq.id, 'down').then(refresh))}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(faq.updatedAt).toLocaleDateString()}</td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => toggleFaq(faq.id).then(refresh))}>
                            {faq.isActive ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/faqs/${faq.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              if (window.confirm('Delete this FAQ?')) startTransition(() => deleteFaq(faq.id).then(refresh))
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
