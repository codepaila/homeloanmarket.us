/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auth/verify-email/route.ts - improved version
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { sendBrokerVerificationEmail } from '@/actions/email.action'
import { getClaimContext } from '@/lib/claim-context'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email } = body

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
      include:{brokerProfile:true}
    })

    if (!user && emailChangeTokenHash) {
      user = await prisma.user.findFirst({
        where: { emailVerificationToken: emailChangeTokenHash },
        include: { brokerProfile: true },
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
        include: { brokerProfile: true },
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

    // Signup verification (first-time email verification). The token is
    // single-use and cleared here; emailVerified flips to true.
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
        updatedAt: new Date()
      },
      include:{
        brokerProfile: true
      }
    })

    // Send welcome email if user is a broker
    if (user?.brokerProfile?.id) {
      const broker = await prisma.broker.findUnique({
        where: { id: user.brokerProfile.id },
        include: { user: true }
      })
      
      if (broker) {
        // You might want to send a welcome/verification complete email here
        await sendBrokerVerificationEmail(broker.id)
      }
    }

    const claimContext = await getClaimContext()
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        emailVerified: updatedUser.emailVerified,
        redirectTo: claimContext
          ? '/claim-broker/continue'
          : updatedUser.brokerProfile?.id ? '/setup' : '/'
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
