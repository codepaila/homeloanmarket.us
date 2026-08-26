/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/account-deletion.ts
//
// Canonical account-deletion service. Every deletion path (broker self-service,
// company self-service, plain-user self-service, admin broker deletion, admin
// company deletion) funnels through this single service. The service:
//
//   1. resolves the target account and its ownership,
//   2. cancels applicable Stripe subscriptions BEFORE any local destruction,
//   3. discovers related records and cleans external media only when ownership
//      is exclusive,
//   4. executes local destructive deletion inside a single Prisma transaction,
//   5. never deletes an ADMIN account, never deletes a User that still has
//      independent account context (other company memberships / other broker),
//   6. is retry-safe: a failed Stripe cancellation aborts with a safe error and
//      leaves every local identifier intact.
//
// IMPORTANT: MongoDB does NOT support interactive transactions. The destructive
// phase therefore uses `prisma.$transaction([...])` (sequential operations),
// which the MongoDB connector supports and rolls back atomically when any
// operation fails.

import prisma from '@/lib/prisma'
import { stripeClient } from '@/lib/stripe-config'
import { isCloudinaryConfigured } from '@/lib/cloudinary'
import { unlink } from 'fs/promises'
import path from 'path'
import { Prisma } from '@prisma/client'

type StripeClientFactory = typeof stripeClient
let stripeClientFactory: StripeClientFactory = stripeClient

type CloudinaryDestroyer = (url: string | null | undefined) => Promise<void>
let cloudinaryDestroyer: CloudinaryDestroyer | null = null

export function __setAccountDeletionTestHooks(hooks: { stripeClient?: StripeClientFactory; cloudinaryDestroy?: CloudinaryDestroyer } | null): void {
  stripeClientFactory = hooks?.stripeClient ?? stripeClient
  cloudinaryDestroyer = hooks?.cloudinaryDestroy ?? null
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AccountDeletionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'AccountDeletionError'
  }
}

// Thrown when Stripe cancellation fails. The local account must NOT be
// touched: the caller returns a safe failure and allows retry.
export class AccountDeletionStripeError extends AccountDeletionError {
  constructor(message: string) {
    super(message, 'STRIPE_CANCELLATION_FAILED')
    this.name = 'AccountDeletionStripeError'
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

export const TERMINAL_STRIPE_STATUSES = new Set([
  'canceled',
  'incomplete_expired',
])

export const ACTIVE_STRIPE_STATUSES = new Set([
  'active',
  'trialing',
  'incomplete',
  'past_due',
  'unpaid',
  'paused',
])

export function isTerminalStripeStatus(status: string): boolean {
  return TERMINAL_STRIPE_STATUSES.has(status)
}

export function isActiveStripeStatus(status: string): boolean {
  return ACTIVE_STRIPE_STATUSES.has(status)
}

export function isStripeResourceMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { type?: unknown; code?: unknown }
  if (candidate.code === 'resource_missing') return true
  if (candidate.type === 'StripeInvalidRequestError') {
    return true
  }
  return false
}

export function dedupeStripeSubIds(...ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}

export function isLocalAssetUrl(url: string | null | undefined): url is string {
  return Boolean(url && url.startsWith('/uploads/'))
}

// Maps a stored file URL to the local file path (public/uploads/media/...).
// Only local `/uploads/` URLs map to disk; external (Cloudinary) URLs are
// skipped here and handled best-effort via public-id extraction.
export function localPathForAssetUrl(url: string | null | undefined): string | null {
  if (!isLocalAssetUrl(url)) return null
  const clean = url.split('?')[0]?.split('#')[0] ?? ''
  return path.join(process.cwd(), 'public', clean)
}

// Best-effort deletion of the underlying local file for a stored URL. Never
// throws: a file already gone (or unreachable) is not a failure for the
// deletion workflow.
export async function removeLocalFileByUrl(url: string | null | undefined): Promise<void> {
  const filePath = localPathForAssetUrl(url)
  if (!filePath) return
  try {
    await unlink(filePath)
  } catch {
    // Already removed or unavailable.
  }
}

// Derives the Cloudinary public_id from a res.cloudinary.com URL (e.g.
// ".../upload/v123/homeloanmarket/brokers/logo/<uuid>.webp" ->
// "homeloanmarket/brokers/logo/<uuid>"). Returns null for any other URL.
export function cloudinaryPublicIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const isCloudinaryHost = parsed.hostname === 'res.cloudinary.com' || parsed.hostname.endsWith('.res.cloudinary.com')
    if (!isCloudinaryHost) return null
    const segments = parsed.pathname.split('/').filter(Boolean)
    const uploadIndex = segments.indexOf('upload')
    // Path shape: <cloud>/image/upload/v<version>/<public_id>.<ext>
    if (uploadIndex === -1 || uploadIndex >= segments.length - 1) return null
    let publicIdSegments = segments.slice(uploadIndex + 1)
    if (publicIdSegments[0] && /^v\d+$/.test(publicIdSegments[0])) {
      publicIdSegments = publicIdSegments.slice(1)
    }
    const publicId = publicIdSegments
      .join('/')
      .replace(/\.[a-z0-9]+$/i, '')
    return publicId || null
  } catch {
    return null
  }
}

