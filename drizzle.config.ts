import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl!,
    ssl:
      process.env.NODE_ENV === "production" || databaseUrl?.includes("render")
        ? { rejectUnauthorized: false }
        : undefined,
  },
});