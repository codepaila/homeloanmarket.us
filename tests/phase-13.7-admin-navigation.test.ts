import assert from 'node:assert/strict'
import test from 'node:test'
import { adminNavigation, isAdminNavItemActive } from '../lib/admin/navigation'

test('Admin navigation maps the real existing routes', () => {
  const links = adminNavigation.flatMap((group) => group.items).filter((item) => item.href)
  const hrefs = links.map((item) => item.href)
  assert.ok(hrefs.includes('/admin'))
  assert.ok(hrefs.includes('/admin/ads'))
  assert.ok(hrefs.includes('/admin/brokers'))
  assert.ok(hrefs.includes('/admin/media'))
  assert.ok(hrefs.includes('/admin/folders'))
})

test('Admin navigation active matching is scoped, not blanket /admin', () => {
  const all = adminNavigation.flatMap((group) => group.items)
  const dashboard = all.find((item) => item.href === '/admin')!
  const ads = all.find((item) => item.href === '/admin/ads')!
  const brokers = all.find((item) => item.href === '/admin/brokers')!
  const media = all.find((item) => item.href === '/admin/media')!
  const folders = all.find((item) => item.href === '/admin/folders')!

  assert.equal(isAdminNavItemActive('/admin', dashboard), true)
  assert.equal(isAdminNavItemActive('/admin/ads', dashboard), false)
  assert.equal(isAdminNavItemActive('/admin/ads', ads), true)
  assert.equal(isAdminNavItemActive('/admin/ads/list', ads), true)
  assert.equal(isAdminNavItemActive('/admin/ads', brokers), false)
  assert.equal(isAdminNavItemActive('/admin/brokers', brokers), true)
  assert.equal(isAdminNavItemActive('/admin/brokers/create', brokers), true)
  assert.equal(isAdminNavItemActive('/admin/media', media), true)
  assert.equal(isAdminNavItemActive('/admin/media/folders', media), true)
  assert.equal(isAdminNavItemActive('/admin/folders', media), false)
  assert.equal(isAdminNavItemActive('/admin/folders', folders), true)
})

test('Site Management links to real Settings, SEO, and Content routes', () => {
  const siteGroup = adminNavigation.find((group) => group.label === 'Site Management')
  assert.ok(siteGroup)
  const items = siteGroup.items
  const settings = items.find((item) => item.label === 'Settings')
  const seo = items.find((item) => item.label === 'SEO')
  const content = items.find((item) => item.label === 'Content')
  assert.equal(settings?.href, '/admin/settings')
  assert.equal(seo?.href, '/admin/seo')
  assert.equal(content?.href, '/admin/content')
  assert.ok(!settings?.disabled)
  assert.ok(!seo?.disabled)
  assert.ok(!content?.disabled)
})

test('Pages and Navigation CMS items are not presented', () => {
  const labels = adminNavigation.flatMap((group) => group.items.map((item) => item.label))
  assert.equal(labels.includes('Pages'), false)
  assert.equal(labels.includes('Navigation'), false)
})

test('Admin navigation has no duplicate labels', () => {
  const labels = adminNavigation.flatMap((group) => group.items.map((item) => item.label))
  assert.equal(new Set(labels).size, labels.length)
})
