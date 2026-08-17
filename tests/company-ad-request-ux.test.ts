import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path: string) => fs.readFileSync(path, 'utf8')

const listPage = read('app/admin/company-ad-requests/page.tsx')
const detailPage = read('app/admin/company-ad-requests/[id]/page.tsx')
const createAdPage = read('app/admin/company-ad-requests/[id]/create-ad/page.tsx')
const detailApi = read('app/api/admin/company-ad-requests/[id]/route.ts')
const listApi = read('app/api/admin/company-ad-requests/route.ts')
const companyRequestsApi = read('app/api/company/requests/route.ts')
const form = read('components/admin/ads/AdvertisementForm.tsx')
const navigation = read('lib/admin/navigation.ts')

test('admin request list shows company, plan, location, status, and advertisement columns', () => {
  assert.match(listPage, /Company/)
  assert.match(listPage, /Plan/)
  assert.match(listPage, /Requested Location/)
  assert.match(listPage, /Status/)
  assert.match(listPage, /Submitted/)
  assert.match(listPage, /Advertisement/)
  assert.match(listPage, /View Request/)
})

test('request list page is admin-only', () => {
  assert.match(listPage, /user\.role !== 'ADMIN'/)
})

test('request detail shows a progress workflow and status', () => {
  assert.match(detailPage, /Advertisement Request/)
  assert.match(detailPage, /Under Review/)
  assert.match(detailPage, /Advertisement Created/)
  assert.match(detailPage, /Published/)
  assert.match(detailPage, /Requested Location/)
  assert.match(detailPage, /Advertising Plan/)
  assert.match(detailPage, /Requester/)
})

test('request detail has one primary action per state', () => {
  assert.match(detailPage, /Review Request/)
  assert.match(detailPage, /Approve Request/)
  assert.match(detailPage, /Reject Request/)
  assert.match(detailPage, /Create Advertisement/)
  assert.match(detailPage, /Manage Advertisement/)
})

test('admin request detail API is admin-only and supports status + ad linking', () => {
  assert.match(detailApi, /user\.role !== 'ADMIN'/)
  assert.match(detailApi, /CompanyAdRequestStatus/)
  assert.match(detailApi, /advertisementId/)
  assert.match(detailApi, /reviewedAt: new Date\(\)/)
})

test('create-ad page pre-loads request context and pre-fills the location target', () => {
  assert.match(createAdPage, /Create Advertisement from Request/)
  assert.match(createAdPage, /Company/)
  assert.match(createAdPage, /Request/)
  assert.match(createAdPage, /AdvertisementWizard/)
  assert.match(createAdPage, /initialLocationTarget/)
  assert.match(createAdPage, /companyId=\{company\.id\}/)
  assert.match(createAdPage, /requestId=\{request\.id\}/)
})

test('advertisement form can pre-link a company + request and pre-fill location', () => {
  assert.match(form, /companyId\?: string/)
  assert.match(form, /requestId\?: string/)
  assert.match(form, /initialLocationTarget/)
  assert.match(form, /companyId: ad\?\.companyId \|\| companyId/)
})

test('creating an advertisement from a request links it back and marks the request fulfilled', () => {
  assert.match(form, /company-ad-requests\/\$\{requestId\}/)
  assert.match(form, /advertisementId: result\.ad\.id/)
  assert.match(form, /status: 'FULFILLED'/)
})

test('company request API accepts location targeting', () => {
  assert.match(companyRequestsApi, /targetLocation/)
  assert.match(companyRequestsApi, /radiusMiles/)
  assert.match(companyRequestsApi, /requestDetails/)
})

test('admin navigation groups requests under Companies and advertisements under Advertisements', () => {
  assert.match(navigation, /label: 'Companies'/)
  assert.match(navigation, /Advertisement Requests/)
  assert.match(navigation, /label: 'Advertisements'/)
  assert.match(navigation, /All Advertisements/)
  assert.match(navigation, /Create Advertisement/)
})

test('company can submit an advertisement request with details and location', () => {
  const client = read('app/company/dashboard/CompanyDashboardClient.tsx')
  assert.match(client, /Submit Advertisement Request/)
  assert.match(client, /locationLabel/)
  assert.match(client, /radius/)
  assert.match(client, /My Advertisement Requests/)
})

test('request status metadata uses human-friendly labels', () => {
  const meta = read('lib/advertisements/request-status.ts')
  assert.match(meta, /Waiting for admin review/)
  assert.match(meta, /Admin is reviewing this request/)
  assert.match(meta, /advertisement can be created/)
  assert.match(meta, /Request was rejected/)
})
