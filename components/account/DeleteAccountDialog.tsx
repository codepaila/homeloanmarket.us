'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type DeleteAccountDialogProps = {
  triggerLabel: string
  title: string
  description: string
  confirmPhrase?: string
  endpoint: string
  method?: 'POST' | 'DELETE'
  signOutAfterSuccess?: boolean
  onSuccess?: () => void
  busyLabel?: string
}

// Shared explicit-confirmation dialog for every destructive account-deletion
// path (broker/company/user self-service and admin broker/company deletion).
// The user must type the confirmation phrase to enable the delete button, so a
// single accidental click can never trigger deletion.
export function DeleteAccountDialog({
  triggerLabel,
  title,
  description,
  confirmPhrase = 'DELETE',
  endpoint,
  method = 'POST',
  signOutAfterSuccess = false,
  onSuccess,
  busyLabel = 'Deleting…',
}: DeleteAccountDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)

  const enabled = phrase.trim().toUpperCase() === confirmPhrase

  async function confirmDelete() {
    if (busy || !enabled) return
    setBusy(true)
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await response.json()
      if (!response.ok) {
        const message = data?.error || data?.message || 'Unable to delete. Please try again.'
        throw new Error(message)
      }
      toast.success('Account deleted.')
      if (signOutAfterSuccess) {
        await signOut({ callbackUrl: '/' })
      } else {
        setOpen(false)
        onSuccess?.()
        router.refresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" className="gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>{description}</p>
            <p>
              Type <span className="font-semibold text-foreground">{confirmPhrase}</span> to confirm
              this permanent action.
            </p>
          </DialogDescription>
        </DialogHeader>
        <Input
          type="text"
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          placeholder={confirmPhrase}
          autoComplete="off"
          aria-label={`Type ${confirmPhrase} to confirm deletion`}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={!enabled || busy} onClick={confirmDelete} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? busyLabel : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
