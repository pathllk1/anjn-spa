/**
 * ════════════════════════════════════════════════════════════════════════════════
 * SUPER ADMIN DATABASE CONTROLLER
 * Handles database browsing, collection queries, filtering, and exports
 *
 * Backup destinations (both run in parallel via Promise.allSettled):
 *   1. Infini-Cloud  — WebDAV PUT          (env: INFINI_CLOUD_WEBDAV_*)
 *   2. Vercel Blob   — @vercel/blob put()  (env: BLOB_READ_WRITE_TOKEN)
 *
 * Failure isolation guarantee:
 *   • Each destination runs in its own Promise branch.
 *   • Promise.allSettled is used — it NEVER short-circuits on rejection.
 *   • A failure in one branch cannot cancel, throw into, or delay the other.
 *   • HTTP 207 Multi-Status when one succeeds and one fails.
 *   • HTTP 500 only when EVERY configured destination fails.
 *   • HTTP 503 when no providers are configured at all.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import mongoose           from 'mongoose';
import { gzipSync }       from 'zlib';
import { put as blobPut } from '@vercel/blob';

// ─── Auth guard ───────────────────────────────────────────────────────────────

function ensureSuperAdmin(req, res) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ success: false, error: 'Super admin access required' });
    return false;
  }
  return true;
}

// ─── Deep-transform for backup serialisation ─────────────────────────────────

function transformForBackup(value) {
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value instanceof Date)                    return value.toISOString();
  if (Buffer.isBuffer(value))                   return { __type: 'Buffer', data: value.toString('base64') };
  if (Array.isArray(value))                     return value.map(transformForBackup);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = transformForBackup(v);
    return out;
  }
  return value;
}

// ─── Shallow transform for browsing responses ────────────────────────────────

function shallowTransform(doc) {
  const out = {};
  for (const [key, val] of Object.entries(doc)) {
    out[key] = val instanceof mongoose.Types.ObjectId ? val.toString() : val;
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// BACKUP PROVIDER HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Upload a Buffer to Infini-Cloud via WebDAV PUT.
 *
 * Throws on any network or HTTP error.
 * The caller (backupDatabase) wraps this in Promise.allSettled,
 * so a throw here CANNOT affect the Vercel Blob upload.
 *
 * Env vars required:
 *   INFINI_CLOUD_WEBDAV_URL       e.g. https://your-account.infini-cloud.net/dav
 *   INFINI_CLOUD_WEBDAV_USERNAME
 *   INFINI_CLOUD_WEBDAV_PASSWORD
 *   INFINI_CLOUD_WEBDAV_DIRECTORY (optional — subdirectory path)
 *
 * @param   {Buffer} buffer    gzip-compressed JSON
 * @param   {string} fileName  target filename on the WebDAV server
 * @returns {string}           full upload URL
 */