// Best-effort deletion of a Cloudinary asset by deriving its public_id from the
// stored URL. Never throws; only runs when Cloudinary is configured.
async function defaultRemoveCloudinaryFileByUrl(url: string | null | undefined): Promise<void> {
  const publicId = cloudinaryPublicIdFromUrl(url)
  if (!publicId || !isCloudinaryConfigured()) return
  try {
    const { v2: cloudinary } = await import('cloudinary')
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    })
    await cloudinary.uploader.destroy(publicId)
  } catch {
    // Best-effort only.
  }
}

export async function removeCloudinaryFileByUrl(url: string | null | undefined): Promise<void> {
  if (cloudinaryDestroyer) {
    await cloudinaryDestroyer(url)
    return
  }
  await defaultRemoveCloudinaryFileByUrl(url)
}

// Removes a stored file whether it lives locally (public/uploads) or on
// Cloudinary. Both are best-effort and never throw.
export async function removeStoredFileByUrl(url: string | null | undefined): Promise<void> {
  await removeLocalFileByUrl(url)
  await removeCloudinaryFileByUrl(url)
}

// ---------------------------------------------------------------------------
// Stripe cancellation (idempotent, fail-safe)
// ---------------------------------------------------------------------------

export type StripeCancelResult =
  | { outcome: 'cancelled' }
  | { outcome: 'already-cancelled' }
  | { outcome: 'missing' }

// Cancels a single Stripe subscription if it still exists and is cancellable.
//   - no id / already canceled / resource missing  -> continue (idempotent)
//   - Stripe unreachable or any other failure       -> THROW (STOP deletion)
// The caller must NOT delete local subscription identifiers on failure.
export async function cancelStripeSubscription(
  stripeSubId: string | null | undefined,
  idempotencyKey: string,
): Promise<StripeCancelResult> {
  if (!stripeSubId) return { outcome: 'missing' }

  let stripe: Awaited<ReturnType<typeof stripeClientFactory>>
  try {
    stripe = await stripeClientFactory()
  } catch (error) {
    throw new AccountDeletionStripeError(
      error instanceof Error ? error.message : 'Stripe is not configured',
    )
  }

  let subscription: any
  try {
    subscription = await stripe.subscriptions.retrieve(stripeSubId)
  } catch (error) {
    if (isStripeResourceMissingError(error)) return { outcome: 'missing' }
    throw new AccountDeletionStripeError(
      error instanceof Error ? error.message : 'Unable to reach Stripe',
    )
  }

  if (isTerminalStripeStatus(subscription.status)) {
    return { outcome: 'already-cancelled' }
  }

  try {
    await stripe.subscriptions.cancel(subscription.id, {}, { idempotencyKey })
    return { outcome: 'cancelled' }
  } catch (error) {
    if (isStripeResourceMissingError(error)) return { outcome: 'missing' }
    throw new AccountDeletionStripeError(
      error instanceof Error ? error.message : 'Stripe cancellation failed',
    )
  }
}

