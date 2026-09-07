import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { USLocationPicker, formatSelectedLocation, type SelectedUSLocation } from '../components/location/USLocationPicker'

// Phase 8.24.4 runtime smoke: the render-body setState bug previously made the
// component throw an infinite-render error as soon as it rendered with a
// `value` that did not match its local tracker (e.g. value === undefined on a
// fresh setup). SSR rendering executes the render body, so it reproduces the
// failure deterministically.

test('SMOKE: renders with value === undefined without throwing (fresh setup)', () => {
  const html = renderToStaticMarkup(
    React.createElement(USLocationPicker, { value: undefined, onChange: () => {} }),
  )
  assert.match(html, /Office Location \*/)
  assert.match(html, /Search your business or office address/)
  assert.doesNotMatch(html, /Clear location/)
  assert.match(html, /Select a Google-resolved US place to save canonical coordinates\./)
})

test('SMOKE: renders with a valid selected location without throwing', () => {
  const loc: SelectedUSLocation = {
    placeId: 'ChIJxxxx',
    normalizedAddress: '123 Main St, Daytona Beach, FL 32114',
    city: 'Daytona Beach',
    state: 'FL',
    zip: '32114',
    latitude: 29.2108,
    longitude: -81.0228,
  }
  const html = renderToStaticMarkup(
    React.createElement(USLocationPicker, { value: loc, onChange: () => {} }),
  )
  assert.match(html, /123 Main St, Daytona Beach, FL 32114/)
  assert.match(html, /Clear location/)
})

test('SMOKE: re-render with the same location does not loop (stable across identical value objects)', () => {
  const loc: SelectedUSLocation = {
    placeId: 'p1',
    normalizedAddress: 'Dallas, TX',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    latitude: 32.7767,
    longitude: -96.797,
  }
  const first = renderToStaticMarkup(React.createElement(USLocationPicker, { value: loc, onChange: () => {} }))
  const second = renderToStaticMarkup(React.createElement(USLocationPicker, { value: loc, onChange: () => {} }))
  assert.equal(first, second)
  assert.doesNotMatch(first, /·/)
})

test('SMOKE: formatSelectedLocation never duplicates city/state', () => {
  const loc: SelectedUSLocation = {
    placeId: 'p',
    normalizedAddress: 'Dallas, TX',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    latitude: 32.7,
    longitude: -96.8,
  }
  assert.equal(formatSelectedLocation(loc), 'Dallas, TX 75201')
  assert.equal(formatSelectedLocation(loc).includes(':'), false)
})