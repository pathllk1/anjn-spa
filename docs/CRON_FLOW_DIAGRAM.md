# Cron Job Flow Diagram & Decision Tree

## Complete Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VERCEL CRON SCHEDULER (6 AM UTC daily)                                  │
│ Reads vercel.json: path=/api/cron/backup, schedule=0 6 * * *            │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      │ Vercel sends HTTP POST request
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ HTTP REQUEST ARRIVES AT YOUR APP                                         │
│ POST /api/cron/backup                                                   │
│ Headers:                                                                │
│   - X-Cron-Secret: <CRON_SECRET env var>                               │
│   - Host: your-app.vercel.app                                          │
│   - Content-Type: application/json                                     │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ EXPRESS SERVER (server.js)                                              │
│ Request enters middleware stack                                         │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────────────────┐
        │ Middleware Stack (in order):                    │
        │ 1. express.json()                               │
        │ 2. securityMiddleware                           │
        │ 3. **cronMiddleware** ⭐                         │
        │ → app.use('/api/cron', cronRoutes)              │
        │ 4. csrfGenerateToken (SKIPPED for /api/cron)    │
        │ 5. csrfValidateToken (SKIPPED for /api/cron)    │
        └──────────────────┬──────────────────────────────┘
                           │
                           ▼
            ┌──────────────────────────────────────────────┐
            │ CRONMIDDLEWARE VALIDATION                   │
            │ (server/middleware/mongo/cronMiddleware.js) │
            └──────────────────┬───────────────────────────┘
                               │
         ┌─────────────────────┴──────────────────────┐
         │                                            │
    GUARD 1                                       GUARD 1
   Check: Does                                   Check: Does
   CRON_SECRET                                   CRON_SECRET
   env var exist?                                env var exist?
         │                                            │
         ▼ YES                                        ▼ NO ❌
    ┌────────────┐                             ┌──────────────┐
    │ Continue   │                             │ BLOCK ❌     │
    │ to GUARD 2 │                             ├──────────────┤
    └─────┬──────┘                             │ HTTP 503     │
          │                                    │ Error:       │
          ▼                                    │ "Cron jobs   │
   ┌─────────────────────────────────────────┐│ not          │
   │ GUARD 2: Check header present          ││ configured"  │
   │ Extract: X-Cron-Secret header value    ││ ❌ FAILED    │
   └───────────┬─────────────────────────────┘│            │
               │                               └──────────────┘
     ┌─────────┴──────────────┐
     │                        │
   YES                       NO ❌
   Has                     Missing
   Header                  Header
     │                        │
     ▼                        ▼
┌────────────────┐     ┌────────────────┐
│ Continue to    │     │ BLOCK ❌       │
│ GUARD 3        │     ├────────────────┤
└────┬───────────┘     │ HTTP 401       │
     │                 │ Error: Header  │
     ▼                 │ required       │
┌──────────────────────┤❌ FAILED       │
│ GUARD 3: Validate    │                │
│ header === env var   │└────────────────┘
│ (constant-time       │
│  comparison)         │
└───────┬──────────────┘
        │
  ┌─────┴─────┐
  │           │
MATCH      MISMATCH ❌
(OK)       (Invalid)
  │           │
  ▼           ▼
┌────────┐ ┌──────────────┐
│ PASS ✅│ │ BLOCK ❌     │
└────┬───┘ ├──────────────┤
     │     │ HTTP 403     │
     │     │ Error:       │
     │     │ Invalid      │
     │     │ secret       │
     │     │ ❌ FAILED    │
     │     └──────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ req.isCronJob = true                         │
│ Call: next() → cron.routes.js                │
└─────────────────────┬────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────┐
        │ CRON ROUTE HANDLER              │
        │ /api/cron/backup (POST)         │
        │ server/routes/mongo/cron.routes.js
        └──────────────┬────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Call: backupDatabaseCron()        │
        │ From: database.controller.js     │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ BACKUP CONTROLLER EXECUTION      │
        │ (database.controller.js:731)     │
        └──────────────┬───────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
    STEP 1                        STEP 1
  Check: Is DB                  Check: Is DB
  connection                    connection
    ready?                        ready?
        │                             │
      YES ✅                         NO ❌
        │                             │
        ▼                             ▼
  Continue                    ┌──────────────┐
  to STEP 2                   │ Return:      │
        │                     │ HTTP 503     │
        ▼                     │ "Database    │
