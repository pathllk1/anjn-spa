import 'dotenv/config';

const VALID_SAME_SITE_VALUES = new Set(['strict', 'lax', 'none']);

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseSameSite(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  return VALID_SAME_SITE_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

const isProduction = process.env.NODE_ENV === 'production';
const allowCors = parseBoolean(process.env.ENABLE_CORS, true);
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const cookieSecure = parseBoolean(process.env.COOKIE_SECURE, isProduction);
const cookieSameSite = parseSameSite(process.env.COOKIE_SAMESITE, isProduction ? 'none' : 'lax');
const csrfCookieSameSite = parseSameSite(
  process.env.CSRF_COOKIE_SAMESITE,
  cookieSameSite === 'none' ? 'none' : 'lax'
);
const cookieDomain = String(process.env.COOKIE_DOMAIN || '').trim() || undefined;
const trustProxy = parsePositiveInt(process.env.TRUST_PROXY_HOPS, 1);

if (cookieSameSite === 'none' && !cookieSecure) {
  console.warn('[SECURITY] COOKIE_SAMESITE=none without COOKIE_SECURE=true weakens browser enforcement.');
}

if (csrfCookieSameSite === 'none' && !cookieSecure) {
  console.warn('[SECURITY] CSRF_COOKIE_SAMESITE=none without COOKIE_SECURE=true weakens browser enforcement.');
}

function buildCookieOptions({
  maxAge,
  httpOnly = true,
  sameSite = cookieSameSite,
  path = '/',
}) {
  return {
    httpOnly,
    secure: cookieSecure,
    sameSite,
    domain: cookieDomain,
    path,
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

function buildClearCookieOptions(path = '/') {
  return {
    secure: cookieSecure,
    sameSite: cookieSameSite,
    domain: cookieDomain,
    path,
  };
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (!allowCors) return false;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (!allowCors) {
      return callback(new Error('CORS is disabled'));
    }

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  exposedHeaders: ['set-cookie'],
};

export {
  allowCors,
  allowedOrigins,
  buildCookieOptions,
  buildClearCookieOptions,
  cookieDomain,
  cookieSameSite,
  cookieSecure,
  corsOptions,
  csrfCookieSameSite,
  isOriginAllowed,
  isProduction,
  trustProxy,
};