// ---------------------------------------------------------------------------
// Discovery types
// ---------------------------------------------------------------------------

export type DeletionActor = {
  userId: string
  role: 'ADMIN' | 'BROKER' | 'USER'
}

export type BrokerDeletionTarget = {
  brokerId: string
}

export type CompanyDeletionTarget = {
  companyId: string
}

export type UserDeletionTarget = {
  userId: string
}

export type AccountDeletionResult = {
  deleted: {
    broker?: boolean
    company?: boolean
    user?: boolean
  }
  stripeCancelled: string[]
  mediaRemoved: number
}

// ---------------------------------------------------------------------------
// User context policy
// ---------------------------------------------------------------------------

// A User may only be deleted when they have no remaining independent account
// context. An ADMIN is never deleted through any broker/company endpoint.
// `excludeBrokerId` / `excludeCompanyId` let a deletion exclude the very
// entity being deleted (e.g. the company being deleted must not count as the
// owner's "remaining context").
export async function userHasIndependentContext(
  userId: string,
  options: { excludeBrokerId?: string; excludeCompanyId?: string } = {},
): Promise<boolean> {
  const [user, companyMembership, otherBroker] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    prisma.companyMembership.findFirst({
      where: {
        userId,
        isActive: true,
        ...(options.excludeCompanyId ? { companyId: { not: options.excludeCompanyId } } : {}),
      },
      select: { id: true },
    }),
    prisma.broker.findFirst({
      where: { userId, ...(options.excludeBrokerId ? { id: { not: options.excludeBrokerId } } : {}) },
      select: { id: true },
    }),
  ])

  if (!user) return true
  if (user.role === 'ADMIN') return true
  if (companyMembership) return true
  if (otherBroker) return true
  return false
}

export async function canDeleteUser(
  userId: string,
  options: { excludeBrokerId?: string; excludeCompanyId?: string } = {},
): Promise<boolean> {
  return !(await userHasIndependentContext(userId, options))
}

// ---------------------------------------------------------------------------
// Reference-aware media cleanup
// ---------------------------------------------------------------------------

export type MediaCleanupPlan = {
  /** MediaAsset rows that become unreferenced and must be hard-deleted. */
  assetIdsToDelete: string[]
  /** Stored URLs (broker/user profile images etc.) removed best-effort. */
  externalFiles: string[]
}

// Computes which of the candidate media assets are safe to delete once the
// `adsBeingDeleted` set is removed. Assets still referenced by any surviving
// advertisement (desktop/mobile/creative) are preserved.
export async function planMediaCleanup(
  candidateAssetIds: string[],
  adsBeingDeleted: string[],
): Promise<MediaCleanupPlan> {
  const uniqueAssetIds = Array.from(new Set(candidateAssetIds))
  const assetIdsToDelete: string[] = []
  const externalFiles: string[] = []

  if (uniqueAssetIds.length === 0) return { assetIdsToDelete, externalFiles }

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: uniqueAssetIds } },
    select: {
      id: true,
      fileUrl: true,
      thumbnailUrl: true,
    },
  })

  const notInAds: string[] | undefined = adsBeingDeleted.length > 0 ? adsBeingDeleted : undefined

  for (const asset of assets) {
    const [desktopRefs, mobileRefs, creativeRefs] = await Promise.all([
      prisma.advertisement.count({
        where: {
          desktopMediaId: asset.id,
          ...(notInAds ? { id: { notIn: notInAds } } : {}),
        },
      }),
      prisma.advertisement.count({
        where: {
          mobileMediaId: asset.id,
          ...(notInAds ? { id: { notIn: notInAds } } : {}),
        },
      }),
      prisma.advertisementCreative.count({
        where: {
          mediaAssetId: asset.id,
          ...(notInAds
            ? { advertisement: { id: { notIn: notInAds } } }
            : {}),
        },
      }),
    ])

    if (desktopRefs + mobileRefs + creativeRefs === 0) {
      assetIdsToDelete.push(asset.id)
      if (isLocalAssetUrl(asset.fileUrl)) externalFiles.push(asset.fileUrl)
      if (isLocalAssetUrl(asset.thumbnailUrl)) externalFiles.push(asset.thumbnailUrl)
    }
  }

  return { assetIdsToDelete, externalFiles }
}

