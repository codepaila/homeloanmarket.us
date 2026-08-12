import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')

const script = `
const brokers = db.getSiblingDB(db.getName()).brokers;
const indexes = brokers.getIndexes();
const locationIndex = indexes.find((index) => index.key && index.key.location === '2dsphere');
const conflicting = indexes.find((index) => index.key && Object.keys(index.key).length === 1 && index.key.location === 1);
if (conflicting && !locationIndex) throw new Error('A conflicting non-geospatial location index exists: ' + conflicting.name);
if (!locationIndex) brokers.createIndex({ location: '2dsphere' }, { name: 'brokers_location_2dsphere' });
const verified = brokers.getIndexes().find((index) => index.key && index.key.location === '2dsphere');
if (!verified) throw new Error('Broker location 2dsphere index was not created or verified');
printjson({ database: db.getName(), index: verified.name, status: 'reconciled' });
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
