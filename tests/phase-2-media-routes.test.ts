import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), 'utf8')

test('Phase 2 media lifecycle exposes authenticated restore and move routes', () => {
  const restore = read('app/api/admin/media/[id]/restore/route.ts')
  const move = read('app/api/admin/media/[id]/move/route.ts')
  assert.ok(restore.includes("user.role !== 'ADMIN'"))
  assert.ok(restore.includes('MediaService.restoreAsset'))
  assert.ok(move.includes("user.role !== 'ADMIN'"))
  assert.ok(move.includes('MediaService.moveAsset'))
})

test('Phase 2 media move validates the requested folder ID', () => {
  const source = read('lib/advertisements/mediaRepository.ts')
  assert.ok(source.includes('where: { id: folderId, isDeleted: false }'))
})
