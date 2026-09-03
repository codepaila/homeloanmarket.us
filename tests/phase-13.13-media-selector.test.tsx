import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { MediaSelector } from '../components/admin/media/MediaSelector'
import { BlogForm } from '../components/admin/content/BlogForm'
import { SiteSettingsForm } from '../components/admin/settings/SiteSettingsForm'

test('MediaSelector exposes equal existing-media and device-upload actions', () => {
  const html = renderToStaticMarkup(
    <MediaSelector value={null} onChange={() => undefined} label="Advertisement Image" folder="Advertisements" />,
  )
  assert.ok(html.includes('Select from Media Library'))
  assert.ok(html.includes('Upload from Device'))
  assert.ok(html.includes('Choose an image source'))
})

test('MediaSelector renders a selected asset preview and remove control', () => {
  const html = renderToStaticMarkup(
    <MediaSelector
      value="asset-1"
      selectedAsset={{
        id: 'asset-1',
        title: 'Banner',
        fileName: 'banner.webp',
        originalName: 'banner.webp',
        fileUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
        thumbnailUrl: null,
        mimeType: 'image/webp',
        extension: 'webp',
        fileSize: 100,
        width: 1200,
        height: 800,
        altText: 'Banner',
        tags: [],
        folderId: null,
        uploaderId: 'admin',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }}
      onChange={() => undefined}
    />,
  )
  assert.ok(html.includes('banner.webp'))
  assert.ok(html.includes('Replace'))
  assert.ok(html.includes('Remove'))
})

test('BlogForm keeps the canonical coverImage URL field with the selector', () => {
  const html = renderToStaticMarkup(
    <BlogForm
      action={async () => undefined}
      assets={[]}
      initial={{ title: 'Article', slug: 'article', excerpt: '', content: 'Content', coverImage: '/uploads/media/article.webp', author: 'Admin', category: 'Guides', tags: [], isPublished: false, seoTitle: null, seoDescription: null }}
    />,
  )
  assert.ok(html.includes('Featured Image'))
  assert.ok(html.includes('name="coverImage"'))
  assert.ok(html.includes('value="/uploads/media/article.webp"'))
})

test('SiteSettingsForm exposes reusable logo and favicon setting fields', () => {
  const html = renderToStaticMarkup(
    <SiteSettingsForm
      settings={{
        siteName: 'HomeLoanMarket', siteDescription: '', siteUrl: 'https://homeloanmarket.com', contactEmail: '', contactPhone: '', contactAddress: '', contactStreet: '', contactCity: '', contactState: '', contactZip: '', contactCountry: '', contactBusinessHours: '', defaultCurrency: 'USD', timezone: 'America/New_York', seoTitle: '', seoDescription: '', socialFacebook: null, socialTwitter: null, socialLinkedIn: null, socialInstagram: null, socialYouTube: null, footerDescription: '', copyrightText: '', siteLogo: '/uploads/media/logo.webp', siteFavicon: '/uploads/media/favicon.webp',
      }}
    />,
  )
  assert.ok(html.includes('name="site.logo"'))
  assert.ok(html.includes('name="site.favicon"'))
  assert.ok(html.includes('Site Logo'))
  assert.ok(html.includes('Site Favicon'))
})
