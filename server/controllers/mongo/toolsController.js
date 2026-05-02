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

/**
 * GET /api/tools/weather
 * Fetch weather data from Open-Meteo API (no API key required)
 * Query params: latitude, longitude
 */
export async function getWeather(req, res) {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude',
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90, longitude between -180 and 180',
      });
    }

    // Fetch from Open-Meteo API
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.append('latitude', lat);
    url.searchParams.append('longitude', lon);
    url.searchParams.append('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day');
    url.searchParams.append('hourly', 'temperature_2m,weather_code,precipitation_probability');
    url.searchParams.append('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max');
    url.searchParams.append('timezone', 'auto');
    url.searchParams.append('forecast_days', '7');

    // Fetch AQI from Open-Meteo Air Quality API
    const aqiUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    aqiUrl.searchParams.append('latitude', lat);
    aqiUrl.searchParams.append('longitude', lon);
    aqiUrl.searchParams.append('current', 'pm10,pm2_5,o3,no2,so2,co,european_aqi,us_aqi');
    aqiUrl.searchParams.append('hourly', 'pm10,pm2_5,o3,no2,so2,co,european_aqi,us_aqi');
    aqiUrl.searchParams.append('timezone', 'auto');
    aqiUrl.searchParams.append('forecast_days', '7');

    const [weatherResponse, aqiResponse] = await Promise.all([
      fetch(url.toString()),
      fetch(aqiUrl.toString()),
    ]);

    if (!weatherResponse.ok) {
      throw new Error(`Open-Meteo Weather API error: ${weatherResponse.statusText}`);
    }

    const weatherData = await weatherResponse.json();
    let aqiData = null;

    if (aqiResponse.ok) {
      aqiData = await aqiResponse.json();
    } else {
      console.warn('AQI data not available for this location');
    }

    res.json({
      success: true,
      data: {
        ...weatherData,
        air_quality: aqiData,
      },
    });
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.message,
    });
  }
}

/**
 * GET /api/tools/weather/geocode
 * Geocode location name to coordinates using Open-Meteo Geocoding API
 * Query params: query
 */
export async function geocodeLocation(req, res) {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter is required',
      });
    }

    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.append('name', query);
    url.searchParams.append('count', '10');
    url.searchParams.append('language', 'en');
    url.searchParams.append('format', 'json');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.statusText}`);
    }

    const data = await response.json();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Geocoding API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to geocode location',
      error: error.message,
    });
  }
}
