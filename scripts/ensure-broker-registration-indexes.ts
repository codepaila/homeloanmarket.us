import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')

const script = `
const ensureUnique = (collectionName, key, name) => {
  const collection = db.getSiblingDB(db.getName())[collectionName];
  const indexes = collection.getIndexes();
  const sameKey = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(key));
  if (sameKey && sameKey.unique === true) return;
  if (sameKey) throw new Error(collectionName + ' has a non-unique conflicting index for ' + JSON.stringify(key));
  collection.createIndex(key, { name, unique: true });
};

ensureUnique('broker_registrations', { userId: 1 }, 'broker_registrations_userId_unique');
ensureUnique('broker_registration_subscriptions', { registrationId: 1 }, 'broker_registration_subscriptions_registrationId_unique');
ensureUnique('broker_onboarding_drafts', { registrationId: 1 }, 'broker_onboarding_drafts_registrationId_unique');

printjson({
  database: db.getName(),
  indexes: {
    brokerRegistrations: db.getSiblingDB(db.getName()).broker_registrations.getIndexes(),
    registrationSubscriptions: db.getSiblingDB(db.getName()).broker_registration_subscriptions.getIndexes(),
    onboardingDrafts: db.getSiblingDB(db.getName()).broker_onboarding_drafts.getIndexes()
  },
  status: 'reconciled'
});
`

async function main() {
  const result = await execFileAsync('mongosh', ['--quiet', databaseUrl, '--eval', script])
  process.stdout.write(result.stdout)
}

main().catch((error) => {
  const message = error && typeof error === 'object' && 'stderr' in error
    ? String(error.stderr)
    : error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
