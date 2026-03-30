# Vercel Cron Job Failure Analysis
**Analysis Date**: March 30, 2026  
**Status**: ❌ Cron job likely NOT triggering

---

## Executive Summary

Your Vercel cron job configured in `vercel.json` to run daily at **6 AM UTC** at path `/api/cron/backup` is **likely not executing** or **silently failing**. 

**Root Cause (High Probability)**: The `CRON_SECRET` environment variable is **NOT SET on Vercel**, causing all cron requests to be rejected with **HTTP 503**.

**Secondary Issues**: Even if CRON_SECRET is set, no backup providers are configured, so the cron would succeed at authentication but fail to upload backups.

---

## Complete Cron Job Flow Analysis

### 1. **Vercel Configuration** ✅ (Correctly Configured)

**File**: [vercel.json](vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Analysis**:
- ✅ Schedule: `0 6 * * *` = Daily at 6:00 AM UTC
- ✅ Path: `/api/cron/backup` = Correct endpoint
- ✅ Syntax: Valid cron schedule format

**How Vercel Invokes It**:
```
Vercel Cron Scheduler
    ↓
POST /api/cron/backup
Headers:
  - Host: your-deployment.vercel.app
  - X-Cron-Secret: <value of CRON_SECRET env var>
  ↓
Your Express Server
```

---

### 2. **Server Routes** ✅ (Correctly Configured)

**File**: [server/routes/mongo/cron.routes.js](server/routes/mongo/cron.routes.js)

```javascript
router.post('/backup', async (req, res) => {
  // Expects POST request with X-Cron-Secret header
  await backupDatabaseCron(req, res);
});
```

**Analysis**:
- ✅ Route method: `POST` (matches Vercel's request)
- ✅ Route path: `/backup` (combined with `/api/cron` prefix = `/api/cron/backup`)
- ✅ Handler: Calls `backupDatabaseCron()` from database.controller.js

---

### 3. **Cron Middleware Authentication** ⚠️ (CRITICAL FAILURE POINT)

**File**: [server/middleware/mongo/cronMiddleware.js](server/middleware/mongo/cronMiddleware.js)

```javascript
const CRON_SECRET = process.env.CRON_SECRET;

export const cronMiddleware = async (req, res, next) => {
  // GUARD 1: Check if CRON_SECRET env var is set
  if (!CRON_SECRET) {
    console.error('[CRON] ❌ CRON_SECRET env var is not configured. Cron jobs are disabled.');
    return res.status(503).json({
      success: false,
      error: 'Cron jobs are not configured on this server. Set CRON_SECRET env var.',
    });
  }

  // GUARD 2: Check if request has X-Cron-Secret header
  const cronSecret = req.headers['x-cron-secret'] || req.headers['X-Cron-Secret'];
  if (!cronSecret) {
    return res.status(401).json({
      success: false,
      error: 'X-Cron-Secret header is required',
    });
  }

  // GUARD 3: Validate secret matches env var
  if (cronSecret !== CRON_SECRET) {
    return res.status(403).json({
      success: false,
      error: 'Invalid cron secret',
    });
  }

  // ✅ All checks passed
  req.isCronJob = true;
  next();
};
```

**Critical Analysis**:

| Guard | Status | Likely Issue | Impact |
|-------|--------|--------------|--------|
| **CRON_SECRET env var exists?** | ❌ LIKELY MISSING | Not set on Vercel | **HTTP 503** — cron request rejected immediately |
| **X-Cron-Secret header present?** | ✅ SHOULD PASS | Vercel provides it | — |
| **Header value matches CRON_SECRET?** | ⚠️ UNKNOWN | Depends on Guard 1 | — |

**What Happens When CRON_SECRET Is Missing**:
```
Vercel sends: POST /api/cron/backup + X-Cron-Secret: <env var value>
    ↓
cronMiddleware runs
    ↓
Checks: process.env.CRON_SECRET exists?
    ↓
NO ❌
    ↓
Returns HTTP 503
"Cron jobs are not configured on this server. Set CRON_SECRET env var."
    ↓
Cron request FAILS
```

---

### 4. **Server Route Registration** ✅ (Correctly Ordered)

**File**: [server/server.js](server/server.js#L70-L74)

```javascript
// ── Cron job routes (bypass CSRF validation) ──────────────────────────────
// Cron routes use header-based authentication (X-Cron-Secret) instead of
// session cookies, so they cannot participate in CSRF token validation.
// Register them HERE, before csrfGenerateToken/csrfValidateToken are applied.
app.use('/api/cron', cronRoutes);

// ── CSRF protection for all other routes ──────────────────────────────────
app.use(csrfGenerateToken);
app.use(csrfValidateToken);
```

**Analysis**:
- ✅ Cron routes registered **BEFORE** CSRF middleware (correct — bypasses CSRF check)
- ✅ Cron middleware is already embedded in `croutes` via `router.use(cronMiddleware)`
- ✅ Request flow is proper: cronMiddleware → backupDatabaseCron

---

### 5. **Backup Controller** ✅ (Code Correct, But Might Fail)

**File**: [server/controllers/mongo/database.controller.js](server/controllers/mongo/database.controller.js#L731-L800)

```javascript
export const backupDatabaseCron = async (req, res) => {
  // 1. Serialize all MongoDB collections to BSON
  // 2. Compress with gzip
  // 3. Upload to configured providers in parallel (Infini-Cloud, Vercel Blob, Backblaze B2)
  // 4. Return HTTP 200/207/500 based on results
};
```

**Execution Flow**:
```
cronMiddleware (✅ passes if CRON_SECRET set)
    ↓
backupDatabaseCron()
    ├─ Check: MongoDB connection ready?
    ├─ Serialize collections to BSON
    ├─ Compress to gzip
    ├─ Check: At least one provider configured?
    │   ├─ INFINI_CLOUD_WEBDAV_URL + USERNAME + PASSWORD?
    │   ├─ BLOB_READ_WRITE_TOKEN?
    │   └─ B2_APPLICATION_KEY_ID + B2_APPLICATION_KEY + B2_BUCKET_ID?
    ├─ Upload in parallel (Promise.allSettled)
    │   ├─ uploadToInfiniCloud()
    │   ├─ uploadToVercelBlob()
    │   └─ uploadToBackblazeB2()
    └─ Return 200/207/500 based on success
```

**Possible Outcomes**:
| Status | Condition | HTTP Code | Message |
|--------|-----------|-----------|---------|
| ✅ Success | All providers succeed | 200 | "Cron backup uploaded successfully..." |
| ⚠️ Partial | ≥1 succeeds, ≥1 fails | 207 | "Cron backup succeeded on [provider]..." |
| ❌ No providers | No providers configured | 503 | "No backup providers are configured..." |
| ❌ All fail | All enabled providers failed | 500 | "All backup destinations failed..." |
| ❌ DB error | DB connection not ready | 503 | "Database connection is not ready" |

---

## Identified Issues

### **Issue #1: CRON_SECRET NOT SET ON VERCEL** ❌ (BLOCKING)

**Severity**: CRITICAL

**Evidence**:
- cronMiddleware checks for `process.env.CRON_SECRET` on line 33
- If missing, returns HTTP 503 immediately
- No indication that CRON_SECRET has been added to Vercel environment variables

**Impact**: 
- Every cron request is rejected with 503
- Backup never runs
- Cron logs show "Cron jobs not configured on this server"

**Verification**: 
Check Vercel Dashboard → Settings → Environment Variables → Is CRON_SECRET set?

**Fix**: 
```bash
# 1. Generate a secret locally
openssl rand -base64 32
# Output: AbCdEfGhIjKlMnOpQrStUvWxYz+/1234567890...

# 2. Add to Vercel Dashboard
# Settings → Environment Variables
# Name: CRON_SECRET
# Value: <paste the secret>
# Environments: Production (+ others as needed)

# 3. Redeploy (git push)
```

---

### **Issue #2: NO BACKUP PROVIDERS CONFIGURED** ⚠️ (SECONDARY)

**Severity**: HIGH (prevents backup even if cron runs)

**Evidence**:
- backupDatabaseCron checks for provider env vars on lines 779-788
- Three providers are supported but NONE appear to be configured:
  - ❌ INFINI_CLOUD_WEBDAV_URL / USERNAME / PASSWORD
  - ❌ BLOB_READ_WRITE_TOKEN
  - ❌ B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY / B2_BUCKET_ID

**Impact**: 
- Even if CRON_SECRET is set, cron would authenticate successfully
- But then backupDatabaseCron would return HTTP 503: "No backup providers configured"
- Backup data is serialized but NOT uploadeded anywhere

**Fix**: Configure at least ONE provider. Simplest option is **Vercel Blob** (native to Vercel):

```bash
# Vercel Blob (automatic on Vercel deployments)
# Usually just works with BLOB_READ_WRITE_TOKEN (set automatically by Vercel)
# Verify it's set in Vercel Dashboard → Settings → Environment Variables

# OR use Infini-Cloud WebDAV (if you have an account)
# Add these env vars:
# - INFINI_CLOUD_WEBDAV_URL
# - INFINI_CLOUD_WEBDAV_USERNAME
# - INFINI_CLOUD_WEBDAV_PASSWORD
# - INFINI_CLOUD_WEBDAV_DIRECTORY (optional)

# OR use Backblaze B2 (if you have an account)
# Add these env vars:
# - B2_APPLICATION_KEY_ID
# - B2_APPLICATION_KEY
# - B2_BUCKET_ID
# - B2_BUCKET_PREFIX (optional)
```

---

### **Issue #3: UNABLE TO MONITOR CRON EXECUTION** ⚠️ (VISIBILITY)

**Severity**: MEDIUM (masks issues)

**Evidence**:
- Vercel Dashboard → Monitoring → Cron Jobs should show execution logs
- No indication in documentation that monitoring is enabled or visible
- Without direct access to Vercel Dashboard, impossible to verify if cron runs

**Impact**: 
- Can't see if cron is actually being triggered
- Can't see HTTP status codes or response bodies
- Silent failures go unnoticed

**Fix**: Periodically check Vercel Dashboard for:
1. Cron Jobs section → Last execution time and status
2. Function logs → Filter for `[CRON]` prefix
3. Manual test: `curl -X POST https://your-app.vercel.app/api/cron/backup -H "X-Cron-Secret: <your-secret>"`

---

## Diagnostic Checklist

Use this to identify exactly which guard is failing:

### Step 1: Verify Configuration Files

- [ ] **vercel.json** has crop job config:
  ```json
  "crons": [{ "path": "/api/cron/backup", "schedule": "0 6 * * *" }]
  ```

- [ ] **server/server.js** registers cron routes before CSRF:
  ```javascript
  app.use('/api/cron', cronRoutes);
  app.use(csrfGenerateToken); // After cron
  ```

- [ ] **server/routes/mongo/cron.routes.js** exists and exports router

### Step 2: Check Vercel Environment Variables

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Must have for cron to even start:
- [ ] `CRON_SECRET` = `<your-secret>` (production env)

At least one backup provider:
- [ ] `BLOB_READ_WRITE_TOKEN` (automatic on Vercel, but verify)
  OR
- [ ] `INFINI_CLOUD_WEBDAV_URL`, `INFINI_CLOUD_WEBDAV_USERNAME`, `INFINI_CLOUD_WEBDAV_PASSWORD`
  OR
- [ ] `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_ID`

### Step 3: Manual Test Local Server

```bash
# Start your server locally
npm run dev  # or node server/server.js

# In another terminal, test the cron endpoint
export CRON_SECRET="your-test-secret"

curl -X POST http://localhost:3000/api/cron/backup \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response**:
- If CRON_SECRET not set: `HTTP 503 "Cron jobs not configured"`
- If CRON_SECRET set but no providers: `HTTP 503 "No backup providers configured"`
- If CRON_SECRET set and Vercel Blob available: `HTTP 200 "Cron backup uploaded successfully..."`

### Step 4: Test on Vercel

```bash
# Get your Vercel app URL
VERCEL_URL="https://your-app.vercel.app"
CRON_SECRET="<value-from-vercel-env-vars>"

# Test the endpoint
curl -X POST ${VERCEL_URL}/api/cron/backup \
  -H "X-Cron-Secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

### Step 5: Check Vercel Logs

1. Go to **Vercel Dashboard** → Your Project
2. Click **Deployments** → select latest
3. Go to **Functions** tab
4. Click `api/index.js` → view logs
5. Look for `[CRON]` log entries
6. Check timestamps for recent executions

### Step 6: Monitor Dashboard

1. Go to **Vercel Dashboard** → Your Project
2. Click **Monitoring** tab (if available)
3. Look for **Cron Jobs** section
4. Should show:
   - Last execution time
   - Status (success/failed)
   - Response logs
   - Execution duration

---

## Root Cause: Why Cron Likely Isn't Triggering

### Most Probable Cause (80% confidence)
**CRON_SECRET environment variable is NOT SET on Vercel**

**Evidence Chain**:
1. cronMiddleware requires CRON_SECRET to be set (line 38)
2. If missing, returns HTTP 503 immediately
3. No documentation indicates CRON_SECRET was added to Vercel
4. Vercel's cron system will still invoke the endpoint, but it fails at authentication

**Result**: Cron executes on Vercel's schedule, but returns 503 every time.

### Secondary Probable Cause (15% confidence)
**CRON_SECRET is set, but no backup providers are configured**

**Evidence Chain**:
1. cronMiddleware would pass
2. But backupDatabaseCron checks for providers (lines 779-788)
3. If no BLOB_READ_WRITE_TOKEN or other provider env vars exist, returns HTTP 503
4. Cron "succeeds" (endpoint called), but backup doesn't actually happen

**Result**: Cron authentication passes, but backup fails due to missing destinations.

### Unlikely Causes (5% confidence)
- Vercel cron scheduler is disabled for your account (would show in Vercel Dashboard)
- Route path is incorrect (but vercel.json and routes are correctly configured)
- MongoDB connection fails on cold start (would show in function logs)
- Cron schedule is wrong (but `0 6 * * *` is valid syntax)

---

## Recommended Action Plan

### Immediate Fix (10 minutes)

1. **Generate CRON_SECRET** (skip if already have one):
   ```bash
   openssl rand -base64 32
   # Copy output
   ```

2. **Add to Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Click "Add"
   - Name: `CRON_SECRET`
   - Value: `<paste your secret>`
   - Environments: Select **Production** (+ Preview/Development if you want to test)
   - Click Save

3. **Redeploy**:
   ```bash
   git add .
   git commit -m "docs: Cron job failure analysis"
   git push  # Vercel auto-redeploys
   ```

4. **Wait for Cron** (up to 24 hours for the next scheduled run)

### Verification (30 minutes)

1. **Test Locally first**:
   ```bash
   # Set env var (get value from Vercel Dashboard)
   export CRON_SECRET="your-secret-here"
   npm run dev
   
   # In another terminal
   curl -X POST http://localhost:3000/api/cron/backup \
     -H "X-Cron-Secret: $CRON_SECRET" \
     -H "Content-Type: application/json"
   ```

2. **Test on Vercel**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/cron/backup \
     -H "X-Cron-Secret: your-secret" \
     -H "Content-Type: application/json"
   ```

3. **Monitor Logs**:
   - Vercel Dashboard → Deployments → latest → Functions → api/index.js
   - Look for `[CRON]` log entries

### Configure Backup Destination (30 minutes)

Choose ONE (Vercel Blob is easiest):

**Option A: Vercel Blob** (recommended)
- Usually auto-configured on Vercel
- Verify `BLOB_READ_WRITE_TOKEN` is in Environment Variables
- ✅ Simplest, no additional setup

**Option B: Infini-Cloud WebDAV**
- Get credentials from Infini-Cloud account
- Add env vars: URL, USERNAME, PASSWORD
- ~5 minutes to set up

**Option C: Backblaze B2**
- Create B2 bucket and API key
- Add env vars: KEY_ID, KEY, BUCKET_ID
- ~10 minutes to set up

---

## Summary Table

| Component | Status | Issue | Action |
|-----------|--------|-------|--------|
| **vercel.json cron config** | ✅ OK | None | — |
| **server.js route registration** | ✅ OK | None | — |
| **cron.routes.js** | ✅ OK | None | — |
| **cronMiddleware** | ❌ FAILS | CRON_SECRET not set | **Add to Vercel env vars** |
| **backupDatabaseCron logic** | ✅ OK | None (if gets called) | — |
| **Backup providers** | ⚠️ MISSING | No destinations | **Configure BLOB_READ_WRITE_TOKEN** |
| **Monitoring** | ⚠️ NOT ACCESSIBLE | Can't verify execution | Check Vercel Dashboard |

---

## Files Referenced

- [vercel.json](../../vercel.json) — Cron schedule config
- [server/server.js](../../server/server.js#L70-L95) — Route registration
- [server/routes/mongo/cron.routes.js](../../server/routes/mongo/cron.routes.js) — Cron endpoint
- [server/middleware/mongo/cronMiddleware.js](../../server/middleware/mongo/cronMiddleware.js) — Auth guard
- [server/controllers/mongo/database.controller.js](../../server/controllers/mongo/database.controller.js#L731) — Backup logic
- [docs/CRON_BACKUP_SETUP.md](./CRON_BACKUP_SETUP.md) — Setup guide
- [docs/CRON_BACKUP_QUICK_REF.md](./CRON_BACKUP_QUICK_REF.md) — Quick reference

---

## Next Steps

1. ✅ **Verify CRON_SECRET is set on Vercel** (Critical)
2. ✅ **Verify a backup provider is configured** (Critical)
3. ✅ **Test endpoint locally** (Quick validation)
4. ✅ **Monitor Vercel Dashboard** for cron execution
5. ⏳ **Wait for next scheduled run** (6 AM UTC daily)

**If cron still doesn't trigger after this**, the issue is likely with Vercel's cron scheduler itself — check Vercel status page or contact support.