// ---------------------------------------------------------------------------
// Deletion operation builders
// ---------------------------------------------------------------------------

type Ops = Prisma.PrismaPromise<unknown>[]

function userDeletionOps(userId: string, ticketIds: string[]): Ops {
  const ops: Ops = []

  ops.push(prisma.notification.deleteMany({ where: { userId } }))

  if (ticketIds.length > 0) {
    ops.push(prisma.supportMessage.deleteMany({ where: { ticketId: { in: ticketIds } } }))
  }
  ops.push(prisma.supportTicket.deleteMany({ where: { userId } }))

  // Messages where the deleted user is either party.
  ops.push(
    prisma.message.deleteMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    }),
  )

  // Contact messages the deleted user submitted to brokers.
  ops.push(prisma.contactMessage.deleteMany({ where: { userId } }))

  // Reviews authored by the deleted user.
  ops.push(prisma.review.deleteMany({ where: { userId } }))

  // Company advertisement requests created by the deleted user (NoAction on
  // requestedBy — these would otherwise block the User delete).
  ops.push(prisma.companyAdRequest.deleteMany({ where: { requestedById: userId } }))

  // Advertisements the deleted user updated are re-pointed away (NoAction on
  // updatedBy).
  ops.push(prisma.advertisement.updateMany({ where: { updatedById: userId }, data: { updatedById: null } }))

  // Advertisements the deleted user created are fully removed (NoAction on
  // createdBy). Their events/locationTargets/creatives cascade.
  ops.push(prisma.advertisement.deleteMany({ where: { createdById: userId } }))

  // SecureConfig.updatedBy is NoAction and optional — null it out (configs are
  // global and must never be deleted here).
  ops.push(prisma.secureConfig.updateMany({ where: { updatedById: userId }, data: { updatedById: null } }))

  return ops
}

// Builds the full destructive operation list for deleting one broker and, when
// the ownership policy allows it, the associated User. Media assets passed via
// `mediaAssetIds` (already reference-checked) are hard-deleted here.
export function buildBrokerDeletionOps(params: {
  brokerId: string
  claimId?: string
  /** When set, the User is fully deleted (all user-owned records). */
  userId?: string
  /** When set, the broker-registration flow data for this User is removed. */
  registrationUserId?: string
  supportTicketIds: string[]
  mediaAssetIds: string[]
}): Ops {
  const { brokerId, claimId, userId, registrationUserId, supportTicketIds, mediaAssetIds } = params
  const ops: Ops = []

  // Claim lifecycle (NoAction everywhere — explicit, ordered cleanup).
  if (claimId) {
    ops.push(prisma.brokerClaimEvent.deleteMany({ where: { brokerClaimId: claimId } }))
    ops.push(prisma.brokerClaimInvitation.deleteMany({ where: { brokerClaimId: claimId } }))
    ops.push(prisma.brokerClaim.deleteMany({ where: { id: claimId } }))
  }

  // Broker-owned rows (all required relations to Broker; deleting Broker
  // directly would be blocked by Restrict defaults).
  ops.push(prisma.brokerBank.deleteMany({ where: { brokerId } }))
  ops.push(prisma.contactMessage.deleteMany({ where: { brokerId } }))
  ops.push(prisma.review.deleteMany({ where: { brokerId } }))
  ops.push(prisma.brokerSubscription.deleteMany({ where: { brokerId } }))
  ops.push(prisma.broker.deleteMany({ where: { id: brokerId } }))

  if (mediaAssetIds.length > 0) {
    ops.push(prisma.mediaAsset.deleteMany({ where: { id: { in: mediaAssetIds } } }))
  }

  if (registrationUserId) {
    // The broker-registration flow data (registration + its subscription and
    // onboarding draft) belongs to the broker account. Explicitly removed even
    // when the User survives (e.g. the User is a member of a company).
    ops.push(prisma.brokerRegistration.deleteMany({ where: { userId: registrationUserId } }))
  }

  if (userId) {
    ops.push(...userDeletionOps(userId, supportTicketIds))
    ops.push(prisma.user.deleteMany({ where: { id: userId } }))
  }

  return ops
}

