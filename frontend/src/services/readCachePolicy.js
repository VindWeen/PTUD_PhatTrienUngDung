// Only JSON reads used by pages. Downloads and live staleness checks stay uncached.
export function readCacheKey(config) {
  if ((config.method || 'GET').toUpperCase() !== 'GET') return null;
  const url = config.url || '';
  const allowed = /^(\/dashboard\/summary|\/me\/profile|\/organizations|\/units\/\d+\/profile|\/regulations(?:\/.*)?|\/achievements(?:\/catalogs|\/\d+(?:\/history|\/submissions)?)?|\/kpi\/(?:goals|catalogs|recommendations|external)|\/award-cycles|\/award-applications(?:\/\d+)?|\/award-records(?:\/\d+)?|\/reports|\/notifications|\/ai\/evaluations(?:\/\d+)?)$/.test(url);
  if (!allowed || config.responseType === 'blob') return null;
  const params = Object.entries(config.params || {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)])
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([url, params]);
}