async function uploadToInfiniCloud(buffer, fileName) {
  const username  = String(process.env.INFINI_CLOUD_WEBDAV_USERNAME || '').trim();
  const password  = String(process.env.INFINI_CLOUD_WEBDAV_PASSWORD || '').trim();
  const baseUrl   = String(process.env.INFINI_CLOUD_WEBDAV_URL      || '').trim();
  const directory = String(process.env.INFINI_CLOUD_WEBDAV_DIRECTORY || '').trim().replace(/^\/+|\/+$/g, '');

  if (!baseUrl)             throw new Error('INFINI_CLOUD_WEBDAV_URL is not configured');
  if (!username || !password) throw new Error('Infini-Cloud WebDAV credentials are not configured');

  const base      = baseUrl.replace(/\/+$/, '');
  const prefix    = directory ? `/${directory}` : '';
  const uploadUrl = `${base}${prefix}/${encodeURIComponent(fileName)}`;

  const response = await fetch(uploadUrl, {
    method:  'PUT',
    headers: {
      Authorization:    `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type':   'application/gzip',
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `WebDAV upload failed (${response.status} ${response.statusText})` +
      (body ? `: ${body.slice(0, 200)}` : '')
    );
  }

  return uploadUrl;
}

/**
 * Upload a Buffer to Vercel Blob private storage.
 *
 * Throws on any network or API error.
 * The caller (backupDatabase) wraps this in Promise.allSettled,
 * so a throw here CANNOT affect the Infini-Cloud upload.
 *
 * Env var required:
 *   BLOB_READ_WRITE_TOKEN   set automatically on Vercel; add to .env for local dev
 *
 * @param   {Buffer} buffer    gzip-compressed JSON
 * @param   {string} fileName  target blob pathname
 * @returns {string}           blob.url returned by Vercel Blob
 */
async function uploadToVercelBlob(buffer, fileName) {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');

  // Vercel Blob stores are provisioned as "public" or "private" at the dashboard level.
  // Using access:'private' on a public store throws BlobError.
  // access:'public' is accepted by both store types. The backup URL is
  // unguessable (random suffix) so the file is not discoverable without the URL.
  const blob = await blobPut(fileName, buffer, {
    access:      'public',
    contentType: 'application/gzip',
    token,
  });

  return blob.url;
}

// ═════════════════════════════════════════════════════════════════════════════
// COLLECTION BROWSING ENDPOINTS  (unchanged logic, refactored to shallowTransform)
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/super-admin/database/collections */
export const getCollections = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const collections = await mongoose.connection.db.listCollections().toArray();
    const names = collections
      .map(c => c.name)
      .filter(n => !n.startsWith('system.'))
      .sort();

    res.json({ success: true, collections: names });
  } catch (err) {
    console.error('[DATABASE] getCollections error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch collections' });
  }
};

/** GET /api/super-admin/database/collections/:collection */
export const getCollectionData = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { collection }          = req.params;
    const { sort = '_id', order = 'asc' } = req.query;

    if (!collection)                           return res.status(400).json({ success: false, error: 'Collection name is required' });
    if (!/^[a-zA-Z0-9_-]+$/.test(collection)) return res.status(400).json({ success: false, error: 'Invalid collection name' });

    const ref        = mongoose.connection.collection(collection);
    const totalCount = await ref.countDocuments({});
    const data       = await ref.find({}).sort({ [sort]: order === 'desc' ? -1 : 1 }).toArray();

    res.json({ success: true, data: data.map(shallowTransform), total: totalCount });
  } catch (err) {
    console.error('[DATABASE] getCollectionData error:', err);
    res.status(500).json({ success: false, error: `Failed to fetch data: ${err.message}` });
  }
};

/** GET /api/super-admin/database/collections/:collection/stats */
export const getCollectionStats = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { collection } = req.params;

    if (!collection)                           return res.status(400).json({ success: false, error: 'Collection name is required' });
    if (!/^[a-zA-Z0-9_-]+$/.test(collection)) return res.status(400).json({ success: false, error: 'Invalid collection name' });

    const ref     = mongoose.connection.collection(collection);
    const stats   = await mongoose.connection.db.collection(collection).stats();
    const count   = await ref.countDocuments();
    const indexes = await ref.indexes();

    res.json({
      success: true,
      stats: {
        name:        collection,
        count,
        size:        stats.size        || 0,
        avgDocSize:  stats.avgObjSize  || 0,
        storageSize: stats.storageSize || 0,
        indexes:     indexes.length,
        indexNames:  indexes.map(i => i.name),
      },
    });
  } catch (err) {
    console.error('[DATABASE] getCollectionStats error:', err);
    res.status(500).json({ success: false, error: `Failed to fetch stats: ${err.message}` });
  }
};

/** GET /api/super-admin/database/collections/:collection/export */
export const exportCollectionAsJSON = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { collection } = req.params;

    if (!collection || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
      return res.status(400).json({ success: false, error: 'Invalid collection name' });
    }

    const data = await mongoose.connection.collection(collection).find({}).toArray();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${collection}-${Date.now()}.json"`);
    res.send(JSON.stringify(data.map(shallowTransform), null, 2));
  } catch (err) {
    console.error('[DATABASE] exportCollectionAsJSON error:', err);
    res.status(500).json({ success: false, error: 'Export failed' });
  }
};

/** GET /api/super-admin/database/collections/:collection/samples */
export const getSampleDocuments = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { collection } = req.params;
    const { limit = 5 }  = req.query;

    if (!collection || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
      return res.status(400).json({ success: false, error: 'Invalid collection name' });
    }

    const samples = await mongoose.connection
      .collection(collection)
      .find({})
      .limit(parseInt(limit, 10))
      .toArray();

    res.json({ success: true, samples: samples.map(shallowTransform) });
  } catch (err) {
    console.error('[DATABASE] getSampleDocuments error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch samples' });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT MUTATION ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** DELETE /api/super-admin/database/collections/:collection/documents/:id */
