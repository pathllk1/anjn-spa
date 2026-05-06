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

/**
 * GET /api/tools/news
 * Fetch news from Google News RSS (Hindi and Bengali)
 * Query params: lang (hi, bn)
 */
export async function getNews(req, res) {
  try {
    const { lang = 'hi', topic = 'business' } = req.query;
    
    // Construct Google News RSS URL based on language and topic
    // Using search?q={topic} is more flexible than standard topic IDs
    const baseUrl = 'https://news.google.com/rss/search';
    const params = new URLSearchParams({
      q: topic,
      hl: lang,
      gl: 'IN',
      ceid: `IN:${lang}`
    });
    
    const url = `${baseUrl}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`News fetch failed: ${response.statusText}`);
    }
    
    const xml = await response.text();
    
    // Manual XML parsing for items (minimalist but robust for Google News RSS)
    const items = [];
    // More robust regex to catch <item> tags regardless of spacing/newlines
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      
      const title = extractTag(itemContent, 'title');
      const link = extractTag(itemContent, 'link');
      const pubDate = extractTag(itemContent, 'pubDate');
      const source = extractTag(itemContent, 'source');
      const description = extractTag(itemContent, 'description');
      
      // Extract image URL from description if present
      let imageUrl = '';
      const imgMatch = /<img[^>]+src="([^">]+)"/i.exec(description);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
      
      if (!title || !link) continue;

      // Attempt to clean title (Google News appends " - Source")
      let cleanTitle = title;
      if (source && title.toLowerCase().endsWith(` - ${source.toLowerCase()}`)) {
        cleanTitle = title.substring(0, title.lastIndexOf(' - '));
      }
      
      items.push({
        title: cleanTitle,
        link,
        pubDate,
        source: source || 'News Source',
        imageUrl,
        lang
      });
      
      if (items.length >= 25) break; // Limit to 25 items
    }
    
    res.json({
      success: true,
      data: items,
      count: items.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('News API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,
    });
  }
}

/**
 * Helper to extract tag content from XML string
 */
function extractTag(xml, tag) {
  // Matches <tag>content</tag> or <tag ...>content</tag>
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return '';
  
  let content = match[1].trim();
  // Remove CDATA wrapper if present
  content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  // Decode basic XML entities
  content = content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
    
  return content.trim();
}
