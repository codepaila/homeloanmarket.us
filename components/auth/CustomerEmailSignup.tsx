'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Mail, Lock, User, ArrowRight } from 'lucide-react'
import { FormInput } from '@/components/design/FormInput'
import { PremiumButton } from '@/components/design/PremiumButton'

export function CustomerEmailSignup() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !email.trim() || password.length < 8) {
      toast.error('Please fill in all fields with a valid password (8+ characters).')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/register/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account')
      }
      toast.success('Account created. Check your email to verify your account.')
      router.push(result.redirectTo || '/auth/verify-email')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-4">
      <FormInput
        label="Full name"
        name="name"
        placeholder="Full name"
        icon={<User className="h-4 w-4" />}
        required
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <FormInput
        label="Email"
        name="email"
        type="email"
        placeholder="Email address"
        icon={<Mail className="h-4 w-4" />}
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FormInput
        label="Password"
        name="password"
        placeholder="Password (8+ characters)"
        icon={<Lock className="h-4 w-4" />}
        required
        autoComplete="new-password"
        togglePassword
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PremiumButton
        type="submit"
        loading={loading}
        loadingText="Creating account..."
        disabled={loading}
        fullWidth
        size="default"
        leftIcon={!loading && <ArrowRight className="h-4 w-4" />}
      >
        Create Account
      </PremiumButton>
      <p className="text-center text-xs text-muted-foreground">
        Check your email to verify your account.
      </p>
    </form>
  )
}