// Builds the full destructive operation list for deleting one company and,
// when ownership policy allows it, any owner/member Users with no remaining
// context.
export function buildCompanyDeletionOps(params: {
  companyId: string
  advertisementIds: string[]
  userIdsToDelete: string[]
  supportTicketIdsByUser: Record<string, string[]>
  mediaAssetIds: string[]
}): Ops {
  const { companyId, advertisementIds, userIdsToDelete, supportTicketIdsByUser, mediaAssetIds } = params
  const ops: Ops = []

  // Company advertisements (NoAction on companyId) — events/locationTargets/
  // creatives cascade from each Advertisement.
  if (advertisementIds.length > 0) {
    ops.push(prisma.advertisement.deleteMany({ where: { id: { in: advertisementIds } } }))
  }

  // Company advertisement requests (companyId Cascade, but explicit for
  // clarity and ordering).
  ops.push(prisma.companyAdRequest.deleteMany({ where: { companyId } }))

  // Subscription (companyId Cascade) and memberships (companyId Cascade).
  ops.push(prisma.companySubscription.deleteMany({ where: { companyId } }))
  ops.push(prisma.companyMembership.deleteMany({ where: { companyId } }))

  if (mediaAssetIds.length > 0) {
    ops.push(prisma.mediaAsset.deleteMany({ where: { id: { in: mediaAssetIds } } }))
  }

  ops.push(prisma.company.deleteMany({ where: { id: companyId } }))

  for (const userId of userIdsToDelete) {
    const ticketIds = supportTicketIdsByUser[userId] ?? []
    ops.push(...userDeletionOps(userId, ticketIds))
    // Any remaining CompanyMembership rows for this user (e.g. memberships in
    // OTHER companies) are intentionally left intact — the user is only being
    // deleted when they have no such remaining context.
    ops.push(prisma.user.deleteMany({ where: { id: userId } }))
  }

  return ops
}

// ---------------------------------------------------------------------------
// AccountDeletionService
// ---------------------------------------------------------------------------

