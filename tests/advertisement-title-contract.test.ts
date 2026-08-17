import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')

const validation = read('lib/advertisements/validation.ts')
const services = read('lib/advertisements/services.ts')
const repository = read('lib/advertisements/advertisementRepository.ts')
const utils = read('lib/advertisements/utils.ts')
const wizard = read('components/admin/ads/AdvertisementWizard.tsx')
const editForm = read('components/admin/ads/AdvertisementForm.tsx')
const duplicateDialog = read('components/admin/ads/DuplicateDialog.tsx')
const createRoute = read('app/api/admin/ads/route.ts')
const updateRoute = read('app/api/admin/ads/[id]/route.ts')

test('title schema accepts null and is optional', () => {
  assert.match(validation, /title: z\.string\(\)\.max\(200\)\.nullish\(\)/)
})

test('a shared title normalization helper exists with clear semantics', () => {
  assert.match(utils, /export function normalizeAdvertisementTitle\(value: string \| null \| undefined\)/)
  assert.match(utils, /value === undefined\) return undefined/)
  assert.match(utils, /value === null\) return null/)
  assert.match(utils, /trimmed === '' \? null : trimmed/)
})

test('create normalizes the title before persistence', () => {
  assert.match(services, /advertisementData\.title = normalizeAdvertisementTitle\(/)
})

test('update distinguishes omitted title from cleared title', () => {
  assert.match(services, /if \('title' in advertisementData\)/)
  assert.match(services, /advertisementData\.title = normalizeAdvertisementTitle\(advertisementData\.title as string \| null \| undefined\)/)
})

test('duplicate validates creatives against the destination placement', () => {
  assert.match(services, /await this\.validateCreativeAssignments\(placement, assignments\)/)
})

test('no unsafe title patterns remain in create/update/duplicate paths', () => {
  for (const src of [services, repository, validation, wizard, editForm, duplicateDialog, createRoute, updateRoute]) {
    assert.doesNotMatch(src, /title: data\.title \|\|/, 'title must never fall back with ||')
    assert.doesNotMatch(src, /if \(title\)/, 'title must not be gated with if (title)')
  }
})

test('duplicate repository creates a guaranteed-unique slug and fresh lifecycle', () => {
  assert.match(repository, /let slug = `\$\{baseSlug\}-\$\{Date\.now\(\)\.toString\(36\)\}`/)
  assert.match(repository, /while \(await prisma\.advertisement\.findUnique/)
  assert.match(repository, /isEnabled: copyStatus \? original\.isEnabled : false/)
  assert.match(repository, /isArchived: copyStatus \? original\.isArchived : false/)
})

test('duplicate dialog: title is optional and duplicate is blocked while pending', () => {
  assert.match(duplicateDialog, /title: z\.string\(\)\.max\(200\)\.optional\(\)/)
  assert.match(duplicateDialog, /disabled=\{duplicate\.isPending\}/)
  assert.match(duplicateDialog, /Advertisement duplicated successfully/)
  assert.match(duplicateDialog, /Failed to duplicate advertisement/)
})

test('duplicate API passes copy options through to the service', () => {
  assert.match(updateRoute, /copyImages: body\.copyImages/)
  assert.match(updateRoute, /copySchedule: body\.copySchedule/)
  assert.match(updateRoute, /copyButtonSettings: body\.copyButtonSettings/)
  assert.match(updateRoute, /generateNewSlug: body\.generateNewSlug/)
})

test('wizard normalizes empty title to undefined (null on create)', () => {
  assert.match(wizard, /title: state\.title\.trim\(\) \|\| undefined/)
})

test('edit form does not restore the old title when cleared', () => {
  assert.match(editForm, /value=\{field\.value \?\? ''\}/)
})
