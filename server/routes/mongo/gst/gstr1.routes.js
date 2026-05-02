/**
 * gstr1.routes.js
 * 
 * GSTR1 report API routes
 */

import express from 'express';
import { authMiddleware } from '../../../middleware/mongo/authMiddleware.js';
import * as gstr1Controller from '../../../controllers/mongo/gst/gstr1Controller.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ── GSTR1 Report Endpoints ─────────────────────────────────────────────────

// Get complete GSTR1 report (all 15 tables)
router.get('/report', gstr1Controller.getCompleteGSTR1Report);

// Get summary statistics
router.get('/summary', gstr1Controller.getGSTR1SummaryReport);

// Table 4A: B2B supplies (registered businesses)
router.get('/b2b', gstr1Controller.getB2BSuppliesReport);

// Table 4B: B2B supplies (reverse charge)
router.get('/b2b-reverse-charge', gstr1Controller.getB2BReverseChargeReport);

// Table 5: B2CL supplies (Large - inter-state > ₹1 lakh)
router.get('/b2cl', gstr1Controller.getB2CLSuppliesReport);

// Table 6: Exports
router.get('/exports', gstr1Controller.getExportsReport);

// Table 7: B2CS supplies (Small - all other B2C)
router.get('/b2cs', gstr1Controller.getB2CSSuppliesReport);

// Table 8: Nil Rated, Exempted, Non-GST supplies
router.get('/nil-rated', gstr1Controller.getNilRatedReport);

// Table 9: Amendments (credit notes, debit notes)
router.get('/amendments', gstr1Controller.getAmendmentsReport);

// Table 10: B2CS Amendments
router.get('/b2cs-amendments', gstr1Controller.getB2CSAmendmentsReport);

// Table 11: Advances Received/Adjusted
router.get('/advances', gstr1Controller.getAdvancesReport);

// Table 12: HSN Summary (B2B Tab)
router.get('/hsn-summary-b2b', gstr1Controller.getHSNSummaryB2BReport);

// Table 12: HSN Summary (B2C Tab)
router.get('/hsn-summary-b2c', gstr1Controller.getHSNSummaryB2CReport);

// Table 12: HSN Summary (Legacy - combined)
router.get('/hsn-summary', gstr1Controller.getHSNSummaryReport);

// Table 13: Document Summary
router.get('/document-summary', gstr1Controller.getDocumentSummaryReport);

// Table 14: E-commerce Supplies (TCS Section 52)
router.get('/ecommerce-supplies', gstr1Controller.getEcommerceSuppliesReport);

// Table 15: E-commerce Operator Supplies (Section 9(5))
router.get('/ecommerce-operator', gstr1Controller.getEcommerceOperatorReport);

// Legacy: B2C supplies (combined B2CL + B2CS)
router.get('/b2c', gstr1Controller.getB2CSuppliesReport);

// Validate GSTR1 data
router.post('/validate', gstr1Controller.validateGSTR1);

// ── Export Endpoints ───────────────────────────────────────────────────────

// Export as JSON
router.get('/export/json', gstr1Controller.exportGSTR1JSON);

// Export as Excel (multi-sheet)
router.get('/export/excel', gstr1Controller.exportGSTR1Excel);

// Export as CSV
router.get('/export/csv', gstr1Controller.exportGSTR1CSV);

export default router;
