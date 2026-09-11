# PHASE 9.2 — ADMIN EMAIL NOTIFICATIONS FOR THE ACCOUNT LIFECYCLE

**Verdict: 🟢 PASS with fixes applied.** The audit found three real gaps in admin
email notifications and they are now fixed and tested. No behavior was invented
beyond the account-lifecycle events; only the missing/broken admin notifications
were corrected.

---

## 1. Audit findings (what was actually broken)

### F-9.2-1 (HIGH) — The "new broker" admin notification was dead code
`sendBrokerRegistrationEmails` attempted to send `adminNewBroker` only when
`user.brokerProfile[0]` existed at the moment it ran. On the self-service flow a
Broker profile does **not** exist at registration (a `User` + `BrokerRegistration`
are created; the `Broker` is created later by `finalizeBrokerRegistration`), and
`createBrokerAccount` (the profile-at-registration path) has **no production
callers** (test-only). Result: the admin was **never** notified of a new
self-registered broker.

**Fix:** moved the trigger to the broker-created moment. `sendAdminNewBrokerNotification(brokerId)`
fires (fire-and-forget) after `createBrokerForExistingUser` in the wizard
`POST /api/brokers` and after `finalizeBrokerRegistration` on the subscription
success page. The dead registration-time gate was removed from
`sendBrokerRegistrationEmails` (the user welcome + verification email is
untouched and its result still propagates faithfully).

### F-9.2-2 (HIGH) — No admin notification for account deletion existed at all
Broker/Company/User self-service deletion and admin-initiated Company/Broker
deletion performed the database deletion with **zero admin notification**.

**Fix:** added typed `adminAccountDeletion` template + `sendAdminAccountDeletionNotification`
action, dispatched **after** the successful deletion transaction (fire-and-forget,
never awaits, never rolls back), to **every** configured `ADMIN_EMAILS` recipient.
Identity fields (user email, name, company name) are captured **before** the
destructive transaction and passed in — the DB record no longer exists when the
notification sends.

### F-9.2-3 (MEDIUM) — No admin notification for company registration
Company registration (PENDING company shell via the company-intent flow) had no
admin notification and no `adminNewCompany` template.

**Fix:** added the template + `sendAdminNewCompanyNotification`, dispatched
(fire-and-forget) in `PUT /api/auth/company-intent` **only** when
`alreadyCompany === false` (a genuinely fresh registration; re-entering the
intent PUT converges on the existing company and must not spam admins).

---

## 2. ADMIN EMAIL CONFIG

