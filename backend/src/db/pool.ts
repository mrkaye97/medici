import pg from "pg";

export const pool = new pg.Pool({
  connectionString: "postgres://postgres:postgres@localhost:5442/medici",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function withConnection<T>(
  callback: (conn: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const conn = await pool.connect();
  try {
    return await callback(conn);
  } finally {
    conn.release();
  }
}
