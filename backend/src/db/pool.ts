import pg from "pg";

export const pool = new pg.Pool({
  connectionString: "postgres://postgres:postgres@localhost:5442/medici",
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

export async function withConnection<T>(callback: (conn: any) => Promise<T>): Promise<T> {
  const conn = await pool.connect();
  try {
    return await callback(conn);
  } finally {
    conn.release();
  }
}