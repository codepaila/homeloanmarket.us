import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { PlacementPicker } from '../components/admin/ads/PlacementPicker'
import { MediaSelector } from '../components/admin/media/MediaSelector'
import type { MediaAsset } from '../lib/advertisements/types'

function render(children: React.ReactNode): string {
  return renderToStaticMarkup(React.createElement(React.Fragment, null, children))
}

test('PlacementPicker renders canonical placement cards with responsive heights and formats', () => {
  const html = render(<PlacementPicker value="HOMEPAGE_HERO" onChange={() => {}} />)

  // Homepage Hero: full-width 90/120/150 + max 150px desktop + horizontal formats
  assert.ok(html.includes('Homepage Hero'), 'homepage hero card present')
  assert.ok(html.includes('Desktop 150px'), 'desktop height 150px')
  assert.ok(html.includes('Tablet 120px'), 'tablet height 120px')
  assert.ok(html.includes('Mobile 90px'), 'mobile height 90px')
  assert.ok(html.includes('Max 150px desktop'), 'full-width max 150px desktop cap')
  assert.ok(html.includes('Formats: Horizontal'), 'horizontal format listed')

  // Announcement top: thin strip 50/60/70
  assert.ok(html.includes('Announcement Top'), 'announcement top card present')
  assert.ok(html.includes('Desktop 70px'), 'announcement desktop 70px')
  assert.ok(html.includes('Mobile 50px'), 'announcement mobile 50px')

  // Footer: 60/70/80
  assert.ok(html.includes('Desktop 80px'), 'footer desktop 80px')

  // Sidebar: desktop 250px
  assert.ok(html.includes('Desktop 250px'), 'sidebar desktop 250px')
})

test('PlacementPicker exposes no editable height field', () => {
  const html = render(<PlacementPicker value="HOMEPAGE_HERO" onChange={() => {}} />)
  assert.equal(html.includes('<input'), false, 'placement picker must not contain any input')
  assert.equal(html.includes('name="height"'), false, 'no height field')
})

test('PlacementPicker marks the selected placement', () => {
  const html = render(<PlacementPicker value="BROKER_LISTING" onChange={() => {}} />)
  assert.ok(html.includes('aria-pressed="true"'), 'selected card is marked')
})

test('MediaSelector renders selected asset details and compatibility', () => {
  const asset: MediaAsset = {
    id: 'm1',
    title: 'Horizontal banner',
    fileName: 'banner.webp',
    originalName: 'banner.webp',
    fileUrl: '/uploads/media/m1.webp',
    thumbnailUrl: null,
    mimeType: 'image/webp',
    extension: 'webp',
    fileSize: 2 * 1024 * 1024,
    width: 1600,
    height: 300,
    altText: 'Banner',
    tags: [],
    folderId: null,
    uploaderId: 'uploader-1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const html = render(
    <MediaSelector
      value="m1"
      selectedAsset={asset}
      onChange={() => {}}
      label="Horizontal image"
      requiredWidth={1600}
      requiredHeight={300}
      placement="HOMEPAGE_HERO"
      format="HORIZONTAL"
    />,
  )
  assert.ok(html.includes('banner.webp'), 'filename shown')
  assert.ok(html.includes('1600 × 300px'), 'dimensions shown')
  assert.ok(html.includes('2.00 MB'), 'file size shown')
  assert.ok(html.includes('WEBP'), 'file type shown')
  assert.ok(html.includes('✓ Compatible'), 'compatible state shown')
  assert.ok(html.includes('Select from Media Library'), 'asset picker path present')
  assert.ok(html.includes('Upload from Device'), 'device upload path present')
})

test('MediaSelector flags an incompatible asset', () => {
  const asset: MediaAsset = {
    id: 'm2',
    title: 'Tall banner',
    fileName: 'tall.png',
    originalName: 'tall.png',
    fileUrl: '/uploads/media/m2.webp',
    thumbnailUrl: null,
    mimeType: 'image/webp',
    extension: 'webp',
    fileSize: 512 * 1024,
    width: 800,
    height: 800,
    altText: 'Banner',
    tags: [],
    folderId: null,
    uploaderId: 'uploader-1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const html = render(
    <MediaSelector
      value="m2"
      selectedAsset={asset}
      onChange={() => {}}
      label="Horizontal image"
      requiredWidth={1600}
      requiredHeight={300}
      placement="HOMEPAGE_HERO"
      format="HORIZONTAL"
    />,
  )
  assert.ok(html.includes('✕ Not compatible'), 'incompatible state shown')
})