| Item | Status | Detail |
|---|---|---|
| Env var | `ADMIN_EMAILS` (comma-separated) + legacy `ADMIN_EMAIL` fallback | canonical in `lib/platform-config.ts` |
| Canonical helper | `parseAdminEmails()` — trim, lowercase, filter `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, Set-dedupe, legacy fallback, `[]` when unset | exposed as `platformConfig.adminEmails: string[]` |
| Competing helpers | **None.** All three new notifications reuse `platformConfig.adminEmails` | verified by test `one canonical server-side helper exists` |
| Multi-recipient | `to: platformConfig.adminEmails` → **every** admin gets every notification in one send | verified by `MATRIX 2/7/11/14/16` |
| Empty config | missing/empty `ADMIN_EMAILS` → each notification logs a warning and returns `skipped:true`; lifecycle ops continue | verified by `MATRIX 17` |
| Client exposure | `process.env.ADMIN_EMAIL*` is read **only** in `lib/platform-config.ts` (server) | verified by repo-wide scan test |

No new env vars, no schema changes, no migrations.

---

## 3. ACCOUNT DELETION — admin notification matrix (all now wired)

| Flow | Route | User confirmation (unchanged) | Admin account-deletion notification (NEW) | Captured before delete |
|---|---|---|---|---|
| Broker self-service | `app/api/account/broker/route.ts` | ✅ `void sendAccountDeletionConfirmationEmail` (Broker) | ✅ `void sendAdminAccountDeletionNotification` `accountType:'Broker'`, `companyName`, `deletedBy:'USER'` | user email/name, broker companyName (via `broker.findFirst` select) |
| Broker registration-only self-service | same route (registration branch) | ✅ (`User`) | ✅ (`User`) | user email/name |
| Company self-service (OWNER) | `app/api/account/company/route.ts` | ✅ (`Company`) | ✅ `accountType:'Company'`, `companyName`, `deletedBy:'USER'` | user email/name **and** company name via pre-delete `company.findUnique` |
| User self-service | `app/api/account/user/route.ts` | ✅ (`User`) | ✅ `accountType:'User'`, `deletedBy:'USER'` | user email/name |
| Admin deletes company | `app/api/admin/companies/[id]/delete/route.ts` | ❌ (by design — admin is aware) | ✅ `accountType:'Company'`, `companyName`, `deletedBy:'ADMIN'` | company name + OWNER email/name via pre-delete `company.findUnique` |
| Admin deletes broker | `app/api/admin/brokers/[id]/delete/route.ts` | ❌ (by design) | ✅ `accountType:'Broker'`, `companyName`, `deletedBy:'ADMIN'` | broker companyName + user email/name via pre-delete `broker.findUnique` |

Ordering (enforced by tests): capture identity **before** the
`AccountDeletionService.delete…` call; dispatch the notification **after** it —
an email failure can never roll back the completed deletion (all dispatches are
`void …Notification(...)`, never `await`ed).

The admin deletion email carries only: account type, user email, user name,
company name, "deleted by" (Admin / User self-service), deleted-at timestamp.
**No** password, verification/reset token, Stripe key, session, or other secret
is ever included (verified by test).

---

## 4. REGISTRATION — admin notification matrix

| Flow | Event fired at | User-facing email (unchanged) | Admin notification |
|---|---|---|---|
| Broker self-registration | \(a) registration → `sendBrokerRegistrationEmails` (welcome/verify) remains; the dead in-function admin gate was removed | ✅ `brokerWelcome` / verification | (none here — deliberately) |
| Broker profile created | \(b) `finalizeBrokerRegistration` via wizard `POST /api/brokers` **or** subscription success page | — | ✅ **NEW:** `sendAdminNewBrokerNotification(broker.id)` → `adminNewBroker` (pre-existing template, added per-broker deterministic key `admin_new_broker_<brokerId>`), to all admins, at the broker-created moment |
| Company registration (Google/company-intent) | `establishCompanyForUser` creates the PENDING company shell | none exists today (confirmed — not invented) | ✅ **NEW:** `sendAdminNewCompanyNotification` → `adminNewCompany` template (informational, not "requires verification" — companies have no approval workflow), fire-and-forget, `admin_new_company_<companyId>` key, when `alreadyCompany === false` |

**Not** added (by design, per the "don't invent an approval workflow" and "don't
create emails for internal admin activity" constraints):
- no admin email when an admin verifies a broker (`sendBrokerVerifiedEmail` to
  the broker already exists; the verifying admin is aware),
- no owner-facing company "you registered" email (none exists today),
- no admin notification for admin-imported brokers (the performing admin is aware).

---

## 5. EMAIL ARCHITECTURE (unchanged / reused)

- One delivery boundary: `sendEmail` in `lib/email.ts` → Resend (no second
  provider, sender, shell, or framework added).
- Every new template renders through the single shared shell
  (`lib/email-shell.ts`) with the existing escape/safeUrl hygiene.
- Typed data contracts added in `lib/email-templates.ts`:
  `AdminAccountDeletionEmailData`, `AdminNewCompanyEmailData`.
- Idempotency follows the existing convention — deterministic in-memory keys in
  `sendEmail` (`emailSendLog` Map, 60 s `RATE_LIMIT_WINDOW`):
  - `admin_account_deleted_<email>_<accountType>` (mirrors the user-facing
    `account_deleted_<email>_<accountType>` key),
  - `admin_new_broker_<brokerId>`,
  - `admin_new_company_<companyId>`.
- **Documented limitation (no durability added, per constraints):** dedupe is
  in-memory and per-process/instance, exactly like the existing user-facing
  `account_deleted_*` key. A duplicate deletion request within 60 s is
  suppressed; a request re-sent later (rare — the account is already gone) could
  send again. No new DB table was added because the existing architecture sets
  that precedent and the task forbade migrations/backfills unless an audit
  proves one required.

---

## 6. TESTS

3 new test files — **35/35 pass** (plus full regression of the existing email &
deletion suites).

| File | Covers |
|---|---|
| `tests/phase-9.2-admin-email-lifecycle.test.ts` (23 tests) | template presence/secrets-hygiene; fire-and-forget + post-deletion ordering in all 6 deletion routes; dead-gate removal; broker-created wiring (wizard + success page); company fresh-registration gating; no invented owner email; canonical helper / multi-recipient / deterministic keys / empty-config guard / no client env exposure / real admin CTA URLs; **runtime mock tests**: MATRIX 2/7/11 (admin deletion to both admins), MATRIX 17 (empty config skips), MATRIX 12/14 (new-broker to both admins, addressed to the registered broker), MATRIX 16 (new-company to both admins), missing-broker fail-safe |
| `tests/phase-9.2-admin-email-dedupe.test.ts` (5 tests) | MATRIX 1/4/6/9 duplicate suppression + multi-recipient delivery patterns in the real sender (`to: string\|string[]`, `Array.isArray` normalization, `emailSendLog` + `RATE_LIMIT_WINDOW` dedupe, `skipped:true` semantics) — proven by static source audit (runtime would need a real Resend key) |
| `tests/phase-9.2-admin-email-config.test.ts` (7 tests) | MATRIX 14 (two admins), MATRIX 17 (empty), whitespace, trim/lowercase/dedupe/filter-invalid, legacy `ADMIN_EMAIL` fallback, invalid legacy |

**Test matrix 1–17 coverage:**
1–3 ✅ (routes send user confirmation; admin notification to both admins after
DB deletion — ordering asserted), 4–5 ✅ (same-minute duplicate suppressed,
still `success:true`), 6–9 ✅ (company equivalents), 10–11 ✅ (user-only flow),
12–14 ✅ (both broker + admin emails; admin email addressed to the registered
broker, delivered to both admins), 15 ✅ (no company owner email exists today —
confirmed, not invented), 16 ✅ (admin new-company to both admins), 17 ✅ (empty
ADMIN_EMAILS → no admin emails, user emails still send).

Verification commands:
- `node --test --experimental-test-module-mocks --import tsx tests/phase-9.2-admin-email-lifecycle.test.ts tests/phase-9.2-admin-email-dedupe.test.ts tests/phase-9.2-admin-email-config.test.ts`
- `node --test --import tsx tests/phase-8.36.5-email-system.test.ts tests/account-deletion-email.test.ts tests/account-deletion-unit.test.ts tests/account-deletion-contract.test.ts` (regression)
- `node --test --experimental-test-module-mocks --import tsx tests/email-sender-domain-and-propagation.test.ts` (regression)

---

## 7. CHANGES

| File | Change |
|---|---|
| `lib/email-templates.ts` | +`AdminAccountDeletionEmailData`, +`AdminNewCompanyEmailData` types; +`adminAccountDeletion` template (destructive tone, no secrets); +`adminNewCompany` template (informational) |
| `actions/email.action.ts` | removed the dead registration-time `adminNewBroker` gate from `sendBrokerRegistrationEmails` (return still propagates the broker verification result); +`sendAdminNewBrokerNotification(brokerId)`; +`sendAdminNewCompanyNotification(companyId)`; +`sendAdminAccountDeletionNotification({email,name,accountType,companyName,deletedBy})` — all to `platformConfig.adminEmails`, deterministic idempotency keys, empty-config skip |
| `app/api/account/broker/route.ts` | capture `companyName` pre-delete; + admin deletion notification (Broker + registration-only branch) |
| `app/api/account/company/route.ts` | capture company name pre-delete; + admin deletion notification |
| `app/api/account/user/route.ts` | + admin deletion notification |
| `app/api/admin/companies/[id]/delete/route.ts` | + pre-delete company/owner capture (imported `prisma`); + admin deletion notification (`deletedBy:'ADMIN'`) |
| `app/api/admin/brokers/[id]/delete/route.ts` | + pre-delete broker/user capture (imported `prisma`); + admin deletion notification (`deletedBy:'ADMIN'`) |
| `app/api/brokers/route.ts` | + `void sendAdminNewBrokerNotification(broker.id)` after `createBrokerForExistingUser` |
| `app/broker-registration/subscription/success/page.tsx` | capture finalize result; + `void sendAdminNewBrokerNotification(broker.id)` |
| `app/api/auth/company-intent/route.ts` | + `if (!result.alreadyCompany) void sendAdminNewCompanyNotification(result.companyId)` |
| `tests/phase-9.2-admin-email-lifecycle.test.ts` | **new** — 23 tests |
| `tests/phase-9.2-admin-email-dedupe.test.ts` | **new** — 5 tests |
| `tests/phase-9.2-admin-email-config.test.ts` | **new** — 7 tests |

No dependencies, no lock files, no Stripe/billing behavior changes, no schema or
migration changes, no user-facing email copy changed.