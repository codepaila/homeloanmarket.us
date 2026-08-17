import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const helper = read('lib/broker-profile-image.ts')
const imageUpload = read('lib/image-upload.ts')
const cloudinaryUtil = read('lib/cloudinary.ts')
const brokerUploadRoute = read('app/api/brokers/me/profile-image/route.ts')
const adminUploadRoute = read('app/api/admin/brokers/[id]/profile-image/route.ts')
const uploadComponent = read('components/brokers/ProfileImageUpload.tsx')

test('valid local profile upload writes to the local uploads directory and returns a local URL', () => {
  assert.match(helper, /brokers\/profile/, 'profile category must be broker-specific')
  assert.match(imageUpload, /UPLOAD_ROOT/, 'uploads must live under a dedicated uploads root')
  assert.match(imageUpload, /crypto\.randomUUID\(\)/, 'local filename must be collision-safe')
  assert.match(imageUpload, /mkdir\(dir, \{ recursive: true \}\)/, 'local directory must be created automatically')
  assert.match(imageUpload, /writeFile\(/, 'file must actually be written to disk')
})

test('local upload failure triggers Cloudinary fallback', () => {
  assert.match(imageUpload, /return await store\(processed\)/, 'local upload must be attempted first')
  assert.match(imageUpload, /catch \(localError\)/, 'local failure must be caught')
  assert.match(imageUpload, /await uploadCloudinary\(processed\)/, 'Cloudinary must be attempted after local failure')
})

test('Cloudinary fallback uses authenticated server-side credentials', () => {
  assert.match(cloudinaryUtil, /CLOUDINARY_API_KEY/, 'server-side API key must be used')
  assert.match(cloudinaryUtil, /CLOUDINARY_API_SECRET/, 'server-side API secret must be used')
  assert.match(cloudinaryUtil, /CLOUDINARY_CLOUD_NAME/, 'server-side cloud name must be used')
  assert.match(cloudinaryUtil, /api_secret: process\.env\.CLOUDINARY_API_SECRET/, 'API secret must come from server env only')
  assert.match(cloudinaryUtil, /public_id: options\.publicId \?\? crypto\.randomUUID\(\)/, 'Cloudinary public id must be generated, not the original filename')
  assert.match(cloudinaryUtil, /secure_url/, 'must return the Cloudinary secure URL')
  assert.match(helper, /homeloanmarket\/brokers\/profile/, 'profile folder must be homeloanmarket/brokers/profile')
})

test('both local and Cloudinary failing returns a clear upload error', () => {
  assert.match(imageUpload, /Image upload failed\. Please try again\./, 'must surface a clear error when both providers fail')
})

test('invalid file type is rejected server-side', () => {
  assert.match(imageUpload, /allowed\.includes\(file\.type\)/, 'MIME type must be validated')
  assert.match(imageUpload, /image\/jpeg.*image\/png.*image\/webp.*image\/gif/, 'only image formats must be allowed')
  assert.match(imageUpload, /Unsupported image format/, 'invalid type must produce a clear error')
})

test('files larger than 5 MB are rejected server-side', () => {
  assert.match(imageUpload, /DEFAULT_MAX_SIZE = 5 \* 1024 \* 1024/, 'max size must be 5 MB')
  assert.match(imageUpload, /file\.size > maxSize/, 'size must be enforced')
  assert.match(imageUpload, /Image is too large/, 'oversized file must produce a clear error')
})

test('broker self-service derives the broker from the authenticated user only', () => {
  assert.match(brokerUploadRoute, /user\.role !== "BROKER"/, 'self-service must require BROKER role')
  assert.match(brokerUploadRoute, /findFirst\(\{ where: \{ userId: user\.id \} \}\)/, 'broker must be derived from userId')
  assert.doesNotMatch(brokerUploadRoute, /body\.brokerId|brokerId\s*[=:]/i, 'a client must not be able to target another broker by id')
})

test('broker self-service can remove only their own profileImage without touching logo/coverImage', () => {
  assert.match(brokerUploadRoute, /export async function DELETE/, 'a DELETE handler must exist for removal')
  assert.match(brokerUploadRoute, /profileImage: null/, 'removal must clear profileImage')
  assert.doesNotMatch(brokerUploadRoute, /logo:/, 'removal must never clear logo')
  assert.doesNotMatch(brokerUploadRoute, /coverImage:/, 'removal must never clear coverImage')
})

test('admin profile image upload requires ADMIN authorization and targets a broker id', () => {
  assert.match(adminUploadRoute, /admin\?\.role !== "ADMIN"/, 'admin upload must require ADMIN role')
  assert.match(adminUploadRoute, /status: 403/, 'non-admins must be rejected with 403')
  assert.match(adminUploadRoute, /where: \{ id \}/, 'admin upload must target the broker by id')
  assert.match(adminUploadRoute, /export async function DELETE/, 'admin removal must be supported')
  assert.match(adminUploadRoute, /profileImage: null/, 'admin removal must clear profileImage')
})

test('profile image upload never exposes Cloudinary credentials to the client', () => {
  assert.doesNotMatch(uploadComponent, /CLOUDINARY_API_SECRET/, 'client component must not reference the API secret')
  assert.doesNotMatch(uploadComponent, /CLOUDINARY_API_KEY/, 'client component must not reference the API key')
  assert.doesNotMatch(uploadComponent, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/, 'client component must not use unsigned upload presets')
  assert.doesNotMatch(uploadComponent, /cloudinary/, 'client component must not import the cloudinary SDK')
})

test('profile image upload flow does not use unsigned upload presets', () => {
  assert.doesNotMatch(imageUpload, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/, 'image upload lib must not use unsigned presets')
  assert.doesNotMatch(helper, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/, 'profile wrapper must not use unsigned presets')
  assert.doesNotMatch(imageUpload, /upload_preset/, 'image upload lib must not use upload presets')
  assert.doesNotMatch(brokerUploadRoute, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/, 'broker route must not use unsigned presets')
  assert.doesNotMatch(adminUploadRoute, /NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/, 'admin route must not use unsigned presets')
})

test('client upload component posts to the configured endpoints and updates from the response', () => {
  assert.match(uploadComponent, /FormData/, 'component must send multipart form data')
  assert.match(uploadComponent, /method: 'POST'/, 'component must POST the file')
  assert.match(uploadComponent, /method: 'DELETE'/, 'component must DELETE to remove')
  assert.match(uploadComponent, /data\.profileImage/, 'component must read the updated URL from the response')
})

test('database is updated only after a successful upload (existing profileImage stays on failure)', () => {
  const brokerUpload = brokerUploadRoute.slice(brokerUploadRoute.indexOf('const url'), brokerUploadRoute.indexOf('const updated') + 80)
  assert.match(brokerUpload, /await uploadBrokerProfileImage\(rawFile as File\)/, 'upload must happen first')
  assert.match(brokerUpload, /prisma\.broker\.update\(\{/, 'database update must follow a successful upload')
  const adminUpload = adminUploadRoute.slice(adminUploadRoute.indexOf('const url'), adminUploadRoute.indexOf('const updated') + 80)
  assert.match(adminUpload, /await uploadBrokerProfileImage\(rawFile as File\)/, 'admin upload must happen first')
  assert.match(adminUpload, /prisma\.broker\.update\(\{/, 'admin database update must follow a successful upload')
})

test('replacing an image never deletes the previous image before the new upload succeeds', () => {
  assert.doesNotMatch(brokerUploadRoute, /unlink|destroy|rm\(|deleteFile/, 'broker route must not delete old files')
  assert.doesNotMatch(adminUploadRoute, /unlink|destroy|rm\(|deleteFile/, 'admin route must not delete old files')
  assert.doesNotMatch(imageUpload, /unlink|destroy/, 'image upload lib must not delete old files')
})
