import express from 'express';
import { laborController } from '../controllers/labor.controller.js';

const router = express.Router();

// Labor Leaders
router.get('/leaders', laborController.getLeaders);
router.post('/leaders', laborController.createLeader);

// Labor Periods
router.get('/periods', laborController.getPeriods);
router.post('/periods', laborController.createPeriod);
router.delete('/periods/:id', laborController.deletePeriod);
router.get('/periods/:id/details', laborController.getPeriodDetails);
router.post('/periods/:id/sync', laborController.syncPeriodData);

// Payments & Settlements
router.post('/payments/advance', laborController.payAdvance);
router.post('/payments/settle', laborController.settlePeriod);

export default router;