export class AccountDeletionService {
  /**
   * Deletes a broker account together with all broker-owned records, claim
   * lifecycle data, exclusive media, and (per ownership policy) the associated
   * User. Used by BOTH the broker self-service route and the admin broker
   * deletion route. The caller is responsible for authorization/ownership.
   */
  static async deleteBrokerAccount(target: BrokerDeletionTarget, actor: DeletionActor): Promise<AccountDeletionResult> {
    const broker = await prisma.broker.findUnique({
      where: { id: target.brokerId },
      include: {
        subscription: true,
        claim: {
          select: { id: true },
        },
      },
    })
    if (!broker) throw new AccountDeletionError('Broker not found', 'BROKER_NOT_FOUND')

    const user = broker.userId
      ? await prisma.user.findUnique({
          where: { id: broker.userId },
          select: { id: true, role: true, image: true },
        })
      : null

    if (user && user.role === 'ADMIN') {
      throw new AccountDeletionError('Admin accounts cannot be deleted through a broker endpoint', 'ADMIN_DELETION_FORBIDDEN')
    }
    if (user && actor.role === 'ADMIN' && user.id === actor.userId) {
      throw new AccountDeletionError('You cannot delete your own admin account through a broker endpoint', 'SELF_ADMIN_DELETION_FORBIDDEN')
    }

    // --- Stripe cancellation (BEFORE any local destruction) ------------------
    // A broker may hold a BrokerSubscription and/or a BrokerRegistrationSubscription
    // (the registration subscription's Stripe ids are copied onto the broker
    // subscription at onboarding; both may reference the SAME subscription, so
    // ids are deduplicated and cancelled once).
    const registration = user
      ? await prisma.brokerRegistration.findUnique({
          where: { userId: user.id },
          select: { subscription: { select: { stripeSubId: true } } },
        })
      : null

    const stripeSubIds = dedupeStripeSubIds(
      broker.subscription?.stripeSubId,
      registration?.subscription?.stripeSubId,
    )

    const stripeCancelled: string[] = []
    for (const subId of stripeSubIds) {
      const result = await cancelStripeSubscription(
        subId,
        `account_delete_broker_${broker.id}_${subId}`,
      )
      if (result.outcome === 'cancelled') stripeCancelled.push(subId)
    }

    // --- Discovery -----------------------------------------------------------
    const adsCreatedByUser = user
      ? await prisma.advertisement.findMany({ where: { createdById: user.id }, select: { id: true } })
      : []
    const adsBeingDeleted = adsCreatedByUser.map((ad) => ad.id)

    // Candidate media: everything the user uploaded. Assets still referenced by
    // any surviving advertisement are preserved.
    let mediaPlan: MediaCleanupPlan = { assetIdsToDelete: [], externalFiles: [] }
    if (user) {
      const userMedia = await prisma.mediaAsset.findMany({
        where: { uploaderId: user.id },
        select: { id: true },
      })
      mediaPlan = await planMediaCleanup(
        userMedia.map((asset) => asset.id),
        adsBeingDeleted,
      )
    }

    // Broker profile images and the user avatar are plain stored URLs; remove
    // the underlying local files best-effort once the rows are gone.
    const profileUrls = [
      broker.logo,
      broker.coverImage,
      broker.profileImage,
      user?.image ?? null,
    ]
    for (const url of profileUrls) {
      if (isLocalAssetUrl(url)) mediaPlan.externalFiles.push(url)
    }

    // --- Local destructive transaction --------------------------------------
    const ticketIds = user
      ? (await prisma.supportTicket.findMany({ where: { userId: user.id }, select: { id: true } })).map((t) => t.id)
      : []

    const shouldDeleteUser = user ? await canDeleteUser(user.id, { excludeBrokerId: broker.id }) : false

    const ops = buildBrokerDeletionOps({
      brokerId: broker.id,
      claimId: broker.claim?.id,
      userId: user && shouldDeleteUser ? user.id : undefined,
      registrationUserId: user ? user.id : undefined,
      supportTicketIds: ticketIds,
      mediaAssetIds: mediaPlan.assetIdsToDelete,
    })

    await prisma.$transaction(ops)

    // --- Post-transaction best-effort file cleanup ---------------------------
    for (const url of mediaPlan.externalFiles) {
      await removeStoredFileByUrl(url)
    }

    return {
      deleted: { broker: true, user: user ? shouldDeleteUser : undefined },
      stripeCancelled,
      mediaRemoved: mediaPlan.assetIdsToDelete.length,
    }
  }

