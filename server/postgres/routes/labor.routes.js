import express from 'express';
import { laborController } from '../controllers/labor.controller.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// All labor routes require authentication
router.use(authMiddleware);

router.get('/export/:id', laborController.exportToExcel);

// ── Labor Leaders ──────────────────────────────────────────────────────────
router.route('/leaders')
    .get(laborController.getLeaders)
    .post(laborController.createLeader);

router.route('/leaders/:id')
    .put(laborController.updateLeader)
    .delete(laborController.deleteLeader);

// ── Labor Periods ──────────────────────────────────────────────────────────
router.route('/periods')
    .get(laborController.getPeriods)
    .post(laborController.createPeriod);

router.get('/periods/:id/details', laborController.getPeriodDetails);
router.post('/periods/:id/sync', laborController.syncPeriodData);

router.route('/periods/:id')
    .get(laborController.getPeriodById)
    .put(laborController.updatePeriod)
    .delete(laborController.deletePeriod);

// ── Payments & Settlements ─────────────────────────────────────────────────
router.post('/payments/advance', laborController.payAdvance);
router.post('/payments/settle', laborController.settlePeriod);

export default router;
