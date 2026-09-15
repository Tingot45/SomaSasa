import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "./schema.ts";
import { MemoryDB } from "./memory.ts";

declare global {
  var _postgresPool: InstanceType<typeof Pool> | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on("error", (err: Error) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};

const useMemoryDb =
  !process.env.SQL_HOST || !process.env.SQL_DB_NAME || !process.env.SQL_USER || !process.env.SQL_PASSWORD;

export const db: any = useMemoryDb ? new MemoryDB() : drizzle(createPool(), { schema });
