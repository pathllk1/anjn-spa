import { connectPostgres, getSql } from './config/pg.config.js';
import fs from 'fs';
import path from 'path';

async function setupSchema() {
  await connectPostgres();
  const sql = getSql();

  if (!sql) {
    console.error('Failed to connect to PostgreSQL');
    process.exit(1);
  }

  try {
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'server/postgres/setup.sql'), 'utf8');
    await sql.unsafe(schemaSql);
    console.log('✅ PostgreSQL schema created successfully');
  } catch (err) {
    console.error('❌ Error creating schema:', err.message);
  } finally {
    process.exit(0);
  }
}

setupSchema();
