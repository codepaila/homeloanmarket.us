/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auth/verify-email/route.ts - improved version
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { getClaimContext, setClaimContext } from '@/lib/claim-context'
import { signIn } from '@/lib/auth'

const VALID_PLAN_CODES = ['FREE', 'FEATURED'] as const

function sanitizePlan(plan: string | null | undefined): string | null {
  if (!plan) return null
  return (VALID_PLAN_CODES as readonly string[]).includes(plan) ? plan : null
}

function appendPlanToRedirect(baseRedirect: string, plan: string | null): string {
  if (!plan) return baseRedirect
  const separator = baseRedirect.includes('?') ? '&' : '?'
  return `${baseRedirect}${separator}plan=${plan}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email, plan: rawPlan } = body

    const plan = sanitizePlan(rawPlan)

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      )
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    const requestedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const emailChangeTokenHash = requestedEmail
      ? crypto
          .createHash('sha256')
          .update(`${token}:${requestedEmail}`)
          .digest('hex')
      : null

    // Signup tokens use the raw-token digest. Email-change tokens are bound to
    // the normalized target email, so changing the URL email invalidates them.
    let emailChangeTokenMatched = false
    let user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
      },
      include: { brokerProfile: { take: 1 }, brokerRegistration: true, companyMemberships: { where: { isActive: true }, take: 1 } }
    })

    if (!user && emailChangeTokenHash) {
      user = await prisma.user.findFirst({
        where: { emailVerificationToken: emailChangeTokenHash },
        include: { brokerProfile: { take: 1 }, brokerRegistration: true, companyMemberships: { where: { isActive: true }, take: 1 } },
      })
      emailChangeTokenMatched = Boolean(user)
    }

    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or expired verification token. Please request a new verification email.' 
        },
        { status: 404 }
      )
    }

    if (
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt <= new Date()
    ) {
      // Clear expired token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
        }
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Verification token has expired. Please request a new verification email.' 
        },
        { status: 400 }
      )
    }

    // Email-change verification: the new email travels in the URL (`email`
    // query param echoed by the verify page). The authoritative signal that
    // this is an email change is the stored token (bound to this user and sent
    // to the new address) combined with a target email that differs from the
    // current one — NOT the current `emailVerified` state. This makes the flow
    // work identically for verified and unverified accounts.
    if (emailChangeTokenMatched && requestedEmail && requestedEmail !== (user.email || '').toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
        return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 })
      }

      const taken = await prisma.user.findFirst({
        where: { email: requestedEmail, id: { not: user.id } },
        select: { id: true },
      })
      if (taken) {
        return NextResponse.json({ success: false, error: 'Email is already in use' }, { status: 409 })
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: requestedEmail,
          // The token proves control of the new address, so the account is
          // marked verified (no-op for already-verified users).
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
          updatedAt: new Date(),
        },
        include: { brokerProfile: { take: 1 }, brokerRegistration: true, companyMemberships: { where: { isActive: true }, take: 1 } },
      })

      return NextResponse.json({
        success: true,
        message: 'Email address updated successfully',
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          emailVerified: updatedUser.emailVerified,
          redirectTo: '/',
        },
      })
    }

    // Signup verification (first-time email verification). Broker registration
    // and admin-created broker claim tokens remain available only long enough for
    // the same Auth.js request to exchange them for a normal session; the
    // credentials provider consumes the token. This lets a claimant who created
    // their account with a password continue WITHOUT re-entering it.
    const claimContext = await getClaimContext()
    const isBrokerRegistration = Boolean(user.brokerRegistration?.id)
    const preserveTokenForSignIn = isBrokerRegistration || Boolean(claimContext)
    // Atomic token consumption: the update is gated on the exact token that was
    // read, so a stale/in-flight request cannot consume a newer token, and a
    // token can be consumed at most once. Zero matched rows means another
    // request already consumed this token (or a newer token replaced it).
    const expectedTokenHash = emailChangeTokenMatched ? emailChangeTokenHash : hashedToken
    const consumed = await prisma.user.updateMany({
      where: { id: user.id, emailVerificationToken: expectedTokenHash },
      data: {
        emailVerified: true,
        ...(preserveTokenForSignIn ? {} : {
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
        }),
        updatedAt: new Date()
      },
    })
    if (consumed.count !== 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification token. Please request a new verification email.' },
        { status: 400 },
      )
    }
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { brokerProfile: { take: 1 }, brokerRegistration: true, companyMemberships: { where: { isActive: true }, take: 1 } },
    })
    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })
    }

    let authenticated = false
    if (preserveTokenForSignIn) {
      try {
        await signIn('credentials', {
          email: updatedUser.email || requestedEmail,
          verificationToken: token,
          redirect: false,
          redirectTo: claimContext ? '/claim-broker/continue' : '/setup',
        })
        authenticated = true
        if (claimContext) {
          // The session is now the authenticated invited claimant. Record the
          // claim reauthentication from the single-use verification token (proof
          // of invited-email control) so completion does not prompt for the
          // password a second time. No claim security check is weakened: the
          // signed context, recipient binding, email verification, and atomic
          // ownership attach all remain in force.
          await setClaimContext({
            ...claimContext,
            reauthenticatedAt: Date.now(),
            reauthenticatedVia: 'credentials',
          })
        }
      } catch (error) {
        console.error('Verification session creation failed:', error)
      }
    }

    // Broker verification is a separate ADMIN event (lib/broker-verification.ts).
    // Email verification must NOT send the "broker account verified" email.

    const baseRedirect = claimContext
      ? '/claim-broker/continue'
      : updatedUser.brokerRegistration?.id ? '/setup'
      : updatedUser.companyMemberships?.length ? '/company/onboarding'
      : updatedUser.brokerProfile?.[0]?.id ? '/setup'
      : '/'

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        emailVerified: updatedUser.emailVerified,
        authenticated,
        redirectTo: appendPlanToRedirect(baseRedirect, plan),
      }
    })
  } catch (error: any) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to verify email' 
      },
      { status: 500 }
    )
  }
}
