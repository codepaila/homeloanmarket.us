import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const wizard = read('components/admin/ads/AdvertisementWizard.tsx')
const ownerSelector = read('components/admin/ads/OwnerSelector.tsx')
const editForm = read('components/admin/ads/AdvertisementForm.tsx')
const createRoute = read('app/api/admin/ads/route.ts')
const service = read('lib/advertisements/services.ts')
const repository = read('lib/advertisements/advertisementRepository.ts')
const getRoute = read('app/api/admin/ads/[id]/route.ts')
const types = read('lib/advertisements/types.ts')
const typesHook = read('hooks/useAdminAds.ts')

test('shared owner type exists', () => {
  assert.match(types, /export type AdvertisementOwner =/)
  assert.match(types, /type: 'PLATFORM'; companyId: null/)
  assert.match(types, /type: 'COMPANY'; companyId: string/)
  assert.match(types, /export type AdvertisementRequestContext =/)
  assert.match(types, /locked: true/)
})

test('wizard adds an Owner step only for direct creation', () => {
  assert.match(wizard, /key: 'owner', label: 'Owner'/)
  assert.match(wizard, /if \(!requestContext\) list\.push\(/)
  assert.match(wizard, /OwnerSelector/)
  assert.match(wizard, /effectiveCompanyId = requestContext/)
})

test('wizard sends companyId + requestId to the server (no client-side linking)', () => {
  assert.match(wizard, /companyId: effectiveCompanyId \|\| undefined/)
  assert.match(wizard, /requestId: requestContext\?\.requestId/)
  assert.doesNotMatch(wizard, /company-ad-requests\/\$\{requestId\}/)
  assert.doesNotMatch(wizard, /status: 'FULFILLED'/)
})

test('owner selector offers Platform and Specific Company with locked request context', () => {
  assert.match(ownerSelector, /Platform \/ No Company/)
  assert.match(ownerSelector, /Specific Company/)
  assert.match(ownerSelector, /role="radio"/)
  assert.match(ownerSelector, /requestContext\.companyId/)
  assert.match(ownerSelector, /Locked/)
  assert.match(ownerSelector, /Select an active company/)
})

test('service createFromRequest derives company and fulfills atomically server-side', () => {
  assert.match(service, /static async createFromRequest/)
  assert.match(service, /companyId: requestRecord\.companyId/)
  assert.match(service, /status: 'FULFILLED'/)
  assert.match(service, /advertisementId: ad\.id/)
  assert.match(service, /already fulfilled by an advertisement/)
})

test('create API uses createFromRequest for request flows and validates company for direct flows', () => {
  assert.match(createRoute, /AdvertisementService\.createFromRequest/)
  assert.match(createRoute, /The selected company is not active/)
  assert.match(createRoute, /const companyId = createData\.companyId \|\| null/)
})

test('edit form locks ownership when the ad is request-linked', () => {
  assert.match(editForm, /requestContext\?: AdvertisementRequestContext/)
  assert.match(editForm, /companyId: requestContext \? requestContext\.companyId :/)
  assert.match(editForm, /<OwnerSelector/)
  assert.match(editForm, /requestContext=\{requestContext\}/)
})

test('ad GET route exposes the linked request context for edit locking', () => {
  assert.match(getRoute, /companyAdRequest\.findFirst/)
  assert.match(getRoute, /requestContext: linkedRequest/)
  assert.match(getRoute, /locked: true/)
})

test('admin companies hook exists for the owner selector', () => {
  assert.match(typesHook, /export function useAdminCompanies\(\)/)
  assert.match(typesHook, /\/api\/admin\/companies/)
})

test('duplicate preserves companyId and never copies a request', () => {
  assert.match(repository, /companyId: original\.companyId \?\? undefined/)
  assert.doesNotMatch(repository, /companyAdRequest/)
  assert.match(service, /validateCreativeAssignments\(placement, assignments\)/)
})
