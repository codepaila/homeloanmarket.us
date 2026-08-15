import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error('DATABASE_URL is required')

const script = `
const targetDb = db.getSiblingDB(db.getName());
if (!targetDb.getCollectionNames().includes('brokers')) targetDb.createCollection('brokers');
const brokers = targetDb.brokers;
const GEO_INDEX = 'brokers_location_2dsphere';
const isGeoIndex = (index) => index.key && index.key.location === '2dsphere';
const isConflictIndex = (index) => index.key && Object.keys(index.key).length === 1 && index.key.location === 1;
let indexes = brokers.getIndexes();
let existing = indexes.find(isGeoIndex);
const conflicts = indexes.filter((index) => isConflictIndex(index) && index.name !== GEO_INDEX);
const changedIndexes = [];
if (!existing) {
  brokers.createIndex({ location: '2dsphere' }, { name: GEO_INDEX });
  changedIndexes.push(GEO_INDEX + ' (created)');
}
indexes = brokers.getIndexes();
existing = indexes.find(isGeoIndex);
if (!existing) throw new Error('Broker location 2dsphere index was not created or verified');
for (const conflict of conflicts) {
  brokers.dropIndex(conflict.name);
  changedIndexes.push(conflict.name + ' (removed conflicting non-geospatial index)');
}
indexes = brokers.getIndexes();
const remainingConflicts = indexes.filter((index) => isConflictIndex(index) && index.name !== GEO_INDEX);
if (remainingConflicts.length > 0) throw new Error('Conflicting non-geospatial location index remains: ' + remainingConflicts.map((i) => i.name).join(', '));
printjson({ database: db.getName(), index: GEO_INDEX, changed: changedIndexes.length > 0, changedIndexes, status: changedIndexes.length > 0 ? 'reconciled' : 'healthy' });
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