┌─────────────────────────────│ not ready"   │
│ STEP 2: Serialize           │ ❌ FAILED    │
│ All MongoDB collections     │              │
│ to BSON format              └──────────────┘
│ • List collections
│ • For each: serialize docs
│ • Create header/footer docs
└──────────────┬──────────────┘
               │
               ▼
        ┌───────────────┐
        │ STEP 3:       │
        │ Compress BSON │
        │ with gzip     │
        └───────┬───────┘
                │
                ▼
      ┌─────────────────────────┐
      │ STEP 4: Check Providers │
      │ Is ≥1 provider          │
      │ configured?             │
      └──────┬────────┬────────┬─┘
             │        │        │
      ┌──────┘        │        └──────┐
      │               │               │
    Check:          Check:          Check:
  INFINI_     BLOB_READ_       B2_APPLICATION_
  CLOUD_*     WRITE_TOKEN      KEY_ID + others
      │               │               │
      ▼               ▼               ▼
  Enabled?        Enabled?        Enabled?
      │               │               │
 YES/NO           YES/NO           YES/NO
      │               │               │
      └───────┬───────┴───────┬───────┘
              │
        ALL NO ❌
              │
              ▼
      ┌──────────────────────┐
      │ Return:              │
      │ HTTP 503             │
      │ "No backup           │
      │ providers            │
      │ configured"          │
      │ ❌ FAILED            │
      └──────────────────────┘
              │
        ≥1 YES ✅
              │
              ▼
      ┌──────────────────────────────┐
      │ STEP 5: Upload in Parallel   │
      │ Promise.allSettled([         │
      │   uploadToInfiniCloud(),     │
      │   uploadToVercelBlob(),      │
      │   uploadToBackblazeB2()      │
      │ ])                           │
      │                              │
      │ All runs to completion:      │
      │ • Can't short-circuit        │
      │ • Can't interfere w/ each    │
      │ • Each has own error handler │
      └──────────────┬───────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ALL SUCCEED              ≥1 FAILED
         │ ✅                    │ ⚠️
         ▼                       ▼
     ┌─────────┐         ┌──────────────┐
     │ HTTP 200│         │ HTTP 207     │
     │ Success │         │ Multi-Status │
     │         │         │ (partial)    │
     └─────────┘         └──────────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
            ┌───────────────────────────┐
            │ Return JSON Response:     │
            │ {                         │
            │   success: true,          │
            │   message: "...",         │
            │   fileName: "...",        │
            │   sizeBytes: 12345,       │
            │   collections: 15,        │
            │   destinations: {         │
            │     infiniCloud: {...},   │
            │     vercelBlob: {...},    │
            │     backblazeB2: {...}    │
            │   }                       │
            │ }                         │
            └───────────────────────────┘
                     │
                     ▼
            ┌───────────────────────────┐
            │ VERCEL LOGS RESPONSE      │
            │ • Status code (200/207)   │
            │ • Response body           │
            │ • Execution duration      │
            └───────────────────────────┘
                     │
                     ▼
            ┌───────────────────────────┐
            │ CRON JOB COMPLETES        │
            │ Vercel marks as:          │
            │ • Success (200/207)       │
            │ • Failed (500+)           │
            └───────────────────────────┘
```

---

## Authentication Guard Decision Tree

```
                    ┌─ Cron Request Arrives
                    │
                    ▼
         ┌──────────────────────────────┐
         │ Does CRON_SECRET env var     │
         │ exist on this server?        │
         └──────┬──────────────────────┬┘
              NO│                     │YES
                ▼                     ▼
         ┌────────────┐      ┌──────────────────────┐
         │REJECT 503  │      │Look for header:      │
         │"not        │      │X-Cron-Secret        │
         │configured" │      └──────┬──────────────┬┘
         └────┬───────┘          NO │              │ YES
              │                     │              │
              ▼                     ▼              ▼
           ❌                ┌──────────────┐   ┌────────────────┐
           END             │REJECT 401    │   │Compare:        │
                           │"header       │   │header value    │
                           │required"     │   │=== CRON_SECRET │
                           └───┬──────────┘   └──────┬─────────┬┘
                               │                   NO├Match?  │YES
                               ▼                     ▼         ▼
                             ❌                   ┌────────┐ ┌──────┐
                             END                 │REJECT  │ │PASS ✅│
                                                 │403     │ │Call  │
                                                 │Invalid │ │next()│
                                                 └────────┘ └──────┘
                                                    ▼         ▼
                                                  ❌        ✅
                                                  END      backupDatabaseCron()
