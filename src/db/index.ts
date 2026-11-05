import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseConnectionOptions } from "../config/database.js";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const connection = getDatabaseConnectionOptions(
  env.databaseUrl,
  env.nodeEnv === "production" || env.databaseUrl.includes("render"),
);

const pool = new Pool({
  connectionString: connection.connectionString,
  ssl: connection.ssl,
});

export const db = drizzle(pool, { schema });
export { pool };
