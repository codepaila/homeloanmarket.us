import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Home, Briefcase, Check } from 'lucide-react'
import { getCurrentUser } from '@/lib/currentUser'
import { resolveUserResumePath } from '@/lib/user-resume'
import { AuthFormWrapper } from '@/components/design/AuthFormWrapper'
import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'
import { HomeBuyerCard } from '@/components/auth/HomeBuyerCard'
import { AuthDivider } from '@/components/auth/AuthDivider'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Register',
  description: 'Create a HomeLoanMarket account as a home buyer or mortgage originator.',
}

const buyerFeatures = [
  'Find and compare trusted mortgage originators',
  'Read verified reviews and ratings',
  'Contact mortgage originators directly when you are ready',
]

const brokerFeatures = [
  'Create and manage your professional mortgage originator profile',
  'Receive leads from home buyers',
  'Build your reputation with reviews',
]

export default async function RegisterPage() {
  const user = await getCurrentUser()
  // An authenticated visitor is sent to their canonical resume destination:
  // incomplete broker/company registrations resume their own flow, a normal
  // USER goes home, an admin goes to /admin. Never the wrong product.
  if (user) redirect(resolveUserResumePath(user))

  return (
    <AuthFormWrapper
      title="Create your account"
      subtitle="Join HomeLoanMarket to find the right mortgage originator — or register as a mortgage originator and grow your business."
      size="lg"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col rounded border border-border bg-background/40 p-5 shadow-soft transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-medium sm:p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded bg-primary/10 text-primary">
            <Home className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">I&apos;m a Home Buyer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, compare, and connect with the right mortgage expert.
          </p>
          <ul className="mt-4 space-y-2">
            {buyerFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex-1" />

          <div className="mt-5">
            <HomeBuyerCard />
          </div>
        </div>

        <div className={cn('flex flex-col rounded border bg-background/40 p-5 shadow-soft transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-medium sm:p-6', 'border-primary/20')}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Mortgage Originator
            </span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Join as a Mortgage Originator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your mortgage originator profile and start receiving leads from borrowers.
          </p>
          <ul className="mt-4 space-y-2">
            {brokerFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex-1" />

          <div className="mt-5 space-y-3">
            <GoogleContinueButton callbackUrl="/broker-registration/continue" brokerIntent />
            <AuthDivider label="or" />
            <Link
              href="/auth/signup"
              className="inline-flex w-full items-center justify-center rounded border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Register with Email
            </Link>
            <p className="text-center text-sm text-muted-foreground">
              Already registered?{' '}
              <Link href="/auth/signin" className="font-medium text-primary hover:text-primary/80">
                Sign in
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-5 text-center">
          <Link href="/company/register" className="text-sm font-semibold text-primary hover:underline">Join as a Company</Link>
        </div>
      </div>
    </AuthFormWrapper>
  )
}
