# PHASE 13.10 — BLOG SLUG AUTO-GENERATION + ADMIN FORM CLEANUP

**Verdict: 🟢 PASS with fixes applied.** The admin UI no longer accepts a slug;
the server derives the slug from the title, resolves uniqueness, and treats the
DB unique constraint as the final protection. Edits never change a public URL.
23 new focused tests pass; the full blog/content regression is green.

---

## BLOG SLUG AUDIT

- **Current slug source (BEFORE):** client-submitted `slug` FormData field, used
  when present (`slugify(requestedSlug || title)` in the create action) —
  a client could inject an arbitrary slug.
- **Current slug generation location (BEFORE):** inline `slugify()` inside
  `actions/content.ts` (a `'use server'` module). Server-side, but fed by a
  client-controlled value.
- **Current DB uniqueness:** `BlogPost.slug` is `String @unique` in
  `prisma/schema.prisma` (line 1296). The create flow used a
  check-then-create `while (findUnique)` loop as its *only* protection — no
  P2002 conflict handling, so a concurrent insert could throw.
- **Existing slug utility:** the inline `slugify` above. Canonicalized into
  `slugifyBlogTitle()` in `lib/blog-content.ts` (the shared blog helper module)
  — NOT duplicated. Advertisement/broker slugifiers
  (`lib/advertisements/utils.ts`, `slugifyAdminBroker`, `slugifyBrokerName`)
  are entity-specific and untouched.
- **Create flow (BEFORE):** read title → read `slug` field → `slugify(slug || title)` →
  pre-check loop → `create`. Honors client slugs; race-prone; no empty-slug guard.
- **Update flow (BEFORE):** read title → read `slug` field → `slugify(slug || title)` →
  re-derives the slug and **changes it on title edits** (only avoided because the
  form pre-filled the slug field, which it no longer will).
- **Public route dependency:** `/blog/[slug]` resolves `findUnique({ where: { slug } })`;
  listing/recent-article links, sitemap, canonical, Open Graph, and breadcrumb
  JSON-LD all build on `post.slug`. Slug changes would break all of these.
- **Existing invalid/duplicate slug records (live DB, read-only):** 6 posts —
  **0 missing/empty, 0 duplicates, 0 malformed** (all `^[a-z0-9]+(-[a-z0-9]+)*$`).
  5/6 match a straight title-slugify; 1 (`what-first-time-buyers-should-know`)
  is a valid intentional seed slug (dropped "Home") — left unchanged. No
  records require remediation.

---

## IMPLEMENTATION

- **Slug field removed from admin UI:** PASS — `BlogForm.tsx` no longer renders a
  Slug input and `BlogInitialValues.slug` was removed (pages updated). Verified
  repo-wide: the only remaining `name="slug"` input is the Advertisement form
  (separate entity, out of scope). The admin ContentTable shows a read-only
  `/{slug}` URL hint (not an input) — retained as a UX aid.
- **Server-side generation:** PASS — `createBlog` calls
  `slugifyBlogTitle(title)` server-side; no client JavaScript involved.
  `lib/blog-content.ts` is the single canonical slugifier (`BLOG_SLUG_MAX_LENGTH`
  = 80, truncation at a hyphen boundary).
- **Client slug ignored:** PASS — `formData.get('slug')` is never read; the
  `requestedSlug` branch is deleted. Injected `slug=malicious-value` is dropped
  on both create and edit (runtime-tested).
- **Duplicate handling:** PASS — deterministic `-2`, `-3`, … suffixes (per the
  task spec); a P2002 race on insert falls back to suffix resolution and retries
  (bounded loop). The `@unique` column remains the final protection.
- **Existing slug preserved on edit:** PASS — `updateBlog` keeps `existing.slug`
  verbatim regardless of title changes; only a legacy *empty* slug is repaired
  from the title exactly once (data-quality exception, documented).
