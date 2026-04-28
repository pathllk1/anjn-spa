import express from 'express';
import { getCurrencyRates, convertCurrencyAmount } from '../../controllers/mongo/toolsController.js';

const router = express.Router();

/**
 * Currency exchange rate endpoints
 */

// Get currency rates (no auth required, public data)
router.get('/currency-rates', getCurrencyRates);

// Convert currency amount (no auth required)
router.post('/convert-currency', convertCurrencyAmount);

export default router;
