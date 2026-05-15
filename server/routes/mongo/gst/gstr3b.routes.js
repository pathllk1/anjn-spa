/**
 * gstr3b.routes.js
 * 
 * GSTR-3B report API routes
 */

import express from 'express';
import { authMiddleware } from '../../../middleware/mongo/authMiddleware.js';
import * as gstr3bController from '../../../controllers/mongo/gst/gstr3bController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get GSTR-3B report
router.get('/report', gstr3bController.getGSTR3BReport);

// Export GSTR-3B as PDF
router.get('/export/pdf', gstr3bController.exportGSTR3BPDF);

export default router;