```

---

## Provider Configuration Decision Tree

```
                    ┌─ In backupDatabaseCron()
                    │
                    ▼
         Is INFINI_CLOUD_WEBDAV_URL set?  (AND USERNAME, PASSWORD)
         ├─ YES → Add to enabled providers
         └─ NO  → Skip (skip reason: missing env vars)
                    │
                    ▼
         Is BLOB_READ_WRITE_TOKEN set?
         ├─ YES → Add to enabled providers
         └─ NO  → Skip (skip reason: not configured)
                    │
                    ▼
         Is B2_APPLICATION_KEY_ID set?  (AND KEY, BUCKET_ID)
         ├─ YES → Add to enabled providers
         └─ NO  → Skip (skip reason: missing env vars)
                    │
                    ▼
         Count = number of enabled providers
                    │
        ┌───────────┴───────────┐
        │                       │
      Count                   Count
        = 0                     ≥ 1
        │                       │
        ▼                       ▼
   ┌─────────┐         ┌──────────────────┐
   │Return   │         │Proceed to upload │
   │HTTP 503 │         │Promise.allSettled│
   │No       │         │([...])           │
   │providers│         └──────┬───────────┘
   │         │                │
   └────────┬┘         ┌──────┴──────┐
        ❌ │           │             │
          │       SUCCESS        FAILURE
          │      (or partial)       │
          │       ✅/⚠️            │
          │                        ▼
          │                   ┌──────────────┐
          │                   │Return HTTP   │
          │                   │500 "All      │
          │                   │failed"       │
          │                   └──────┬───────┘
          │                         ❌
          ▼                         ▼
         END                      END
```

---

## HTTP Response Matrix

| Condition | HTTP | JSON.success | Notes |
|-----------|------|--------------|-------|
| All providers upload successfully | **200** | `true` | ✅ Perfect |
| ≥1 succeeds, ≥1 fails | **207** | `true` | ⚠️ Partial success |
| All enabled providers fail | **500** | `false` | ❌ Complete failure |
| No providers configured | **503** | `false` | ⚠️ Configuration issue |
| DB connection not ready | **503** | `false` | ⚠️ Transient issue |
| CRON_SECRET not set | **503** | `false` | ❌ Auth not configured |
| X-Cron-Secret header missing | **401** | `false` | ❌ Request malformed |
| X-Cron-Secret invalid | **403** | `false` | ❌ Auth failed |

---

## Failure Scenario Examples

### Scenario 1: CRON_SECRET Not Set (Most Common)
```
Request:  POST /api/cron/backup + X-Cron-Secret: <secret>
     ↓
cronMiddleware checks: process.env.CRON_SECRET exists?
     ↓
NO ❌
     ↓
Returns: HTTP 503 "Cron jobs are not configured"
     ↓
Cron JOB FAILS
```

**Fix**: Add CRON_SECRET to Vercel environment variables

---

### Scenario 2: CRON_SECRET Set, But No Providers Configured
```
Request:  POST /api/cron/backup + X-Cron-Secret: <secret>
     ↓
cronMiddleware validates secret ✅
     ↓
Call backupDatabaseCron()
     ↓
Check providers: BLOB_READ_WRITE_TOKEN? No
                 INFINI_CLOUD_*? No
                 B2_*? No
     ↓
Returns: HTTP 503 "No backup providers configured"
     ↓
Cron authenticates but BACKUP FAILS
```

**Fix**: Set BLOB_READ_WRITE_TOKEN or other provider env vars

---

### Scenario 3: Successful Backup
```
Request:  POST /api/cron/backup + X-Cron-Secret: <secret>
     ↓
cronMiddleware validates secret ✅
     ↓
Call backupDatabaseCron()
     ↓
Serialize collections to BSON ✅
Compress with gzip ✅
Check providers:
  • BLOB_READ_WRITE_TOKEN? YES ✅
  • INFINI_CLOUD_*? NO (skip)
  • B2_*? NO (skip)
     ↓
Upload to Vercel Blob ✅
     ↓
Returns: HTTP 200 "Cron backup uploaded successfully to Vercel Blob"
     ↓
Cron JOB SUCCEEDS ✅
```

**No action needed** — cron is working!

---

## Summary

**To Make Cron Work**:
1. ✅ Set `CRON_SECRET` in Vercel environment variables
2. ✅ Verify `BLOB_READ_WRITE_TOKEN` is set (or other provider)
3. ✅ Redeploy: `git push`
4. ✅ Test: `curl -X POST ... -H "X-Cron-Secret: ..."`
5. ✅ Monitor: Vercel Dashboard → Cron Jobs
6. ✅ Wait: Next scheduled run at 6 AM UTC

**If it still doesn't work**, follow the decision trees above to identify exactly which guard is failing.
