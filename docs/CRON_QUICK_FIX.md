# Vercel Cron Job Fix Checklist

**Problem**: Cron job at `/api/cron/backup` (scheduled for 6 AM UTC daily) is not triggering or is silently failing.  
**Root Cause**: `CRON_SECRET` environment variable is not set on Vercel.

---

## ✅ Quick Fix (5-10 minutes)

### Step 1: Generate Secret
```bash
openssl rand -base64 32
# Copy the output (e.g., "AbCdEfGhIjKlMnOpQrStUvWxYz+/1234567890...")
```

### Step 2: Add to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Click **Add Name and Value**
   - Name: `CRON_SECRET`
   - Value: `<paste your secret from Step 1>`
   - Environments: **Production** ✓ (check this)
5. Click **Save**

### Step 3: Redeploy
```bash
git add .
git commit -m "chore: Enable cron job by setting CRON_SECRET"
git push origin main  # or your main branch
```

**Done!** Cron will run at next scheduled time (6 AM UTC daily).

---

## ✅ Verification (5 minutes)

### Test Locally First
```bash
# Get your CRON_SECRET from Vercel Dashboard
export CRON_SECRET="your-secret-here"

# Start server
npm run dev

# In another terminal, test the endpoint
curl -X POST http://localhost:3000/api/cron/backup \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected**: Should return `HTTP 200-207` with success message (or 503 if no backup provider configured).

### Test on Vercel
```bash
curl -X POST https://your-app.vercel.app/api/cron/backup \
  -H "X-Cron-Secret: your-secret-here" \
  -H "Content-Type: application/json"
```

### Check Vercel Logs
1. Vercel Dashboard → Deployments → Latest
2. Click tab: **Functions**
3. Click: `api/index.js` → **Logs**
4. Search for: `[CRON]`
5. Should see recent execution logs

---

## ⚠️ Configure Backup Provider (Optional but Recommended)

If you want backups to actually SAVE somewhere, configure at least one provider:

### Option A: Vercel Blob (Easiest ⭐)
Already available on Vercel (automatic). Just verify it's set:
- Vercel Dashboard → Environment Variables
- Look for: `BLOB_READ_WRITE_TOKEN`
- Should have a value (set automatically by Vercel)
- Done! ✅

### Option B: Infini-Cloud WebDAV
1. Sign up at [Infini-Cloud](https://infini-cloud.com)
2. Get your WebDAV credentials
3. Vercel Dashboard → Environment Variables → Add:
   - `INFINI_CLOUD_WEBDAV_URL` = `https://your-account.infini-cloud.net/dav`
   - `INFINI_CLOUD_WEBDAV_USERNAME` = Your username
   - `INFINI_CLOUD_WEBDAV_PASSWORD` = Your password
4. Redeploy: `git push`

### Option C: Backblaze B2
1. Create B2 account and bucket
2. Generate API key
3. Vercel Dashboard → Environment Variables → Add:
   - `B2_APPLICATION_KEY_ID` = Your key ID
   - `B2_APPLICATION_KEY` = Your app key
   - `B2_BUCKET_ID` = Your bucket ID
4. Redeploy: `git push`

---

## 🔍 Verification Script

Save this as `test-cron.sh`:

```bash
#!/bin/bash

# Get your values
VERCEL_URL="https://your-app.vercel.app"
CRON_SECRET="your-cron-secret"

echo "Testing Cron Job Endpoint..."
echo "URL: $VERCEL_URL/api/cron/backup"
echo ""

# Make request
RESPONSE=$(curl -s -X POST "$VERCEL_URL/api/cron/backup" \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

# Extract body and status
BODY=$(echo "$RESPONSE" | head -n-1)
STATUS=$(echo "$RESPONSE" | tail -n1)

echo "Status Code: $STATUS"
echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

# Interpret
echo ""
case $STATUS in
  200|207)
    echo "✅ SUCCESS: Cron job executed!"
    ;;
  503)
    echo "⚠️  ISSUE: Check if CRON_SECRET is set or if backup providers are configured"
    ;;
  401|403)
    echo "❌ AUTH FAILED: X-Cron-Secret header is incorrect"
    ;;
  *)
    echo "❓ UNKNOWN: Status code $STATUS"
    ;;
esac
```

Run it:
```bash
chmod +x test-cron.sh
./test-cron.sh
```

---

## 📋 Verification Checklist

After applying the fix, verify:

- [ ] CRON_SECRET is set in Vercel Dashboard (Settings → Environment Variables)
- [ ] Latest deployment is live (check Deployments page)
- [ ] Manual test returns HTTP 200-207 (not 503 or 401)
- [ ] At least one backup provider is configured:
  - [ ] BLOB_READ_WRITE_TOKEN exists, OR
  - [ ] INFINI_CLOUD_WEBDAV_* env vars set, OR
  - [ ] B2_APPLICATION_KEY_ID + B2_APPLICATION_KEY + B2_BUCKET_ID set
- [ ] Vercel logs show `[CRON]` entries
- [ ] Cron Dashboard shows recent executions (Monitoring → Cron Jobs)

---

## 🆘 If It Still Doesn't Work

### 1. Verify Config Files Are Correct

Check that [vercel.json](../vercel.json) has:
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

Check that [server/server.js](../../server/server.js#L73) has:
```javascript
app.use('/api/cron', cronRoutes);  // Before CSRF middleware
```

### 2. Check Diagnostics

Check [cronMiddleware.js](../../server/middleware/mongo/cronMiddleware.js):
```javascript
// Should return 503 if CRON_SECRET not set
if (!CRON_SECRET) {
  return res.status(503).json({
    error: 'Cron jobs are not configured on this server. Set CRON_SECRET env var.'
  });
}
```

### 3. Contact Vercel Support

If manual test works but scheduled cron doesn't run:
- Go to [Vercel Support](https://vercel.com/support)
- Check your project's cron job configuration is enabled
- Ask about cron job logs and monitoring

---

## 📚 Related Documentation

- [CRON_BACKUP_SETUP.md](./CRON_BACKUP_SETUP.md) — Full setup guide
- [CRON_BACKUP_QUICK_REF.md](./CRON_BACKUP_QUICK_REF.md) — Quick reference
- [CRON_BACKUP_ARCHITECTURE.md](./CRON_BACKUP_ARCHITECTURE.md) — Technical architecture
- [CRON_JOB_FAILURE_ANALYSIS.md](./CRON_JOB_FAILURE_ANALYSIS.md) — Detailed analysis (this file explains everything)

---

## Timeline

1. **Now**: Add CRON_SECRET to Vercel (5 min)
2. **Now +5 min**: Test locally and on Vercel (5 min)
3. **Now +10 min**: Redeploy (1 min)
4. **Now +1 hour**: Check Vercel logs for `[CRON]` entries
5. **Tomorrow 6 AM UTC**: Cron job should execute automatically
6. **Tomorrow 6:15 AM UTC**: Check Vercel Monitoring → Cron Jobs for results

---

## Questions?

Refer to [CRON_JOB_FAILURE_ANALYSIS.md](./CRON_JOB_FAILURE_ANALYSIS.md) for:
- Complete process flow diagram
- Guard-by-guard authentication checks
- Possible failure scenarios and responses
- Root cause analysis
- Detailed troubleshooting guide
