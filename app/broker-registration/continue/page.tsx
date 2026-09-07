'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function BrokerRegistrationContinuePage() {
  const router = useRouter()
  const { update: refreshSession } = useSession()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function continueRegistration() {
      try {
        const response = await fetch('/api/auth/broker-intent', { method: 'PUT' })
        const data = await response.json()
        if (!response.ok) {
          if (data?.consentRequired) {
            router.replace('/broker-registration/consent')
            return
          }
          throw new Error(data.error || 'Unable to continue mortgage originator registration')
        }

        await refreshSession()
        router.replace(data.redirectTo || '/setup')
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to continue mortgage originator registration')
      }
    }

    continueRegistration()
    return () => {
      active = false
    }
  }, [refreshSession, router])

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" className="mt-4 text-sm font-medium text-primary underline" onClick={() => router.replace('/register')}>
              Return to registration
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">Preparing your mortgage originator registration...</p>
          </>
        )}
      </div>
    </main>
  )
}
