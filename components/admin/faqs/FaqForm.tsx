'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type FaqAction = (previousState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>

function Field({ label, name, defaultValue, rows }: { label: string; name: string; defaultValue: string; rows?: number }) {
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

export function FaqForm({
  action,
  initial,
}: {
  action: FaqAction
  initial: { id?: string; question: string; answer: string; category: string; displayOrder: number; isActive: boolean }
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form action={formAction} className="space-y-6">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">FAQ</CardTitle>
          <CardDescription>Question and answer shown on the public FAQ page when published.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Question" name="question" defaultValue={initial.question} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Answer" name="answer" defaultValue={initial.answer} rows={8} />
          </div>
          <Field label="Category" name="category" defaultValue={initial.category} />
          <Field label="Display Order" name="displayOrder" defaultValue={String(initial.displayOrder)} />
          <div className="flex items-end gap-2 pb-1">
            <label htmlFor="isActive" className="flex items-center gap-2 text-sm font-medium">
              <input id="isActive" name="isActive" type="checkbox" defaultChecked={initial.isActive} className="h-4 w-4" />
              Published
            </label>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save FAQ'}
      </Button>
    </form>
  )
}
