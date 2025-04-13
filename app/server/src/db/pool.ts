import pg from "pg";

export const pool = new pg.Pool({
  connectionString: "postgres://postgres:postgres@localhost:5442/medici",
});
