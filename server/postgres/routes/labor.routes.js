import express from 'express';
import { laborController } from '../controllers/labor.controller.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// All labor routes require authentication
router.use(authMiddleware);

// Labor Leaders
router.get('/leaders', laborController.getLeaders);
router.post('/leaders', laborController.createLeader);
router.put('/leaders/:id', laborController.updateLeader);
router.delete('/leaders/:id', laborController.deleteLeader);

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
