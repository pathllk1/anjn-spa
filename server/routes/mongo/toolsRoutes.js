import express from 'express';
import { getCurrencyRates, convertCurrencyAmount, getWeather, geocodeLocation } from '../../controllers/mongo/toolsController.js';

const router = express.Router();

/**
 * Currency exchange rate endpoints
 */

// Get currency rates (no auth required, public data)
router.get('/currency-rates', getCurrencyRates);

// Convert currency amount (no auth required)
router.post('/convert-currency', convertCurrencyAmount);

/**
 * Weather endpoints
 */

// Get weather data for coordinates
router.get('/weather', getWeather);

// Geocode location name to coordinates
router.get('/weather/geocode', geocodeLocation);

export default router;
