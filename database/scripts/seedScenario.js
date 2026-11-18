import crypto from 'node:crypto';

// Map each service transaction to a savepoint, keeping the entire reset atomic.
export function transactionPool(client) {
  let serial = 0;
  let pending = Promise.resolve();
  const execute = (sql, params) => {
    const result = pending.then(() => client.query(sql, params));
    pending = result.catch(() => {});
    return result;
  };
  const makeClient = () => {
    const stack = [];
    return { release() {}, async query(sql, params) {
      const command = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
      if (command === 'BEGIN') { const name = `scenario_${++serial}`; stack.push(name); return execute(`SAVE TRANSACTION ${name}`); }
      if (command === 'COMMIT') { if (!stack.pop()) throw new Error('Unbalanced service transaction'); return { rows: [], rowCount: 0 }; }
      if (command === 'ROLLBACK') { const name = stack.pop(); if (!name) throw new Error('Unbalanced service transaction'); return execute(`ROLLBACK TRANSACTION ${name}`); }
      return execute(sql, params);
    } };
  };
  const pool = { query: execute, connect: async () => makeClient(), ready: async () => pool };
  return pool;
}

// Hash ordered native rows in Node instead of relying on database-specific JSON aggregation.
export async function appFingerprint(client) {
  const tables = (await client.query(`SELECT t.name AS table_name,c.name AS column_name,ic.key_ordinal
    FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
    JOIN sys.indexes i ON i.object_id=t.object_id AND i.is_primary_key=1
    JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
    JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
    WHERE s.name=N'app' ORDER BY t.name,ic.key_ordinal`)).rows;
  const keys = new Map();
  for (const { table_name: table, column_name: column } of tables) {
    if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) throw new Error('Unexpected schema identifier');
    if (!keys.has(table)) keys.set(table, []);
    keys.get(table).push(`[${column}]`);
  }
  const fingerprints = [];
  for (const [table, columns] of keys) {
    const rows = (await client.query(`SELECT * FROM app.[${table}] ORDER BY ${columns.join(',')}`)).rows;
    fingerprints.push({ table_name: table, n: rows.length, fingerprint: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') });
  }
  return fingerprints;
}
