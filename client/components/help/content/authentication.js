export const content = `
<h3 class="text-lg font-bold text-gray-900 mb-4">Authentication & Authorization System</h3>
<div class="space-y-4 text-gray-700">
  <p>The HR System uses a comprehensive, secure authentication and authorization system with role-based access control, dual-token authentication, device management, and advanced security features.</p>
  
  <h4 class="font-semibold text-gray-900 mt-4">User Roles & Permissions:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>super_admin:</strong> Full system access, manage all firms, users, and data</li>
    <li><strong>admin:</strong> Firm-level admin, manage users within firm, view all firm data</li>
    <li><strong>manager:</strong> Can create and manage employees, process wages, view reports</li>
    <li><strong>user:</strong> Limited access, can view assigned data only</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Authentication Flow:</h4>
  <ol class="list-decimal list-inside space-y-2 ml-2">
    <li><strong>Login:</strong> User enters username/email and password</li>
    <li><strong>Verification:</strong> System verifies credentials against database</li>
    <li><strong>Account Lockout Check:</strong> Prevents brute force attacks (after failed attempts)</li>
    <li><strong>Firm Approval Check:</strong> Ensures user's firm is approved</li>
    <li><strong>Token Generation:</strong> System generates access and refresh tokens</li>
    <li><strong>Device Registration:</strong> Device is registered for session tracking</li>
    <li><strong>Login Audit:</strong> Login attempt is logged for security audit</li>
    <li><strong>Cookie Storage:</strong> Tokens stored in secure HTTP-only cookies</li>
  </ol>

  <h4 class="font-semibold text-gray-900 mt-4">Dual-Token Authentication:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Access Token:</strong> Short-lived (15 minutes), used for API requests</li>
    <li><strong>Refresh Token:</strong> Long-lived (30 days), used to get new access tokens</li>
    <li><strong>Auto-Refresh:</strong> When access token expires, refresh token automatically generates new one</li>
    <li><strong>Token Rotation:</strong> Refresh tokens are rotated on each use for security</li>
    <li><strong>Token Hashing:</strong> Tokens are SHA-256 hashed before storage</li>
    <li><strong>Token Type Validation:</strong> Prevents token substitution attacks</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Security Features:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Password Hashing:</strong> Bcrypt with salt for secure password storage</li>
    <li><strong>Rate Limiting:</strong> Limits login attempts to prevent brute force</li>
    <li><strong>Account Lockout:</strong> Locks account after multiple failed attempts</li>
    <li><strong>IP Tracking:</strong> Logs IP address for each login attempt</li>
    <li><strong>User Agent Tracking:</strong> Logs browser/device information</li>
    <li><strong>Device Management:</strong> Track and manage trusted devices</li>
    <li><strong>Session Revocation:</strong> Logout from specific device or all devices</li>
    <li><strong>Token Blacklisting:</strong> Invalidate tokens on logout</li>
    <li><strong>CSRF Protection:</strong> Cross-Site Request Forgery tokens for state-changing operations</li>
    <li><strong>Secure Cookies:</strong> HTTP-only, Secure, SameSite flags enabled</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Login Process:</h4>
  <ol class="list-decimal list-inside space-y-2 ml-2">
    <li>User navigates to login page</li>
    <li>Enters username/email and password</li>
    <li>System checks if user exists</li>
    <li>System verifies password using bcrypt</li>
    <li>System checks for account lockout (too many failed attempts)</li>
    <li>System verifies firm is approved</li>
    <li>System generates access and refresh tokens</li>
    <li>System registers device with unique device_id</li>
    <li>System logs successful login attempt</li>
    <li>Tokens stored in secure HTTP-only cookies</li>
    <li>User redirected to dashboard</li>
  </ol>

  <h4 class="font-semibold text-gray-900 mt-4">Logout Process:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Single Device Logout:</strong> Revokes tokens for current device only</li>
    <li><strong>All Devices Logout:</strong> Revokes all tokens for user across all devices</li>
    <li><strong>Token Blacklisting:</strong> Tokens added to blacklist to prevent reuse</li>
    <li><strong>Session Cleanup:</strong> Device session marked as inactive</li>
    <li><strong>Cookies Cleared:</strong> Access and refresh tokens removed from browser</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Session Management:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>View Active Sessions:</strong> See all devices currently logged in</li>
    <li><strong>Revoke Device:</strong> Logout from specific device</li>
    <li><strong>Trust Device:</strong> Mark device as trusted (optional)</li>
    <li><strong>Revoke Others:</strong> Logout from all devices except current</li>
    <li><strong>Login History:</strong> View recent login attempts with IP and device info</li>
    <li><strong>Suspicious Activity:</strong> Alerts for unusual login patterns</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Token Refresh Flow:</h4>
  <ol class="list-decimal list-inside space-y-2 ml-2">
    <li>User makes API request with expired access token</li>
    <li>Server detects access token is expired</li>
    <li>Server checks if refresh token exists and is valid</li>
    <li>Server verifies refresh token signature</li>
    <li>Server checks if refresh token is blacklisted</li>
    <li>Server checks if user's tokens were invalidated</li>
    <li>Server generates new access token</li>
    <li>Server rotates refresh token (generates new one)</li>
    <li>New tokens sent in response cookies</li>
    <li>Original request retried with new access token</li>
  </ol>

  <h4 class="font-semibold text-gray-900 mt-4">Account Lockout Protection:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Failed Attempt Tracking:</strong> Counts failed login attempts per IP</li>
    <li><strong>Lockout Threshold:</strong> Account locked after N failed attempts</li>
    <li><strong>Lockout Duration:</strong> Account remains locked for specified time</li>
    <li><strong>Reset on Success:</strong> Failed attempt counter resets on successful login</li>
    <li><strong>IP-Based Limiting:</strong> Rate limiting applied per IP address</li>
    <li><strong>Graceful Degradation:</strong> If rate limit DB fails, login still allowed</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Firm-Level Access Control:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Firm Isolation:</strong> Users can only access data from their firm</li>
    <li><strong>Firm Approval:</strong> Users cannot login if firm is not approved</li>
    <li><strong>Multi-Firm Support:</strong> Super admins can access all firms</li>
    <li><strong>Admin Override:</strong> Admins can view all firm data with all_firms flag</li>
    <li><strong>Data Filtering:</strong> All queries automatically filtered by firm_id</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">API Authentication:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Protected Routes:</strong> Require valid access token in cookies</li>
    <li><strong>Optional Auth:</strong> Some routes work with or without authentication</li>
    <li><strong>Public Routes:</strong> No authentication required (login, register, etc.)</li>
    <li><strong>CSRF Tokens:</strong> State-changing operations require CSRF token</li>
    <li><strong>User Context:</strong> req.user contains authenticated user data</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Login Audit Trail:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Logged Information:</strong> User ID, status, IP address, user agent, device ID</li>
    <li><strong>Failure Reasons:</strong> Missing credentials, user not found, invalid password, account locked, firm not approved</li>
    <li><strong>Success Tracking:</strong> Successful logins recorded with timestamp</li>
    <li><strong>History Retention:</strong> Login history available for security review</li>
    <li><strong>Suspicious Detection:</strong> System identifies unusual login patterns</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Device Management:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Device Registration:</strong> Each login registers device with unique ID</li>
    <li><strong>Device Tracking:</strong> Browser, OS, IP address recorded</li>
    <li><strong>Trusted Devices:</strong> Mark devices as trusted for future logins</li>
    <li><strong>Device Revocation:</strong> Logout from specific device</li>
    <li><strong>Session Expiry:</strong> Devices automatically expire after inactivity</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Best Practices:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li>Use strong, unique passwords (minimum 8 characters recommended)</li>
    <li>Never share login credentials with others</li>
    <li>Logout from untrusted devices immediately</li>
    <li>Review login history regularly for suspicious activity</li>
    <li>Use "Logout from All Devices" if you suspect account compromise</li>
    <li>Trust only devices you recognize</li>
    <li>Keep browser and OS updated for security patches</li>
    <li>Use HTTPS connections only (never HTTP)</li>
    <li>Enable two-factor authentication if available</li>
    <li>Report suspicious activity to administrators immediately</li>
  </ul>

  <h4 class="font-semibold text-gray-900 mt-4">Troubleshooting:</h4>
  <ul class="list-disc list-inside space-y-2 ml-2">
    <li><strong>Account Locked:</strong> Too many failed login attempts. Wait for lockout period to expire or contact admin.</li>
    <li><strong>Session Expired:</strong> Access token expired. Refresh token will auto-generate new one. If still failing, login again.</li>
    <li><strong>Firm Not Approved:</strong> Your firm is not approved yet. Contact support.</li>
    <li><strong>Invalid Credentials:</strong> Check username/email and password are correct.</li>
    <li><strong>Cookies Disabled:</strong> Enable cookies in browser settings for authentication to work.</li>
    <li><strong>Session Revoked:</strong> Your session was revoked. Login again to continue.</li>
  </ul>
</div>
`;
