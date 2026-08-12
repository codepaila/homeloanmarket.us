import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const script = `
const users = db.getSiblingDB(db.getName()).users;
const duplicates = users.aggregate([
  { $match: { phone: { $type: 'string', $ne: '' } } },
  { $group: { _id: '$phone', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();
if (duplicates.length > 0) throw new Error('Cannot reconcile phone index: duplicate non-null phones found: ' + duplicates.length);
const replacementName = 'users_phone_non_null_unique';
const isPhoneIndex = (index) => index.key && Object.keys(index.key).length === 1 && index.key.phone === 1;
const isReplacement = (index) => isPhoneIndex(index) && index.name === replacementName && index.unique === true && index.partialFilterExpression && index.partialFilterExpression.phone && index.partialFilterExpression.phone.$type === 'string';
let indexes = users.getIndexes();
let replacement = indexes.find(isReplacement);
const oldIndex = indexes.find((index) => isPhoneIndex(index) && index.unique === true && !index.partialFilterExpression);
if (!replacement) users.createIndex({ phone: 1 }, { name: replacementName, unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
indexes = users.getIndexes();
replacement = indexes.find(isReplacement);
if (!replacement) throw new Error('User phone replacement index was not created or verified');
if (oldIndex && oldIndex.name !== replacementName) users.dropIndex(oldIndex.name);
printjson({ database: db.getName(), replacementIndex: replacementName, oldIndex: oldIndex ? oldIndex.name : null, duplicatePhoneGroups: 0, status: 'reconciled' });
`

async function main() {
  const result = await execFileAsync('mongosh', ['--quiet', databaseUrl, '--eval', script])
  process.stdout.write(result.stdout)
}

main().catch((error) => {
  const message = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
