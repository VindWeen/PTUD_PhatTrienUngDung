// Only JSON reads used by pages. Downloads and live staleness checks stay uncached.
export function readCacheKey(config) {
  if ((config.method || 'GET').toUpperCase() !== 'GET') return null;
  const url = config.url || '';
  const allowed = /^(\/me\/profile|\/organizations|\/regulations(?:\/.*)?|\/achievements(?:\/catalogs|\/\d+(?:\/evidences)?)?|\/kpi\/goals|\/reports|\/notifications)$/.test(url);
  if (!allowed || config.responseType === 'blob') return null;
  const params = Object.entries(config.params || {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)])
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([url, params]);
}
