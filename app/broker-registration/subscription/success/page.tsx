'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Suspense } from 'react'

function BrokerRegistrationSubscriptionSuccessContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const sessionId = params.get('session_id')
    if (!sessionId) {
      router.replace('/broker/subscription/select')
      return
    }

    fetch(`/api/broker-registration/subscription/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to verify subscription')
        router.replace(data.redirectTo || '/setup')
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to verify subscription'))
  }, [params, router])

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" className="mt-4 text-sm font-medium text-primary underline" onClick={() => router.replace('/broker/subscription/select')}>
              Return to plans
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">Verifying your subscription...</p>
          </>
        )}
      </div>
    </main>
  )
}

export default function BrokerRegistrationSubscriptionSuccessPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>}>
      <BrokerRegistrationSubscriptionSuccessContent />
    </Suspense>
  )
}
