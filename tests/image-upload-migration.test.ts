import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const uploadEndpoint = read('app/api/upload/image/route.ts')
const imageUploadComponent = read('components/ImageUpload.tsx')
const brokerMeRoute = read('app/api/brokers/me/route.ts')
const userProfileRoute = read('app/api/user/profile/route.ts')
const envTypes = read('types/environment.d.ts')
const imageUploadLib = read('lib/image-upload.ts')
const cloudinaryUtil = read('lib/cloudinary.ts')

test('generic upload endpoint maps logo/cover/avatar to distinct categories and folders', () => {
  assert.match(uploadEndpoint, /brokers\/logo/, 'logo category must exist')
  assert.match(uploadEndpoint, /homeloanmarket\/brokers\/logo/, 'logo Cloudinary folder must exist')
  assert.match(uploadEndpoint, /brokers\/cover/, 'cover category must exist')
  assert.match(uploadEndpoint, /homeloanmarket\/brokers\/cover/, 'cover Cloudinary folder must exist')
  assert.match(uploadEndpoint, /users\/avatar/, 'avatar category must exist')
  assert.match(uploadEndpoint, /homeloanmarket\/users\/avatar/, 'avatar Cloudinary folder must exist')
})

test('generic upload endpoint requires authentication and enforces broker role for logo/cover', () => {
  assert.match(uploadEndpoint, /Authentication required/, 'unauthenticated upload must be rejected')
  assert.match(uploadEndpoint, /user\.role !== "BROKER"/, 'logo/cover must require BROKER role')
  assert.match(uploadEndpoint, /status: 403/, 'non-brokers must be rejected for logo/cover')
  assert.match(uploadEndpoint, /Only brokers can upload this image type/, 'broker-only types must be explicit')
})

test('generic upload endpoint never writes to the database (returns the URL only)', () => {
  assert.match(uploadEndpoint, /NextResponse\.json\(\{ url \}\)/, 'endpoint must return the URL')
  assert.doesNotMatch(uploadEndpoint, /prisma\./, 'endpoint must not touch the database')
})

test('ImageUpload component no longer performs direct unsigned Cloudinary uploads', () => {
  assert.doesNotMatch(imageUploadComponent, /next-cloudinary/, 'must not import next-cloudinary')
  assert.doesNotMatch(imageUploadComponent, /CldUploadWidget/, 'must not use CldUploadWidget')
  assert.doesNotMatch(imageUploadComponent, /uploadPreset|upload_preset/, 'must not use upload presets')
  assert.match(imageUploadComponent, /\/api\/upload\/image/, 'must POST to the server upload endpoint')
  assert.match(imageUploadComponent, /FormData/, 'must send multipart form data')
  assert.match(imageUploadComponent, /formData\.append\('type', type\)/, 'must send the image type')
  assert.match(imageUploadComponent, /onChange\(data\.url\)/, 'must report the resulting URL via onChange')
})

test('no NEXT_PUBLIC Cloudinary upload preset or cloud name remains in code', () => {
  const codeFiles = [uploadEndpoint, imageUploadComponent, imageUploadLib, cloudinaryUtil, brokerMeRoute, userProfileRoute]
  for (const source of codeFiles) {
    assert.doesNotMatch(source, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/, 'must not reference unsigned upload presets')
    assert.doesNotMatch(source, /NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME/, 'must not reference the public cloud name')
  }
  assert.doesNotMatch(envTypes, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/, 'env types must not declare upload presets')
  assert.doesNotMatch(envTypes, /NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME/, 'env types must not declare public cloud name')
})

test('Cloudinary API secret exists only in the server utility', () => {
  assert.match(cloudinaryUtil, /CLOUDINARY_API_SECRET/, 'server utility must use the secret')
  assert.doesNotMatch(imageUploadComponent, /CLOUDINARY_API_SECRET|CLOUDINARY_API_KEY/, 'client component must not reference credentials')
  assert.doesNotMatch(uploadEndpoint, /NEXT_PUBLIC_CLOUDINARY/, 'upload endpoint must not reference NEXT_PUBLIC cloudinary')
})

test('broker logo/cover database updates remain BROKER-only and derived from the user', () => {
  assert.match(brokerMeRoute, /currentUser\.role !== 'BROKER'/, 'broker route must require BROKER role')
  assert.match(brokerMeRoute, /where: \{ userId: currentUser\.id \}/, 'broker must be derived from userId')
  assert.match(brokerMeRoute, /body\.logo !== undefined/, 'logo must be updatable via the broker PATCH')
  assert.match(brokerMeRoute, /body\.coverImage !== undefined/, 'coverImage must be updatable via the broker PATCH')
  assert.doesNotMatch(brokerMeRoute, /body\.brokerId/, 'must not accept an arbitrary brokerId')
})

test('user avatar database update derives the user from the session, not an arbitrary userId', () => {
  assert.match(userProfileRoute, /where: \{ id: currentUser\.id \}/, 'user update must target currentUser.id')
  assert.match(userProfileRoute, /body\.image !== undefined/, 'image must be updatable via the user PATCH')
  assert.doesNotMatch(userProfileRoute, /body\.userId/, 'must not accept an arbitrary userId')
})

test('shared image upload guards against path traversal', () => {
  assert.match(imageUploadLib, /assertSafeCategory/, 'category must be validated')
  assert.match(imageUploadLib, /a-z0-9\/_-/, 'category must reject path traversal characters')
})
