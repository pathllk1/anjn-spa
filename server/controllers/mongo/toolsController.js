/**
 * Tools controller - handles calculator and utility tools endpoints
 */

import { fetchCurrencyRates, convertCurrency } from '../../utils/currencyUtils.js';

/**
 * GET /api/tools/currency-rates
 * Fetch currency exchange rates from server (avoids CSP issues)
 */
export async function getCurrencyRates(req, res) {
  try {
    const { base = 'USD' } = req.query;

    // Validate base currency is a valid 3-letter code
    if (!base || base.length !== 3 || !/^[A-Z]+$/.test(base)) {
      return res.status(400).json({
        error: 'Invalid currency code',
        message: 'Base currency must be a 3-letter code (e.g., USD, EUR, INR)',
      });
    }

    const rates = await fetchCurrencyRates(base);

    res.json({
      success: true,
      base,
      rates,
      timestamp: new Date().toISOString(),
      source: 'Frankfurter API (cached on server)',
    });
  } catch (error) {
    console.error('Error fetching currency rates:', error);
    res.status(500).json({
      error: 'Failed to fetch currency rates',
      message: error.message,
    });
  }
}

/**
 * POST /api/tools/convert-currency
 * Convert amount between two currencies
 */
export async function convertCurrencyAmount(req, res) {
  try {
    const { amount, from, to, rates } = req.body;

    // Validation
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a non-negative number',
      });
    }

    if (!from || from.length !== 3 || !/^[A-Z]+$/.test(from)) {
      return res.status(400).json({
        error: 'Invalid source currency',
        message: 'Source currency must be a 3-letter code',
      });
    }

    if (!to || to.length !== 3 || !/^[A-Z]+$/.test(to)) {
      return res.status(400).json({
        error: 'Invalid target currency',
        message: 'Target currency must be a 3-letter code',
      });
    }

    if (!rates || typeof rates !== 'object') {
      return res.status(400).json({
        error: 'Invalid rates object',
        message: 'Rates object is required',
      });
    }

    const converted = convertCurrency(amount, from, to, rates);

    res.json({
      success: true,
      original: { amount, currency: from },
      converted: { amount: converted, currency: to },
      rate: rates[to] || null,
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    res.status(500).json({
      error: 'Failed to convert currency',
      message: error.message,
    });
  }
}