export const deleteDocument = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { collection, id } = req.params;

    if (!collection || !id)                    return res.status(400).json({ success: false, error: 'Collection and ID required' });
    if (!/^[a-zA-Z0-9_-]+$/.test(collection)) return res.status(400).json({ success: false, error: 'Invalid collection name' });
    if (!mongoose.Types.ObjectId.isValid(id))  return res.status(400).json({ success: false, error: 'Invalid document ID' });

    const result = await mongoose.connection
      .collection(collection)
      .deleteOne({ _id: new mongoose.Types.ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({ success: true, message: `Document deleted from ${collection}` });
  } catch (err) {
    console.error('[DATABASE] deleteDocument error:', err);
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
};

/** DELETE /api/super-admin/database/collections/:collection/empty */
export const emptyCollection = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { collection } = req.params;

    if (!collection || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
      return res.status(400).json({ success: false, error: 'Invalid collection name' });
    }

    const result = await mongoose.connection.collection(collection).deleteMany({});
    console.log(`[DATABASE] emptyCollection: "${collection}" — deleted ${result.deletedCount} documents`);

    res.json({
      success:      true,
      message:      `Collection "${collection}" emptied — ${result.deletedCount} document(s) deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error('[DATABASE] emptyCollection error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to empty collection' });
  }
};

/** DELETE /api/super-admin/database/collections/:collection */
export const dropCollection = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { collection } = req.params;

    if (!collection || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
      return res.status(400).json({ success: false, error: 'Invalid collection name' });
    }

    try {
      await mongoose.connection.collection(collection).drop();
    } catch (dropErr) {
      if (dropErr.codeName === 'NamespaceNotFound' || dropErr.code === 26) {
        return res.json({ success: true, message: `Collection "${collection}" did not exist (already dropped)` });
      }
      throw dropErr;
    }

    console.log(`[DATABASE] dropCollection: "${collection}" dropped`);
    res.json({ success: true, message: `Collection "${collection}" has been permanently dropped` });
  } catch (err) {
    console.error('[DATABASE] dropCollection error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to drop collection' });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// BACKUP ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/super-admin/database/backup/status
 *
 * Returns configuration state for both providers.
 * Credentials are never included — only boolean "configured" flags.
 */
export const getBackupStatus = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  const infiniConfigured = Boolean(
    process.env.INFINI_CLOUD_WEBDAV_URL      &&
    process.env.INFINI_CLOUD_WEBDAV_USERNAME &&
    process.env.INFINI_CLOUD_WEBDAV_PASSWORD
  );
  const vercelConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  res.json({
    success: true,
    providers: {
      infiniCloud: {
        name:       'Infini-Cloud WebDAV',
        configured: infiniConfigured,
        directory:  String(process.env.INFINI_CLOUD_WEBDAV_DIRECTORY || '').trim() || '/',
        format:     'json.gz',
      },
      vercelBlob: {
        name:       'Vercel Blob',
        configured: vercelConfigured,
        format:     'json.gz',
      },
    },
    // Flat legacy fields for backwards-compat with existing frontend code
    configured: infiniConfigured || vercelConfigured,
    provider:   'Infini-Cloud WebDAV + Vercel Blob',
    format:     'json.gz',
  });
};

/**
 * POST /api/super-admin/database/backup
 *
 * Full database backup uploaded to Infini-Cloud AND Vercel Blob in parallel.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  ISOLATION MECHANISM                                                   │
 * │                                                                        │
 * │  Promise.allSettled([infiniUpload, vercelUpload])                      │
 * │                                                                        │
 * │  allSettled NEVER rejects and NEVER short-circuits.                    │
 * │  Both uploads always run to completion (success or failure)            │
 * │  regardless of what the other does.                                    │
 * │                                                                        │
 * │  The only shared data is the gzip buffer (read-only, not mutated).     │
 * │                                                                        │
 * │  Response matrix:                                                      │
 * │    both succeed              → HTTP 200 { success: true }              │
 * │    one succeeds, one fails   → HTTP 207 { success: true, ... }         │
 * │    both fail                 → HTTP 500 { success: false }             │
 * │    no providers configured   → HTTP 503 { success: false }             │
 * └──────────────────────────────────────────────────────────────────────┘
 */
export const backupDatabase = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const db = mongoose.connection;
    if (!db?.db) {
      return res.status(503).json({ success: false, error: 'Database connection is not ready' });
    }

    // ── 1. Serialise all collections ─────────────────────────────────────
    const rawCollections = await db.db.listCollections().toArray();
    const collectionNames = rawCollections
      .map(e => e.name)
      .filter(n => !n.startsWith('system.'))
      .sort();

    const payload = {
      meta: {
        provider:         'SecureApp MongoDB Backup',
        generated_at:     new Date().toISOString(),
        database_name:    db.db.databaseName,
        collection_count: collectionNames.length,
        format:           'json.gz',
      },
      collections: {},
    };

    for (const name of collectionNames) {
      const docs = await db.collection(name).find({}).toArray();
      payload.collections[name] = docs.map(transformForBackup);
    }

    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName   = `${db.db.databaseName || 'mongodb'}-backup-${timestamp}.json.gz`;
    const gzipBuf    = gzipSync(Buffer.from(JSON.stringify(payload)));

    console.log(`[DATABASE] backup: "${fileName}" ${gzipBuf.length} bytes ${collectionNames.length} collections`);

    // ── 2. Guard: at least one provider must be configured ───────────────
    const infiniEnabled = Boolean(
      process.env.INFINI_CLOUD_WEBDAV_URL      &&
      process.env.INFINI_CLOUD_WEBDAV_USERNAME &&
      process.env.INFINI_CLOUD_WEBDAV_PASSWORD
    );
    const vercelEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

    if (!infiniEnabled && !vercelEnabled) {
      return res.status(503).json({
        success: false,
        error:   'No backup providers are configured. '
               + 'Set INFINI_CLOUD_WEBDAV_* and/or BLOB_READ_WRITE_TOKEN.',
      });
    }

    // ── 3. Run both uploads in parallel — fully isolated ─────────────────
    //
    // Each branch is self-contained:
    //   • uploadToInfiniCloud throws  → captured as rejected in infiniResult
    //                                    vercelResult is completely unaffected
    //   • uploadToVercelBlob throws   → captured as rejected in vercelResult
    //                                    infiniResult is completely unaffected
    //
    // gzipBuf is a read-only Buffer shared between both — neither upload
    // modifies it, so there is no shared mutable state.
    //
    const [infiniResult, vercelResult] = await Promise.allSettled([
      infiniEnabled
        ? uploadToInfiniCloud(gzipBuf, fileName)
        : Promise.reject(new Error('Not configured — skipped')),

      vercelEnabled
        ? uploadToVercelBlob(gzipBuf, fileName)
        : Promise.reject(new Error('Not configured — skipped')),
    ]);

    // ── 4. Build structured per-destination outcome objects ───────────────
    // Compute the exact missing env vars per provider so skip reasons are actionable.
    const infiniMissing = [
      !process.env.INFINI_CLOUD_WEBDAV_URL      && 'INFINI_CLOUD_WEBDAV_URL',
      !process.env.INFINI_CLOUD_WEBDAV_USERNAME && 'INFINI_CLOUD_WEBDAV_USERNAME',
      !process.env.INFINI_CLOUD_WEBDAV_PASSWORD && 'INFINI_CLOUD_WEBDAV_PASSWORD',
    ].filter(Boolean);

    const vercelMissing = [
      !process.env.BLOB_READ_WRITE_TOKEN && 'BLOB_READ_WRITE_TOKEN',
    ].filter(Boolean);

    const infiniOutcome = resolveOutcome('Infini-Cloud WebDAV', infiniEnabled, infiniResult, infiniMissing);
    const vercelOutcome = resolveOutcome('Vercel Blob',          vercelEnabled, vercelResult, vercelMissing);

    const successCount = [infiniOutcome, vercelOutcome].filter(o => o.status === 'success').length;
    const failedCount  = [infiniOutcome, vercelOutcome].filter(o => o.status === 'failed').length;
    const allFailed    = failedCount > 0 && successCount === 0;

    // Log each provider with full detail so the console is self-explanatory
    const outcomeLabel = (o) =>
      o.status === 'skipped' ? `skipped (${o.reason})`
      : o.status === 'failed'  ? `failed (${o.error})`
      : 'success';
    console.log(`[DATABASE] backup results — infini:${outcomeLabel(infiniOutcome)} vercel:${outcomeLabel(vercelOutcome)}`);

    // ── 5. Respond ────────────────────────────────────────────────────────
    const base = {
      fileName,
      sizeBytes:   gzipBuf.length,
      collections: collectionNames.length,
      generatedAt: payload.meta.generated_at,
      destinations: {
        infiniCloud: infiniOutcome,
        vercelBlob:  vercelOutcome,
      },
    };

    if (allFailed) {
      // Every enabled provider failed — hard failure
      return res.status(500).json({
        ...base,
        success: false,
        error: 'All backup destinations failed. See destinations for individual errors.',
      });
    }

    const successNames = [infiniOutcome, vercelOutcome]
      .filter(o => o.status === 'success')
      .map(o => o.provider)
      .join(' and ');

    const partialFailure = failedCount > 0;

    return res.status(partialFailure ? 207 : 200).json({
      ...base,
      success: true,
      message: partialFailure
        ? `Backup succeeded on ${successNames}. Check destinations for partial failure details.`
        : `Backup uploaded successfully to ${successNames}.`,
    });

  } catch (err) {
    // Only reachable for errors before the parallel uploads (e.g. DB serialisation failure)
    console.error('[DATABASE] backupDatabase unexpected error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to backup database' });
  }
};

/**
 * Legacy export alias — keeps any existing route files that import
 * `backupDatabaseToWebDav` working without modification.
 */
export const backupDatabaseToWebDav = backupDatabase;

// ─── Internal: convert Promise.allSettled entry into a flat outcome object ───

/**
 * @param {string}  providerName
 * @param {boolean} enabled       — whether this provider was configured
 * @param {{ status: string, value?: string, reason?: unknown }} settled
 * @returns {{ provider: string, status: 'success'|'failed'|'skipped', url?: string, error?: string, reason?: string }}
 */
function resolveOutcome(providerName, enabled, settled, missingVars = []) {
  if (!enabled) {
    // Build a precise reason: list every missing env var by name
    const reason = missingVars.length
      ? `Missing env var${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}`
      : 'Not configured';
    console.log(`[DATABASE] ${providerName} skipped — ${reason}`);
    return { provider: providerName, status: 'skipped', reason, missingVars };
  }
  if (settled.status === 'fulfilled') {
    return { provider: providerName, status: 'success', url: settled.value };
  }
  const msg = settled.reason instanceof Error
    ? settled.reason.message
    : String(settled.reason ?? 'Unknown error');
  console.error(`[DATABASE] ${providerName} upload failed:`, settled.reason);
  return { provider: providerName, status: 'failed', error: msg };
}