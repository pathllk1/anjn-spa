/**
 * ════════════════════════════════════════════════════════════════════════════════
 * CRON JOB ROUTES
 * Scheduled tasks that run on Vercel via cron jobs
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * All routes in this file:
 *   • Require X-Cron-Secret header (not user session)
 *   • Bypass normal auth + CSRF checks (cron uses header-based auth instead)
 *   • Log execution time and results
 *   • Return structured JSON responses for monitoring
 */

import express from 'express';
import { cronMiddleware, logCronExecution } from '../../middleware/mongo/cronMiddleware.js';
import { backupDatabaseCron } from '../../controllers/mongo/database.controller.js';

const router = express.Router();

// All cron routes require cron authentication (X-Cron-Secret header)
router.use(cronMiddleware);

/**
 * POST /api/cron/backup
 * Vercel Cron Job: Daily database backup
 *
 * Vercel will call this every day at the configured time with:
 *   POST /api/cron/backup
 *   X-Cron-Secret: <CRON_SECRET env var>
 *
 * Schedule in vercel.json:
 *   {
 *     "crons": [{
 *       "path": "/api/cron/backup",
 *       "schedule": "0 2 * * *"  // daily at 2 AM UTC
 *     }]
 *   }
 */
router.post('/backup', async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('[CRON] Starting daily database backup...');

    // Call the cron-aware backup controller
    // (same backup logic, but without role-based auth check)
    await backupDatabaseCron(req, res);

    const duration = Date.now() - startTime;
    logCronExecution(req, 'success', { durationMs: duration });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Backup failed:', err);
    logCronExecution(req, 'failed', {
      error: err.message,
      durationMs: duration,
    });

    // Only respond if not already sent (backupDatabaseCron might have sent a response)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error:   'Cron backup failed',
        details: err.message,
      });
    }
  }
});

export default router;
