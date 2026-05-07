import postgres from 'postgres';
import 'dotenv/config.js';

let sql = null;
let pgReady = false;

/**
 * Initialize PostgreSQL connection using postgres-js
 */
export const connectPostgres = async () => {
  if (sql) return sql;

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('⚠️  PostgreSQL connection failed: No connection string found (POSTGRES_URL or DATABASE_URL)');
    return null;
  }

  try {
    // postgres-js configuration
    // connect_timeout: time to wait for connection in seconds
    sql = postgres(connectionString, {
      ssl: 'verify-full',
      connect_timeout: 15, // 15 seconds to handle Neon cold starts
      onnotice: () => {},  // suppress notices
    });

    // Test the connection by running a simple query
    await sql`SELECT 1`;
    
    console.log('✅ PostgreSQL (postgres-js) connected');
    pgReady = true;

  } catch (err) {
    console.error('⚠️  PostgreSQL connection failed:', err.message);
    sql = null;
    pgReady = false;
    // Do not exit process
  }

  return sql;
};

export const getSql = () => sql;
export const isPgReady = () => pgReady;
