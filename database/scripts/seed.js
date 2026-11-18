export async function seedDatabase(_customPool = null, { apply = false } = {}) {
  if (!apply) throw new Error('Demo seed requires --apply / {apply:true}; only an empty SQL Server app schema is allowed.');
  // The former six-role approval seed is incompatible with the fresh V2 baseline.
  throw new Error('V2 seed is not available through this legacy entry point. Legacy seed/import is disabled; no connection or data changes were made.');
}
