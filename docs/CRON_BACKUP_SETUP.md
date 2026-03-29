# Vercel Cron Job Setup for Daily Database Backups

## Overview

This document explains how the daily database backup system works on Vercel and how to configure it.

### The Problem

Your app is deployed on Vercel with strong security:
- ✅ **Token-based authentication** (accessToken, refreshToken in cookies)
- ✅ **CSRF protection** (token validation on state-changing requests)
- ✅ **Strict session management** (user context required)

However, **Vercel cron jobs are simple HTTP requests** — they cannot:
- ❌ Provide session cookies
- ❌ Generate or attach CSRF tokens
- ❌ Include user context (req.user)

**Result**: Regular API endpoints reject cron requests with `401 Unauthorized`.

---

## Solution: Header-Based Cron Authentication

Instead of session-based auth, cron requests use a **shared secret header**:

```
POST /api/cron/backup
X-Cron-Secret: <your-secret-value>
```

This approach:
✅ Bypasses user session requirements  
✅ Works across multiple cron invocations (no session state needed)  
✅ Cannot be intercepted by browsers (only sent from Vercel → your API)  
✅ Separate from user authentication (won't interfere with normal logins)

---

## Setup Instructions

### 1. Generate a Cron Secret

Create a secure random string to use as your cron secret:

```bash
# On Linux/Mac
openssl rand -base64 32

# Output example:
# AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/+
```

Keep this value private — treat it like a password.

---

### 2. Add to Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name**: `CRON_SECRET`
   - **Value**: `<paste-your-generated-secret>`
   - **Environments**: Select "Production" (and other envs if needed)
5. Click **Save**

**Important**: The cron secret is **NOT** exposed in your frontend code. It only exists on your Vercel backend.

---

### 3. Verify Backup Providers Are Configured

Before enabling the cron job, ensure **at least one backup destination** is set up:

```bash
# Check your Vercel environment variables:
✅ INFINI_CLOUD_WEBDAV_URL + USERNAME + PASSWORD
   OR
✅ BLOB_READ_WRITE_TOKEN (Vercel Blob)
   OR
✅ B2_APPLICATION_KEY_ID + B2_APPLICATION_KEY + B2_BUCKET_ID (Backblaze B2)
```

If no providers are configured, the cron job will execute but fail with HTTP 503.

See [../12-comprehensive-api-reference.md](../12-comprehensive-api-reference.md) for backup provider setup.

---

### 4. Deploy to Vercel

The cron job is already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule breakdown**:
- `0` = minute 0
- `2` = hour 2 (2 AM UTC)
- `*` = every day
- `*` = every month
- `*` = every day of the week

**To deploy**: Push your code to Git. Vercel automatically redeploys.

```bash
git add .
git commit -m "Add daily cron backup job"
git push
```

---

## How It Works

### Request Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Vercel Cron Job Scheduler (internal)                             │
│ Runs at 2 AM UTC daily                                           │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ├─ GET HTTP Headers:
       │  - Host: your-app.vercel.app
       │  - X-Cron-Secret: <CRON_SECRET env var>
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Your App (Vercel Serverless Functions)                           │
└──────┬───────────────────────────────────────────────────────────┘
       │
       ├─ server.js receives request at POST /api/cron/backup
       │
       ├─ cronMiddleware validates X-Cron-Secret header
       │  (matches against CRON_SECRET env var from Vercel)
       │
       ├─ backupDatabaseCron runs:
       │  1. Serializes all MongoDB collections as BSON
       │  2. Compresses with gzip
       │  3. Uploads to configured destinations in parallel:
       │     • Infini-Cloud WebDAV (if configured)
       │     • Vercel Blob (if configured)
       │     • Backblaze B2 (if configured)
       │
       ├─ Returns HTTP 200 (success) or 207 (partial) or 500 (failure)
       │
       └─ Vercel cron system logs the response
```

### Code Changes

**New Files**:
- `server/middleware/mongo/cronMiddleware.js` — Validates X-Cron-Secret header
- `server/routes/mongo/cron.routes.js` — Routes for cron jobs (only `/api/cron/backup` currently)

**Modified Files**:
- `server/controllers/mongo/database.controller.js` — Added `backupDatabaseCron()` function
- `server/server.js` — Registered cron routes (before CSRF middleware)
- `vercel.json` — Added cron job schedule

**Key Design Decision**: Cron routes are registered **before** CSRF middleware, so they bypass CSRF validation. This is intentional — CSRF protection is for browser-originated requests, and cron jobs don't have sessions.

---

## Monitoring & Debugging

### How to Check if Cron Jobs Are Running

1. Navigate to **Vercel Dashboard** → Your Project
2. Go to **Monitoring** → **Cron Jobs**
3. You'll see:
   - Last execution time
   - Execution status (success/failed)
   - Response logs

### Manual Testing (Before Relying on Cron)

Test the backup endpoint locally:

```bash
# Generate a test secret (use same one as CRON_SECRET)
TEST_SECRET="AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/+"

# Call the cron endpoint with proper header
curl -X POST http://localhost:3000/api/cron/backup \
  -H "X-Cron-Secret: $TEST_SECRET" \
  -H "Content-Type: application/json"
```

Expected success response:
```json
{
  "success": true,
  "message": "Cron backup uploaded successfully to Vercel Blob and Infini-Cloud WebDAV.",
  "fileName": "mongodb-backup-2026-03-29T023000.001Z.bson.gz",
  "sizeBytes": 12456789,
  "collections": 45,
  "generatedAt": "2026-03-29T02:30:00.001Z",
  "destinations": {
    "infiniCloud": { "status": "success", "url": "..." },
    "vercelBlob": { "status": "success", "url": "..." },
    "backblazeB2": { "status": "success", "url": "https://f001.backblazeb2.com/..." }
  }
}
```

### Common Issues

#### Issue 1: "Cron jobs are not configured"
**Symptom**: HTTP 503 with message about CRON_SECRET not being set.  
**Fix**: Ensure `CRON_SECRET` is added to Vercel Environment Variables.

#### Issue 2: "Invalid cron secret"
**Symptom**: HTTP 403 Forbidden.  
**Fix**: The `X-Cron-Secret` header doesn't match your `CRON_SECRET` env var.

#### Issue 3: "No backup providers are configured"
**Symptom**: HTTP 503 with message about missing env vars.  
**Fix**: Configure at least one backup destination:
- Set `INFINI_CLOUD_WEBDAV_*` vars for WebDAV, OR
- Set `BLOB_READ_WRITE_TOKEN` for Vercel Blob, OR
- Set `B2_*` vars for Backblaze B2

#### Issue 4: "All backup destinations failed"
**Symptom**: HTTP 500 with details about each failure.  
**Fix**: Check individual destination errors:
- **Infini-Cloud**: Verify username, password, and URL
- **Vercel Blob**: Check if `BLOB_READ_WRITE_TOKEN` is valid
- **Backblaze B2**: Verify key ID, app key, and bucket ID match your B2 account

---

## Changing the Backup Schedule

Edit `vercel.json` and update the `schedule` field:

```json
"schedule": "0 3 * * 0"    // Weekly: Every Sunday at 3 AM UTC
"schedule": "0 */4 * * *"  // Every 4 hours
"schedule": "30 1 * * *"   // Daily at 1:30 AM UTC
```

Cron format: `(minute) (hour) (day-of-month) (month) (day-of-week)`

Deploy with:
```bash
git add vercel.json
git commit -m "Change backup schedule to every 4 hours"
git push
```

---

## Security Considerations

1. **CRON_SECRET is private**: Only set on Vercel backend, never exposed in frontend
2. **Header validation**: X-Cron-Secret is checked on every request
3. **No session required**: Cron auth is completely separate from user authentication
4. **Audit logs**: All cron executions are logged in Vercel monitoring and browser console
5. **Rate limiting**: Vercel limits cron job frequency — no risk of accidental DoS

---

## Manual Backup (Without Cron)

You can still trigger backups manually via the admin UI:

```
POST /api/admin/database/backup
(requires user session + CSRF token)
```

This is useful for:
- Testing backup before relying on cron
- Triggering backups on-demand
- Verifying all providers are working

---

## Summary

| Component | Purpose | Auth Method |
|-----------|---------|-------------|
| Regular API endpoints | User-facing operations | Session cookies + CSRF tokens |
| `/api/cron/backup` | Scheduled daily backups | X-Cron-Secret header |
| Vercel Cron Scheduler | Triggers `/api/cron/backup` | Internal (injects CRON_SECRET header) |
| Backup destinations | Store backup files | Provider-specific (WebDAV, Blob, B2) |

---

## Next Steps

1. ✅ Generate CRON_SECRET: `openssl rand -base64 32`
2. ✅ Add to Vercel: Settings → Environment Variables → CRON_SECRET
3. ✅ Verify backup providers are configured
4. ✅ Deploy: `git push` (vercel.json already has cron config)
5. ✅ Monitor: Vercel Dashboard → Monitoring → Cron Jobs

Your daily backups will now run automatically at **2 AM UTC** every day! 🎉
