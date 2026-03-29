# Cron Backup System Architecture

## How Your App Security Works (Before)

```
┌─────────────────────────────────────┐
│   User Browser                      │
│   ✅ Cookies (session tokens)       │
│   ✅ CSRF token (per-session)       │
└────────────┬────────────────────────┘
             │
             ├─► POST /api/admin/database/backup
             │   + Request Headers:
             │     - Cookie: accessToken=...
             │     - Cookie: refreshToken=...
             │     - X-CSRF-Token: ...
             │
             ▼
┌─────────────────────────────────────┐
│   Your API (server.js)              │
├─────────────────────────────────────┤
│  1. authMiddleware                  │
│     ✅ Validates accessToken        │
│     ✅ Checks user role (super_admin)
│  2. csrfValidateToken               │
│     ✅ Verifies CSRF token          │
│  3. backupDatabase()                │
│     ✅ Runs backup                  │
│     ✅ Uploads to destinations      │
└─────────────────────────────────────┘
         ▼
      ✅ Backup succeeds
```

## The Cron Problem

```
┌─────────────────────────────────────┐
│  Vercel Cron Scheduler              │
│  (Just an HTTP request, no browser) │
│  ❌ No cookies                      │
│  ❌ No CSRF token                   │
│  ❌ No user context                 │
└────────────┬────────────────────────┘
             │
             ├─► POST /api/admin/database/backup
             │   (has NO auth headers)
             │
             ▼
┌─────────────────────────────────────┐
│   Your API (server.js)              │
├─────────────────────────────────────┤
│  1. authMiddleware                  │
│     ❌ No accessToken in cookies    │
│     ❌ Returns 401 Unauthorized     │
│                                     │
│  Backup BLOCKED ❌                  │
│                                     │
└─────────────────────────────────────┘

Result: Cron job fails every day! 💥
```

## The Solution: Header-Based Cron Auth

```
┌──────────────────────────────────────────┐
│  Vercel Cron Scheduler (at 2 AM UTC)     │
│  Remember: CRON_SECRET = <env var>       │
└────────────┬─────────────────────────────┘
             │
             ├─► POST /api/cron/backup
             │   + Request Headers:
             │     - X-Cron-Secret: <CRON_SECRET>
             │
             ▼
┌──────────────────────────────────────────┐
│   Your API (server.js)                   │
├──────────────────────────────────────────┤
│  ⭐ NEW: cronMiddleware                  │
│     ✅ Extracts X-Cron-Secret header     │
│     ✅ Validates: header === CRON_SECRET │
│     ✅ Sets req.isCronJob = true         │
│  ✅ SKIPPED: authMiddleware              │
│     (no user session needed)             │
│  ✅ SKIPPED: csrfValidateToken           │
│     (header auth, not browser session)   │
│  ⭐ NEW: backupDatabaseCron()            │
│     ✅ Runs backup                       │
│     ✅ Uploads to destinations           │
└──────────────────────────────────────────┘
             │
             ├─► Infini-Cloud WebDAV (PUT)
             ├─► Vercel Blob (POST)
             └─► Backblaze B2 (upload flow)
             │
             ▼
          ✅ All backups succeed!
```

## Middleware Execution Order

```
Browser Request                    Cron Request
    │                                  │
    ├─► express.json()                 ├─► express.json()
    ├─► cookieParser()                 ├─► cookieParser()
    ├─► sanitizer                      ├─► sanitizer
    ├─► morgan                         ├─► morgan
    ├─► securityMiddleware             ├─► securityMiddleware
    │                                  │
    ├─► csrfGenerateToken       ❌     ├─► ⭐ cronMiddleware
    │   (user needs token)             │   (validates X-Cron-Secret)
    │                                  │
    ├─► csrfValidateToken       ❌     ❌   (skipped for /api/cron/*)
    │   (validates CSRF token)         │
    │                                  │
    ├─► authMiddleware           ✅    ❌   (not needed, cron has header)
    │   (validates session)            │
    │                                  │
    ├─► Route Handler            ✅    ├─► Route Handler
    │   (backupDatabase)               │   (backupDatabaseCron)
    │                                  │
    ▼                                  ▼
  Response                          Response

Key Difference:
- Browser: Session + CSRF
- Cron: Header (X-Cron-Secret)
```

## Request/Response Examples

### Successful Cron Request

