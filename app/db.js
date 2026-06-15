const globalForDb = globalThis;

async function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalForDb.yosDbPool) {
    const pg = await import("pg");
    const { Pool } = pg.default || pg;

    globalForDb.yosDbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
  }

  return globalForDb.yosDbPool;
}

export async function query(text, params = []) {
  const pool = await getPool();

  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return pool.query(text, params);
}

export async function transaction(callback) {
  const pool = await getPool();

  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");

    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL);
}