- **DB uniqueness protected:** PASS — `@unique` schema (unchanged) + P2002
  recognition + retry.

---

## FILES CHANGED

| File | Change |
|---|---|
| `lib/blog-content.ts` | + `BLOG_SLUG_MAX_LENGTH = 80`; + `slugifyBlogTitle()` — the canonical blog slugifier (punctuation → separators, collapse, trim, bounded) |
| `actions/content.ts` | removed inline `slugify`; + `resolveUniqueSlug` (suffixes `-2/-3/…`), `isUniqueConstraintError`, `createBlogPostWithUniqueSlug` (attempt natural slug, P2002 → resolve → retry); `createBlog` ignores any client slug, rejects titles that can't produce a slug; `updateBlog` preserves the existing slug (revalidates old + new slug paths only when repaired) |
| `components/admin/content/BlogForm.tsx` | removed `BlogInitialValues.slug` and the `<TextField label="Slug" name="slug" … />` input |
| `app/admin/content/new/page.tsx` | removed `slug: ''` from the initial values |
| `app/admin/content/[id]/edit/page.tsx` | removed `slug: post.slug` from the initial values |
| `tests/phase-13.10-blog-slug-auto-generation.test.ts` | **new** — 23 tests (see TESTS) |

## FILES INTENTIONALLY UNCHANGED

- `prisma/schema.prisma` — `slug String @unique` already present; no migration.
- `app/(public)/blog/[slug]/page.tsx`, `app/(public)/blog/page.tsx`,
  `components/sections/landing/LatestArticles.tsx`, `app/sitemap.ts` — public
  URLs/canonical/OG all already keyed on the stored `BlogPost.slug`; no change
  needed. **No public route modified.**
- `components/admin/content/ContentTable.tsx` — read-only `/{slug}` URL hint,
  not an input; kept.
- `components/admin/ads/AdvertisementForm.tsx`,
  `lib/advertisements/utils.ts`, `lib/admin-broker.ts`,
  `lib/broker-registration.ts` — advertisement/broker slug flows are separate
  features; the blog uses its own canonical slugifier.
- `prisma/seed/index.ts` — existing seed slugs are valid; left alone.

---

## TESTS

`node --test --experimental-test-module-mocks --import tsx tests/phase-13.10-blog-slug-auto-generation.test.ts`

- **Added:** 23 tests — MATRIX 1 (title→slug), 2 (punctuation normalized), 3
  (spaces/repeated separators), 4 (duplicate → `-2`), 5 (multiple duplicates →
  `-3`), 6 (empty/invalid title rejected, nothing written), 7/11 (client slug
  ignored on create AND edit), 8 (title edit preserves slug), 9 (content edit
  preserves slug), 10 (empty legacy slug repaired once; non-empty legacy slug
  preserved verbatim), 12 (slugified title stored in DB + revalidation), P2002
  race → resolved suffix, 13 (`/blog/[slug]` resolves by stored slug), 14
  (listing/recent/sitemap links use stored slug), plus DB `@unique`/server-
  authority/admin-form audits.
- **Passed:** 23/23. Runtime create/update exercised against mocked
  prisma/currentUser + real `next/cache`/`next/navigation` interception.
- **Failed:** none.
- **Unrelated baseline:** `blog-content-sanitizer` 26/26; `phase-13.7-content-
  settings-seo`, `phase-13.8-clean-seed`, `phase-13.9-images` — 0 failures (6
  DB-dependent cases skipped as before). `eslint` clean; `tsc --noEmit` clean
  for all changed files.

---

## MIGRATION

**Required: NO.** `BlogPost.slug` is already `String @unique`; the live DB
audit found zero missing/duplicate/malformed slugs (6/6 valid), so no backfill
is needed or approved. The only repair path is the built-in, explicit one: a
legacy post whose slug is entirely *empty* gets a fresh unique slug derived from
its title during the admin's next edit — a reported data-quality exception, not
a bulk rewrite.