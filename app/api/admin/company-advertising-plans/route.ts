import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/currentUser'
import prisma from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plans = await prisma.companyAdvertisingPlan.findMany({ orderBy: [{ price: 'asc' }, { name: 'asc' }] })
  return NextResponse.json({ plans })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
  const plan = await prisma.companyAdvertisingPlan.create({
    data: {
      name,
      description: typeof body.description === 'string' ? body.description.trim() : null,
      price: Number.isFinite(Number(body.price)) ? Number(body.price) : 0,
      billingInterval: typeof body.billingInterval === 'string' && body.billingInterval ? body.billingInterval : 'month',
      stripeProductId: typeof body.stripeProductId === 'string' && body.stripeProductId ? body.stripeProductId : null,
      stripePriceId: typeof body.stripePriceId === 'string' && body.stripePriceId ? body.stripePriceId : null,
      features: Array.isArray(body.features) ? body.features.filter((f: unknown): f is string => typeof f === 'string') : [],
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  })
  return NextResponse.json({ success: true, plan }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.description === 'string') data.description = body.description.trim() || null
  if (body.price !== undefined) data.price = Number.isFinite(Number(body.price)) ? Number(body.price) : 0
  if (typeof body.billingInterval === 'string' && body.billingInterval) data.billingInterval = body.billingInterval
  if (typeof body.stripeProductId === 'string') data.stripeProductId = body.stripeProductId || null
  if (typeof body.stripePriceId === 'string') data.stripePriceId = body.stripePriceId || null
  if (Array.isArray(body.features)) data.features = body.features.filter((f: unknown): f is string => typeof f === 'string')
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
  const plan = await prisma.companyAdvertisingPlan.update({ where: { id: body.id }, data })
  return NextResponse.json({ success: true, plan })
}
