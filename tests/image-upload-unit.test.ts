import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateImageFile,
  uploadImage,
  ImageUploadError,
} from '../lib/image-upload'

function fakeFile(type: string, size: number): File {
  return { type, size } as unknown as File
}

const LOGO_OPTS = { file: fakeFile('image/png', 100), category: 'brokers/logo', cloudinaryFolder: 'homeloanmarket/brokers/logo' }

test('logo upload succeeds locally and Cloudinary is NOT called', async () => {
  let cloudinaryCalled = false
  const url = await uploadImage(
    { ...LOGO_OPTS, file: fakeFile('image/png', 100) },
    {
      processImage: async () => Buffer.from('processed'),
      storeLocally: async () => '/uploads/brokers/logo/abc.webp',
      uploadToCloudinary: async () => {
        cloudinaryCalled = true
        return 'https://res.cloudinary.com/example/logo.webp'
      },
    },
  )
  assert.equal(url, '/uploads/brokers/logo/abc.webp')
  assert.equal(cloudinaryCalled, false)
})

test('cover upload succeeds locally and Cloudinary is NOT called', async () => {
  let cloudinaryCalled = false
  const url = await uploadImage(
    { file: fakeFile('image/jpeg', 100), category: 'brokers/cover', cloudinaryFolder: 'homeloanmarket/brokers/cover' },
    {
      processImage: async () => Buffer.from('processed'),
      storeLocally: async () => '/uploads/brokers/cover/abc.webp',
      uploadToCloudinary: async () => {
        cloudinaryCalled = true
        return 'https://res.cloudinary.com/example/cover.webp'
      },
    },
  )
  assert.equal(url, '/uploads/brokers/cover/abc.webp')
  assert.equal(cloudinaryCalled, false)
})

test('avatar upload succeeds locally and Cloudinary is NOT called', async () => {
  let cloudinaryCalled = false
  const url = await uploadImage(
    { file: fakeFile('image/webp', 100), category: 'users/avatar', cloudinaryFolder: 'homeloanmarket/users/avatar' },
    {
      processImage: async () => Buffer.from('processed'),
      storeLocally: async () => '/uploads/users/avatar/abc.webp',
      uploadToCloudinary: async () => {
        cloudinaryCalled = true
        return 'https://res.cloudinary.com/example/avatar.webp'
      },
    },
  )
  assert.equal(url, '/uploads/users/avatar/abc.webp')
  assert.equal(cloudinaryCalled, false)
})

test('local failure falls back to Cloudinary and returns the Cloudinary secure_url', async () => {
  let cloudinaryCalled = false
  const url = await uploadImage(
    { ...LOGO_OPTS },
    {
      processImage: async () => Buffer.from('processed'),
      storeLocally: async () => {
        throw new Error('simulated disk failure')
      },
      uploadToCloudinary: async () => {
        cloudinaryCalled = true
        return 'https://res.cloudinary.com/example/logo.webp'
      },
    },
  )
  assert.equal(url, 'https://res.cloudinary.com/example/logo.webp')
  assert.equal(cloudinaryCalled, true)
})

test('when local and Cloudinary both fail, a safe upload error is returned', async () => {
  await assert.rejects(
    uploadImage(
      { ...LOGO_OPTS },
      {
        processImage: async () => Buffer.from('processed'),
        storeLocally: async () => {
          throw new Error('disk failure')
        },
        uploadToCloudinary: async () => null,
      },
    ),
    ImageUploadError,
  )
})

test('invalid MIME type is rejected before any upload provider runs', async () => {
  let storeCalled = false
  await assert.rejects(
    uploadImage(
      { ...LOGO_OPTS, file: fakeFile('application/pdf', 100) },
      {
        processImage: async () => Buffer.from('processed'),
        storeLocally: async () => {
          storeCalled = true
          return '/uploads/x.webp'
        },
        uploadToCloudinary: async () => 'https://res.cloudinary.com/x.webp',
      },
    ),
    ImageUploadError,
  )
  assert.equal(storeCalled, false)
})

test('oversized image is rejected', () => {
  assert.throws(
    () => validateImageFile(fakeFile('image/png', 5 * 1024 * 1024 + 1)),
    ImageUploadError,
  )
})

test('invalid image content is rejected', async () => {
  await assert.rejects(
    uploadImage(
      { ...LOGO_OPTS },
      {
        processImage: async () => {
          throw new Error('sharp: unsupported input')
        },
        storeLocally: async () => '/uploads/x.webp',
        uploadToCloudinary: async () => 'https://res.cloudinary.com/x.webp',
      },
    ),
    ImageUploadError,
  )
})
