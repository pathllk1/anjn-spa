import express from 'express';
import { getTables, getTableData } from '../controllers/database.controller.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// All database routes require authentication
router.use(authMiddleware);

/**
 * GET /api/pg/database/tables
 * Get list of all PostgreSQL tables
 */
router.get('/tables', getTables);

/**
 * GET /api/pg/database/:table
 * Get data from specific table
 */
router.get('/:table', getTableData);

export default router;
