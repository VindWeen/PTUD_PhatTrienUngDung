// Short-lived, memory-only reads. Never persist personal data across sessions.
const entries = new Map();
let revision = 0;

export function clearReadCache() { revision += 1; entries.clear(); }
export function invalidateReadCache(key) { entries.delete(key); }

export async function cachedRead(key, read, maxAge = 30000) {
  const existing = entries.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.promise;
  for (const [entryKey, entry] of entries) {
    if (entry.expiresAt <= Date.now()) entries.delete(entryKey);
  }
  if (entries.size >= 150) entries.delete(entries.keys().next().value);
  const startedAtRevision = revision;
  const entry = { expiresAt: Infinity, promise: null };
  entry.promise = Promise.resolve().then(read).then((value) => {
    if (revision === startedAtRevision && entries.get(key) === entry) entry.expiresAt = Date.now() + maxAge;
    return value;
  }).catch((error) => {
    if (entries.get(key) === entry) entries.delete(key);
    throw error;
  });
  entries.set(key, entry);
  return entry.promise;
}
