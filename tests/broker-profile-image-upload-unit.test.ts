import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateProfileImage,
  uploadBrokerProfileImage,
  ProfileImageValidationError,
} from '../lib/broker-profile-image'
import { isCloudinaryConfigured } from '../lib/cloudinary'

function fakeFile(type: string, size: number): File {
  return { type, size } as unknown as File
}

test('validateProfileImage rejects non-image MIME types before any upload', () => {
  assert.throws(() => validateProfileImage(fakeFile('application/pdf', 1000)), ProfileImageValidationError)
  assert.throws(() => validateProfileImage(fakeFile('image/svg+xml', 1000)), ProfileImageValidationError)
  assert.throws(() => validateProfileImage(fakeFile('image/gif', 1000)), ProfileImageValidationError)
  assert.throws(() => validateProfileImage(fakeFile('text/plain', 1000)), ProfileImageValidationError)
})

test('validateProfileImage rejects files larger than 5 MB', () => {
  assert.throws(() => validateProfileImage(fakeFile('image/png', 5 * 1024 * 1024 + 1)), ProfileImageValidationError)
})

test('validateProfileImage accepts JPEG/PNG/WebP within the size limit', () => {
  assert.doesNotThrow(() => validateProfileImage(fakeFile('image/jpeg', 1000)))
  assert.doesNotThrow(() => validateProfileImage(fakeFile('image/png', 1000)))
  assert.doesNotThrow(() => validateProfileImage(fakeFile('image/webp', 5 * 1024 * 1024)))
})

test('valid local upload succeeds and Cloudinary is NOT called', async () => {
  let cloudinaryCalled = false
  const url = await uploadBrokerProfileImage(fakeFile('image/png', 100), {
    processImage: async () => Buffer.from('processed'),
    storeLocally: async () => '/uploads/brokers/profile/abc.webp',
    uploadToCloudinary: async () => {
      cloudinaryCalled = true
      return 'https://res.cloudinary.com/example/image/upload/v1/abc.webp'
    },
  })
  assert.equal(url, '/uploads/brokers/profile/abc.webp')
  assert.equal(cloudinaryCalled, false, 'Cloudinary must not be called when local upload succeeds')
})

test('local upload failure triggers the Cloudinary fallback', async () => {
  let cloudinaryCalled = false
  const url = await uploadBrokerProfileImage(fakeFile('image/jpeg', 100), {
    processImage: async () => Buffer.from('processed'),
    storeLocally: async () => {
      throw new Error('simulated local filesystem failure')
    },
    uploadToCloudinary: async () => {
      cloudinaryCalled = true
      return 'https://res.cloudinary.com/example/image/upload/v1/fallback.webp'
    },
  })
  assert.equal(url, 'https://res.cloudinary.com/example/image/upload/v1/fallback.webp')
  assert.equal(cloudinaryCalled, true, 'Cloudinary fallback must be attempted')
})

test('when local and Cloudinary both fail, a safe upload error is returned', async () => {
  await assert.rejects(
    uploadBrokerProfileImage(fakeFile('image/png', 100), {
      processImage: async () => Buffer.from('processed'),
      storeLocally: async () => {
        throw new Error('simulated local filesystem failure')
      },
      uploadToCloudinary: async () => null,
    }),
    ProfileImageValidationError,
  )
})

test('invalid image content is rejected before any upload provider runs', async () => {
  let storeCalled = false
  let cloudinaryCalled = false
  await assert.rejects(
    uploadBrokerProfileImage(fakeFile('image/png', 100), {
      processImage: async () => {
        throw new Error('sharp: unsupported input format')
      },
      storeLocally: async () => {
        storeCalled = true
        return '/uploads/x.webp'
      },
      uploadToCloudinary: async () => {
        cloudinaryCalled = true
        return 'https://res.cloudinary.com/x.webp'
      },
    }),
    ProfileImageValidationError,
  )
  assert.equal(storeCalled, false)
  assert.equal(cloudinaryCalled, false)
})

test('isCloudinaryConfigured reflects server environment variables', () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  try {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
    process.env.CLOUDINARY_API_KEY = 'test-key'
    process.env.CLOUDINARY_API_SECRET = 'test-secret'
    assert.equal(isCloudinaryConfigured(), true)

    process.env.CLOUDINARY_API_SECRET = ''
    assert.equal(isCloudinaryConfigured(), false, 'missing secret must make Cloudinary unavailable')
  } finally {
    // Restore the original environment so other tests are unaffected.
    process.env.CLOUDINARY_CLOUD_NAME = cloudName || ''
    process.env.CLOUDINARY_API_KEY = apiKey || ''
    process.env.CLOUDINARY_API_SECRET = apiSecret || ''
  }
})
