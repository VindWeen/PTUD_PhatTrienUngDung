import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function seedDatabase(_customPool = null, { apply = false } = {}) {
  if (!apply) throw new Error('Demo seed requires --apply / {apply:true}; only an empty SQL Server app schema is allowed.');
  // The former six-role approval seed is incompatible with the fresh V2 baseline.
  throw new Error('V2 seed is not available through this legacy entry point. Use scripts/seed-v2-demo.mjs --database=EXPLICIT_DB --apply. Legacy seed/import is disabled; no connection or data changes were made.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--apply')) {
    console.log('Use scripts/seed-v2-demo.mjs --database=EXPLICIT_DB for the V2 dry-run plan. Legacy seed/import is disabled.');
  } else seedDatabase(null, { apply: true }).catch(error => { console.error(`Seed refused/failed: ${error.message}`); process.exitCode = 1; });
}
