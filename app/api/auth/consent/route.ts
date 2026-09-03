import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import { isSameOriginRequest } from '@/lib/origin'
import prisma from '@/lib/prisma'

// Explicit legal-consent boundary for the broker registration flow (notably the
// Google-authenticated path where account creation happens before consent).
//
// Authentication is deliberately NOT treated as consent. A user must
// explicitly accept BOTH the Terms & Conditions and the Privacy Policy on the
// client before this endpoint will persist consent. Any request that omits or
// falsifies either agreement is rejected server-side.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let agreeToTerms = false
  let agreeToPrivacy = false
  try {
    const body = await request.json()
    agreeToTerms = body?.agreeToTerms === true
    agreeToPrivacy = body?.agreeToPrivacy === true
  } catch {
    // Missing/malformed body ⇒ no consent recorded.
  }

  if (!agreeToTerms || !agreeToPrivacy) {
    return NextResponse.json(
      { error: 'You must agree to both the Terms & Conditions and Privacy Policy.' },
      { status: 400 },
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      agreeToTerms: true,
      agreeToPrivacy: true,
    },
  })

  return NextResponse.json({ success: true })
}
