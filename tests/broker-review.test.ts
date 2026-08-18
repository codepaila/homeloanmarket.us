import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const detail = read('components/sections/broker/BrokerDetailClient.tsx')
const dialog = read('components/sections/broker/BrokerReviewDialog.tsx')
const reviewsRoute = read('app/api/company/[slug]/reviews/route.ts')
const schema = read('prisma/schema.prisma')

const reviewBlock = schema.slice(schema.indexOf('model Review'), schema.indexOf('model Notification'))

test('a canonical Review model already exists and is reused', () => {
  assert.match(reviewBlock, /model Review \{/)
  assert.match(reviewBlock, /brokerId\s+String/)
  assert.match(reviewBlock, /userId\s+String\?/)
  assert.match(reviewBlock, /rating\s+Int/)
  assert.match(reviewBlock, /comment\s+String\?/)
  assert.match(reviewBlock, /isPublished\s+Boolean/)
})

test('review API: POST derives user from the session (never client-supplied)', () => {
  assert.match(reviewsRoute, /export async function POST/)
  assert.match(reviewsRoute, /getCurrentUser\(\)/)
  assert.match(reviewsRoute, /Authentication required/)
  assert.doesNotMatch(reviewsRoute, /body\.userId/, 'must not trust a client userId')
  assert.doesNotMatch(reviewsRoute, /body\.brokerId/, 'must not trust a client brokerId')
})

test('review API validates broker, rating 1-5, and content', () => {
  assert.match(reviewsRoute, /loadBroker\(slug\)/)
  assert.match(reviewsRoute, /Broker not found/)
  assert.match(reviewsRoute, /rating < 1 \|\| rating > 5/)
  assert.match(reviewsRoute, /Rating must be between 1 and 5 stars/)
})

test('review API enforces one active review per user per broker', () => {
  assert.match(reviewsRoute, /prisma\.review\.findFirst\(/)
  assert.match(reviewsRoute, /brokerId: broker\.id, userId: user\.id/)
  assert.match(reviewsRoute, /already reviewed this broker/)
  assert.match(reviewsRoute, /status: 409/)
})

test('review API recomputes avgRating + totalReviews from published reviews only', () => {
  assert.match(reviewsRoute, /_avg: \{ rating: true \}/)
  assert.match(reviewsRoute, /isPublished: true/)
  assert.match(reviewsRoute, /avgRating, totalReviews \}/)
})

test('review API never leaks internal errors on submission', () => {
  const postHandler = reviewsRoute.slice(reviewsRoute.indexOf('export async function POST'))
  assert.match(postHandler, /Unable to submit your review\. Please try again\./)
  assert.doesNotMatch(postHandler, /error\.message/, 'POST must not echo Prisma/DB error details')
})

test('broker detail shows a Write a Review button', () => {
  assert.match(detail, /Write a Review/)
  assert.match(detail, /handleWriteReview/)
})

test('Write a Review opens the dialog when authenticated and signs in otherwise', () => {
  assert.match(detail, /sessionStatus === 'authenticated'/)
  assert.match(detail, /setReviewDialogOpen\(true\)/)
  assert.match(detail, /signIn\(\)/)
  assert.match(detail, /BrokerReviewDialog/)
})

test('review dialog has accessible star input, textarea, and submit', () => {
  assert.match(dialog, /role="radiogroup"/)
  assert.match(dialog, /aria-label=\{STAR_LABELS\[value - 1\]\}/)
  assert.match(dialog, /1 star', '2 stars', '3 stars', '4 stars', '5 stars/)
  assert.match(dialog, /aria-checked=\{selected\}/)
  assert.match(dialog, /id="review-comment"/)
  assert.match(dialog, /Submit Review/)
  assert.match(dialog, /role="alert"/)
})

test('review dialog guards duplicate submission with loading + disabled button', () => {
  assert.match(dialog, /if \(submitting\) return/)
  assert.match(dialog, /setSubmitting\(true\)/)
  assert.match(dialog, /disabled=\{submitting\}/)
  assert.match(dialog, /Submitting…/)
})

test('review dialog success/error toasts are single and safe', () => {
  assert.match(dialog, /Review submitted successfully\./)
  assert.match(dialog, /Unable to submit your review/)
})