  /**
   * Deletes a company account together with its subscription, memberships,
   * advertisement requests, company-owned advertisements, exclusive media, and
   * (per ownership policy) users with no remaining independent context. The
   * global CompanyAdvertisingPlan records are never touched.
   */
  static async deleteCompanyAccount(target: CompanyDeletionTarget, actor: DeletionActor): Promise<AccountDeletionResult> {
    const company = await prisma.company.findUnique({
      where: { id: target.companyId },
      include: {
        subscription: true,
        memberships: { select: { userId: true, role: true, isActive: true } },
      },
    })
    if (!company) throw new AccountDeletionError('Company not found', 'COMPANY_NOT_FOUND')

    const memberUserIds = company.memberships.map((membership) => membership.userId)
    const memberUsers = memberUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: memberUserIds } },
          select: { id: true, role: true },
        })
      : []

    if (memberUsers.some((member) => member.role === 'ADMIN')) {
      throw new AccountDeletionError('Admin accounts cannot be deleted through a company endpoint', 'ADMIN_DELETION_FORBIDDEN')
    }
    if (actor.role === 'ADMIN' && memberUsers.some((member) => member.id === actor.userId)) {
      throw new AccountDeletionError('You cannot delete your own admin account through a company endpoint', 'SELF_ADMIN_DELETION_FORBIDDEN')
    }

    // --- Stripe cancellation (BEFORE any local destruction) ------------------
    const stripeCancelled: string[] = []
    if (company.subscription?.stripeSubId) {
      const result = await cancelStripeSubscription(
        company.subscription.stripeSubId,
        `account_delete_company_${company.id}_${company.subscription.stripeSubId}`,
      )
      if (result.outcome === 'cancelled') stripeCancelled.push(company.subscription.stripeSubId)
    }

    // --- Discovery -----------------------------------------------------------
    const companyAds = await prisma.advertisement.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        desktopMediaId: true,
        mobileMediaId: true,
        creatives: { select: { mediaAssetId: true } },
      },
    })
    const advertisementIds = companyAds.map((ad) => ad.id)

    // Candidate media: everything referenced by the company's ads, plus anything
    // uploaded by the company's member users. Assets still referenced by any
    // surviving advertisement are preserved.
    const referencedMediaIds = new Set<string>()
    for (const ad of companyAds) {
      if (ad.desktopMediaId) referencedMediaIds.add(ad.desktopMediaId)
      if (ad.mobileMediaId) referencedMediaIds.add(ad.mobileMediaId)
      for (const creative of ad.creatives) referencedMediaIds.add(creative.mediaAssetId)
    }

    let mediaPlan: MediaCleanupPlan = { assetIdsToDelete: [], externalFiles: [] }
    if (referencedMediaIds.size > 0 || memberUserIds.length > 0) {
      const memberMedia = memberUserIds.length > 0
        ? await prisma.mediaAsset.findMany({
            where: { uploaderId: { in: memberUserIds } },
            select: { id: true },
          })
        : []
      for (const asset of memberMedia) referencedMediaIds.add(asset.id)
      mediaPlan = await planMediaCleanup(Array.from(referencedMediaIds), advertisementIds)
    }

    // --- Which member users are fully deleted? --------------------------------
    // A member user is deleted only when they have no remaining independent
    // account context (no other active memberships, no other broker). This is
    // the "user must never be deleted merely because one company was deleted"
    // rule. The OWNER may therefore survive if they are, e.g., also a broker.
    const userIdsToDelete: string[] = []
    for (const membership of company.memberships.filter((m) => m.isActive)) {
      const canDelete = await canDeleteUser(membership.userId, { excludeCompanyId: company.id })
      if (canDelete) userIdsToDelete.push(membership.userId)
    }
    // Avoid deleting a user twice if they hold two memberships of the same
    // company (schema prevents that, but stay defensive).
    const uniqueUsersToDelete = Array.from(new Set(userIdsToDelete))

    const supportTicketIdsByUser: Record<string, string[]> = {}
    if (uniqueUsersToDelete.length > 0) {
      const tickets = await prisma.supportTicket.findMany({
        where: { userId: { in: uniqueUsersToDelete } },
        select: { id: true, userId: true },
      })
      for (const ticket of tickets) {
        (supportTicketIdsByUser[ticket.userId] ??= []).push(ticket.id)
      }
    }

    // --- Local destructive transaction --------------------------------------
    const ops = buildCompanyDeletionOps({
      companyId: company.id,
      advertisementIds,
      userIdsToDelete: uniqueUsersToDelete,
      supportTicketIdsByUser,
      mediaAssetIds: mediaPlan.assetIdsToDelete,
    })

    await prisma.$transaction(ops)

    // --- Post-transaction best-effort file cleanup ---------------------------
    for (const url of mediaPlan.externalFiles) {
      await removeStoredFileByUrl(url)
    }

    return {
      deleted: { company: true, user: uniqueUsersToDelete.length > 0 },
      stripeCancelled,
      mediaRemoved: mediaPlan.assetIdsToDelete.length,
    }
  }

  /**
   * Deletes a plain User account with no broker/company context. Used by the
   * self-service user route. All User-owned records are removed; the Broker
   * and Company paths use deleteBrokerAccount/deleteCompanyAccount instead.
   */
  static async deleteUserAccount(target: UserDeletionTarget, actor: DeletionActor): Promise<AccountDeletionResult> {
    const user = await prisma.user.findUnique({
      where: { id: target.userId },
      select: { id: true, role: true, image: true },
    })
    if (!user) throw new AccountDeletionError('User not found', 'USER_NOT_FOUND')
    if (user.role === 'ADMIN') {
      throw new AccountDeletionError('Admin accounts cannot be deleted', 'ADMIN_DELETION_FORBIDDEN')
    }
    if (actor.role === 'ADMIN' && user.id === actor.userId) {
      throw new AccountDeletionError('You cannot delete your own admin account', 'SELF_ADMIN_DELETION_FORBIDDEN')
    }

    // A User with a broker profile or an active company membership must go
    // through the broker/company deletion path.
    const [broker, membership] = await Promise.all([
      prisma.broker.findFirst({ where: { userId: user.id }, select: { id: true } }),
      prisma.companyMembership.findFirst({ where: { userId: user.id, isActive: true }, select: { id: true } }),
    ])
    if (broker) {
      throw new AccountDeletionError('This account owns a broker profile. Use the broker account deletion flow.', 'BROKER_CONTEXT_EXISTS')
    }
    if (membership) {
      throw new AccountDeletionError('This account belongs to a company. Use the company account deletion flow.', 'COMPANY_CONTEXT_EXISTS')
    }

    // Registration-only accounts (no broker yet) still hold a registration
    // subscription that may reference Stripe.
    const registration = await prisma.brokerRegistration.findUnique({
      where: { userId: user.id },
      select: { subscription: { select: { stripeSubId: true } } },
    })

    const stripeCancelled: string[] = []
    if (registration?.subscription?.stripeSubId) {
      const result = await cancelStripeSubscription(
        registration.subscription.stripeSubId,
        `account_delete_user_${user.id}_${registration.subscription.stripeSubId}`,
      )
      if (result.outcome === 'cancelled') stripeCancelled.push(registration.subscription.stripeSubId)
    }

    // Media uploaded by the user (reference-aware).
    const userMedia = await prisma.mediaAsset.findMany({
      where: { uploaderId: user.id },
      select: { id: true },
    })
    const mediaPlan = await planMediaCleanup(userMedia.map((asset) => asset.id), [])

    if (isLocalAssetUrl(user.image)) mediaPlan.externalFiles.push(user.image!)

    const ticketIds = (await prisma.supportTicket.findMany({ where: { userId: user.id }, select: { id: true } })).map((t) => t.id)

    const ops: Ops = []
    if (mediaPlan.assetIdsToDelete.length > 0) {
      ops.push(prisma.mediaAsset.deleteMany({ where: { id: { in: mediaPlan.assetIdsToDelete } } }))
    }
    ops.push(...userDeletionOps(user.id, ticketIds))
    ops.push(prisma.user.deleteMany({ where: { id: user.id } }))

    await prisma.$transaction(ops)

    for (const url of mediaPlan.externalFiles) {
      await removeStoredFileByUrl(url)
    }

    return {
      deleted: { user: true },
      stripeCancelled,
      mediaRemoved: mediaPlan.assetIdsToDelete.length,
    }
  }
}
