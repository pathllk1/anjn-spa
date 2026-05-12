import { getSql } from '../config/pg.config.js';

/**
 * Ensure super_admin role
 */
function ensureSuperAdmin(req, res) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ success: false, error: 'Super admin access required' });
    return false;
  }
  return true;
}

/**
 * GET /api/pg/database/tables
 * Get list of all PostgreSQL tables in public schema
 */
export const getTables = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const sql = getSql();
    if (!sql) return res.status(503).json({ success: false, error: 'PostgreSQL connection not ready' });

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `;

    res.json({ success: true, tables: tables.map(t => t.table_name) });
  } catch (err) {
    console.error('[PG-DATABASE] getTables error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch tables' });
  }
};

/**
 * GET /api/pg/database/:table
 * Get data from specific PostgreSQL table
 */
export const getTableData = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { table } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    if (!table) return res.status(400).json({ success: false, error: 'Table name is required' });
    // Basic SQL injection prevention for table name
    if (!/^[a-zA-Z0-9_-]+$/.test(table)) return res.status(400).json({ success: false, error: 'Invalid table name' });

    const sql = getSql();
    if (!sql) return res.status(503).json({ success: false, error: 'PostgreSQL connection not ready' });

    // Use sql.unsafe for dynamic table name
    const data = await sql.unsafe(`
      SELECT * FROM "${table}"
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(skip)}
    `);

    const [countResult] = await sql.unsafe(`SELECT COUNT(*) as total FROM "${table}"`);

    res.json({ 
      success: true, 
      data: data, 
      total: parseInt(countResult.total) 
    });
  } catch (err) {
    console.error('[PG-DATABASE] getTableData error:', err);
    res.status(500).json({ success: false, error: `Failed to fetch data: ${err.message}` });
  }
};
