import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getDatabaseConnectionOptions } from "./src/config/database.ts";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run database migrations.");
}

const connection = getDatabaseConnectionOptions(
  databaseUrl,
  process.env.NODE_ENV === "production" || databaseUrl.includes("render"),
);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connection.connectionString,
    ssl: connection.ssl,
  },
});