```http
POST /api/cron/backup HTTP/1.1
Host: myapp.vercel.app
X-Cron-Secret: AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/+
User-Agent: Vercel Cron Scheduler

HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Cron backup uploaded successfully to Vercel Blob and Infini-Cloud.",
  "fileName": "mongodb-backup-2026-03-29T021234Z.bson.gz",
  "sizeBytes": 45678901,
  "collections": 28,
  "generatedAt": "2026-03-29T02:12:34.567Z",
  "destinations": {
    "infiniCloud": {
      "status": "success",
      "provider": "Infini-Cloud WebDAV",
      "url": "https://yourcloud.net/dav/backups/mongodb-backup-..."
    },
    "vercelBlob": {
      "status": "success",
      "provider": "Vercel Blob",
      "url": "https://your-blob-store.vercel-storage.com/..."
    },
    "backblazeB2": {
      "status": "skipped",
      "provider": "Backblaze B2",
      "reason": "Not configured"
    }
  }
}
```

### Failed Cron Request (Wrong Secret)

```http
POST /api/cron/backup HTTP/1.1
Host: myapp.vercel.app
X-Cron-Secret: WrongSecret123
User-Agent: Vercel Cron Scheduler

HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "success": false,
  "error": "Invalid cron secret"
}
```

### Failed Cron Request (No Secret)

```http
POST /api/cron/backup HTTP/1.1
Host: myapp.vercel.app
User-Agent: Vercel Cron Scheduler

HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "error": "X-Cron-Secret header is required"
}
```

## Security Model

```
┌─────────────────────────────────────────────────────┐
│         Your App's Security Defense Layers          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔓 LAYER 1: Network Isolation (Vercel)            │
│    └─ Vercel controls cron job injection           │
│    └─ Only Vercel injects X-Cron-Secret            │
│    └─ Attacker cannot guess secret (random, 32b)   │
│                                                     │
│  🔐 LAYER 2: Header Validation (cronMiddleware)    │
│    └─ Verify: header === CRON_SECRET               │
│    └─ Constant-time comparison (prevents timing)   │
│    └─ Reject if missing or mismatched              │
│                                                     │
│  🔐 LAYER 3: Separate Auth Mechanism               │
│    └─ Cron auth completely separate from users     │
│    └─ No user context needed (no token conflicts)  │
│    └─ Bypass is intentional (not a vulnerability)  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Environment Variables

```
Vercel Deployment
├─ CRON_SECRET (new) ⭐
│  └─ Secret for X-Cron-Secret header validation
│  └─ Generated by you (openssl rand -base64 32)
│  └─ Only for cron authentication
│
├─ Existing Backup Providers ✅
│  ├─ INFINI_CLOUD_WEBDAV_URL
│  ├─ INFINI_CLOUD_WEBDAV_USERNAME
│  ├─ INFINI_CLOUD_WEBDAV_PASSWORD
│  ├─ BLOB_READ_WRITE_TOKEN
│  ├─ B2_APPLICATION_KEY_ID
│  ├─ B2_APPLICATION_KEY
│  └─ B2_BUCKET_ID
│
└─ Standard Node Vars ✅
   ├─ NODE_ENV = production
   ├─ MONGODB_URI
   └─ ... (all existing vars)
```

## Timeline: Daily Backup

```
Day 1
└─ 2:00 AM UTC: Cron scheduler triggers
   └─ POST /api/cron/backup + X-Cron-Secret header
   └─ cronMiddleware validates secret ✅
   └─ backupDatabaseCron() runs
   └─ BSON serialization (28 collections, ~46MB)
   └─ Gzip compression (~5MB)
   └─ Parallel upload to 2 destinations
      ├─ Infini-Cloud: 5 sec ✅
      └─ Vercel Blob: 3 sec ✅
   └─ HTTP 200 response
   └─ Logged in Vercel Cron monitoring
   └─ Local logs in server console

Day 2
└─ 2:00 AM UTC: Repeat (automatic)

Day 3
└─ 2:00 AM UTC: Repeat (automatic)
   ...continues daily
```

## Comparison: Before vs After

| Aspect | Before Cron | After Cron |
|--------|------------|-----------|
| **Manual Backup** | Admin UI → POST with session | Still works ✅ |
| **Automatic Backup** | None (manual only) | Daily at 2 AM UTC ✅ |
| **Schedule Change** | N/A | Edit vercel.json, redeploy |
| **Monitoring** | Manual checks | Vercel Cron monitoring |
| **Auth Method** | User session + CSRF | X-Cron-Secret header |
| **Destinations** | Infini-Cloud, Blob, B2 | Same (no change) |
| **Encryption** | BSON + gzip (same) | Same (no change) |

---

**Result**: Daily automated backups without any code in your database! 🎉
