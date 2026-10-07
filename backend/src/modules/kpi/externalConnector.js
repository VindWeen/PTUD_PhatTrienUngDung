import { sourceEnvelope } from './externalContract.js';
// URL/token are server-only. No user-controlled URL, redirects, or credential logs.
export async function pullSource({ url = process.env.KPI_SOURCE_URL, token = process.env.KPI_SOURCE_TOKEN,
 timeoutMs = 3000, retries = 2, onAttempt = () => {} } = {}) {
 if (!url || !token) throw new Error('SOURCE_NOT_CONFIGURED');
 const endpoint = new URL(url);
 if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
     !(endpoint.protocol === 'https:' || (endpoint.protocol === 'http:' && ['127.0.0.1','localhost'].includes(endpoint.hostname))))
   throw new Error('SOURCE_URL_INVALID');
 for (let attempt = 1; attempt <= retries + 1; attempt++) {
   await onAttempt(attempt);
   try {
     const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` },
       redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
     if (!response.ok) {
       const error = new Error(`SOURCE_HTTP_${response.status}`);
       error.permanent = response.status < 500 && response.status !== 429;
       throw error;
     }
     // Bound streaming input, including servers without Content-Length.
     const chunks = []; let bytes = 0;
     for await (const chunk of response.body) {
       bytes += chunk.length;
       if (bytes > 1000000) { const e = new Error('SOURCE_TOO_LARGE'); e.permanent = true; throw e; }
       chunks.push(Buffer.from(chunk));
     }
     const body = Buffer.concat(chunks).toString('utf8');
     let json;
     try { json = JSON.parse(body); } catch { const e = new Error('SOURCE_CONTRACT_INVALID'); e.permanent = true; throw e; }
     const parsed = sourceEnvelope.safeParse(json);
     if (!parsed.success) { const e = new Error('SOURCE_CONTRACT_INVALID'); e.permanent = true; throw e; }
     return parsed.data;
   } catch (error) {
     if (error.permanent || attempt > retries) throw new Error(/^SOURCE_/.test(error.message) ? error.message : 'SOURCE_UNAVAILABLE');
     await new Promise(resolve => setTimeout(resolve, 100 * 2 ** (attempt - 1)));
   }
 }
}
