# Cron Backup Quick Reference

## The Problem You Had
Your Vercel app is protected by:
- ✅ Token-based auth (session cookies)
- ✅ CSRF validation (prevents state-changing requests from non-browsers)

But **Vercel cron jobs are HTTP requests that can't provide**:
- ❌ Session cookies
- ❌ CSRF tokens
- ❌ User context

Regular backup endpoint would reject them with `401 Unauthorized`.

---

## The Solution Implemented

### 1. **Header-Based Cron Authentication**
   - Cron requests include: `X-Cron-Secret: <your-secret>`
   - Server validates this header instead of requiring session
   - No CSRF check needed (header auth, not browser form)

### 2. **New Middleware** 
   - `server/middleware/mongo/cronMiddleware.js` — Validates X-Cron-Secret

### 3. **Separate Cron Endpoints**
   - `server/routes/mongo/cron.routes.js` — Cron-specific routes
   - `POST /api/cron/backup` — Daily backup endpoint

### 4. **Cron-Aware Controller**
   - `backupDatabaseCron()` in database.controller.js — Same logic as regular backup, no role check

### 5. **Vercel Configuration**
   - `vercel.json` — Added crons section with daily schedule (2 AM UTC)

---

## Quick Setup

### Step 1: Create Secret
```bash
openssl rand -base64 32
# Copy the output
```

### Step 2: Add to Vercel
Vercel Dashboard → Settings → Environment Variables
- Name: `CRON_SECRET`
- Value: <paste your secret>
- Environments: Production

### Step 3: Deploy
```bash
git push
```

**That's it!** ✅

---

## Testing

```bash
# Local test (requires CRON_SECRET env var set)
curl -X POST http://localhost:3000/api/cron/backup \
  -H "X-Cron-Secret: <your-secret>" \
  -H "Content-Type: application/json"
```

---

## Architecture Diagram

```
Vercel Cron Job (2 AM UTC)
    ↓
POST /api/cron/backup
+ X-Cron-Secret: <secret>
    ↓
cronMiddleware validates secret
    ↓
backupDatabaseCron() runs
    ↓
Serialize MongoDB → BSON → gzip
    ↓
Upload in parallel to:
├── Infini-Cloud WebDAV
├── Vercel Blob
└── Backblaze B2
    ↓
Return 200 (success) / 207 (partial) / 500 (failed)
```

---

## Important Notes

- ✅ Cron routes registered BEFORE CSRF middleware (cron doesn't need CSRF)
- ✅ Cron secret is only on Vercel backend (not exposed in frontend)
- ✅ Same backup logic as manual endpoint (just different auth)
- ✅ Fully isolated from user authentication system
- ✅ Each backup destination runs in parallel, failures don't block others

---

## Files Changed/Created

**Created**:
- `server/middleware/mongo/cronMiddleware.js`
- `server/routes/mongo/cron.routes.js`
- `docs/CRON_BACKUP_SETUP.md` (full guide)

**Modified**:
- `server/controllers/mongo/database.controller.js` (added `backupDatabaseCron`)
- `server/server.js` (imported cron routes, registered before CSRF)
- `vercel.json` (added crons section)

---

## Monitoring

Vercel Dashboard → Monitoring → Cron Jobs

You'll see:
- Last execution time
- Success/failure status
- Response logs
- Execution duration

---

## Schedule Syntax (cron format)

Change `vercel.json`:
```json
"schedule": "0 2 * * *"      // Daily 2 AM UTC (DEFAULT)
"schedule": "0 3 * * 0"      // Weekly Sunday 3 AM UTC
"schedule": "0 */4 * * *"    // Every 4 hours
"schedule": "30 1 * * *"     // Daily 1:30 AM UTC
```

Minute | Hour | Day | Month | DayOfWeek
--- | --- | --- | --- | ---
0-59 | 0-23 | 1-31 | 1-12 | 0-6 (0=Sun)

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 503 "Cron jobs not configured" | CRON_SECRET not set | Add to Vercel env vars |
| 403 "Invalid cron secret" | Header doesn't match env var | Check secret was copied correctly |
| 503 "No backup providers" | No dest. configured | Set WebDAV / Blob / B2 env vars |
| 500 "All destinations failed" | Provider auth failed | Check provider credentials |
| Cron never runs | Schedule wrong | Check `vercel.json` syntax, redeploy |

---

## Manual Backup Still Works

Regular endpoint still available for admins:
```
POST /api/admin/database/backup
(requires user session + CSRF)
```

Use this to test before trusting cron, or for on-demand backups.

---

**Status**: ✅ Ready to use!  
**Next**: Generate secret → Add to Vercel → Deploy → Monitor
