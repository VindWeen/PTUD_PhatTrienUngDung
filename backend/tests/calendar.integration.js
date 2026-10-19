// Real HTTP/PostgreSQL checks; test writes are isolated in a rolled-back transaction.
import assert from 'node:assert/strict';
import { Pool, getDbPoolConfig, setPool } from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/crypto.js';
import app from '../src/app.js';

const pool = new Pool({ ...getDbPoolConfig(), max: 1 });
let client, server;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL statement_timeout='10s'");
  const users = (await client.query("SELECT user_id FROM app.users WHERE status='ACTIVE' ORDER BY user_id LIMIT 2")).rows;
  assert.equal(users.length, 2, 'Need two active demo accounts');
  setPool({ query: (...args) => client.query(...args) });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/me/calendar`;
  const call = async (user, method = 'GET', suffix = '', body) => {
    const response = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${generateAccessToken({ userId: Number(user.user_id) })}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, ...await response.json() };
  };
  assert.equal((await call(null)).status, 401);
  const draft = { title: 'Calendar integration check', category: 'task', startsAt: '2026-10-31T23:30', endsAt: '2026-11-01T00:30', allDay: false, location: 'Phòng thử nghiệm', description: 'Rollback after verification' };
  const created = await call(users[0], 'POST', '', draft);
  assert.equal(created.status, 201);
  const event = created.data;
  assert.equal(event.startsAt, draft.startsAt, 'Local wall time survives PostgreSQL round trip');
  assert.equal(event.endsAt, draft.endsAt);
  assert.ok((await call(users[0])).data.some(e => e.id === event.id));
  assert.ok(!(await call(users[1])).data.some(e => e.id === event.id), 'Other account cannot read event');
  const payload = { ...draft, version: event.version, completed: true };
  assert.equal((await call(users[1], 'PUT', `/${event.id}`, payload)).status, 404);
  assert.equal((await call(users[1], 'DELETE', `/${event.id}`, { version: 1 })).status, 404);
  const updated = await call(users[0], 'PUT', `/${event.id}`, payload);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.completed, true);
  assert.equal((await call(users[0], 'PUT', `/${event.id}`, payload)).status, 409);
  assert.equal((await call(users[0], 'DELETE', `/${event.id}`, { version: 1 })).status, 409);
  assert.equal((await call(users[0], 'POST', '', { ...draft, category: 'system' })).status, 400);
  assert.equal((await call(users[0], 'POST', '', { ...draft, userId: Number(users[1].user_id) })).status, 400);
  assert.equal((await call(users[0], 'DELETE', `/${event.id}`, { version: updated.data.version })).status, 200);
  assert.ok(!(await call(users[0])).data.some(e => e.id === event.id));
  console.log('PASS calendar HTTP/DB: CRUD, ownership, validation, timezone and stale versions.');
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  setPool(null);
  if (client) { await client.query('ROLLBACK'); client.release(); }
  await pool.end();
}
