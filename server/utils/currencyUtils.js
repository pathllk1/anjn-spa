/**
 * Currency exchange rate fetching utility
 * Fetches rates from Frankfurter API on the server to avoid CSP issues
 */

// Cache rates for 6 hours to reduce API calls
const CACHE_DURATION = 6 * 60 * 60 * 1000;
let ratesCache = null;
let cacheTimestamp = null;

/**
 * Fetch currency rates from Frankfurter API
 * @param {string} baseCurrency - Base currency code (default: USD)
 * @returns {Promise<object>} Exchange rates object
 */
export async function fetchCurrencyRates(baseCurrency = 'USD') {
  try {
    // Check if cache is still valid
    if (ratesCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return ratesCache;
    }

    const url = `https://api.frankfurter.app/latest?from=${baseCurrency}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Add the base currency itself with rate 1
    data.rates[baseCurrency] = 1;

    // Cache the rates
    ratesCache = data.rates;
    cacheTimestamp = Date.now();

    return data.rates;
  } catch (error) {
    console.error('Failed to fetch currency rates:', error.message);
    
    // Return fallback rates if API fails
    return getFallbackRates(baseCurrency);
  }
}

/**
 * Get fallback exchange rates
 * @param {string} baseCurrency - Base currency code
 * @returns {object} Fallback rates
 */
function getFallbackRates(baseCurrency = 'USD') {
  const fallbackRates = {
    USD: {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      INR: 83.15,
      AED: 3.67,
      SGD: 1.35,
      JPY: 154.2,
      AUD: 1.52,
      CAD: 1.37,
    },
    EUR: {
      EUR: 1,
      USD: 1.09,
      GBP: 0.86,
      INR: 90.5,
      AED: 4,
      SGD: 1.47,
      JPY: 168,
      AUD: 1.66,
      CAD: 1.49,
    },
    INR: {
      INR: 1,
      USD: 0.012,
      EUR: 0.011,
      GBP: 0.0095,
      AED: 0.045,
      SGD: 0.016,
      JPY: 1.85,
      AUD: 0.018,
      CAD: 0.016,
    },
  };

  return fallbackRates[baseCurrency] || fallbackRates.USD;
}

/**
 * Convert amount between two currencies
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @param {object} rates - Exchange rates object
 * @returns {number} Converted amount
 */
export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!rates || !rates[toCurrency]) {
    return 0;
  }

  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Get USD rate for both currencies (Frankfurter API uses USD as base)
  const toRate = rates[toCurrency];
  const fromRate = rates[fromCurrency] || 1;

  return (amount / fromRate) * toRate;
}

/**
 * Clear the rates cache
 */
export function clearRatesCache() {
  ratesCache = null;
  cacheTimestamp = null;
}
