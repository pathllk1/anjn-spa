/**
 * Update Super Admin Password & Unlock Account — Mongoose version
 *
 * Updates the password for the super_admin user, resets failed attempts,
 * clears lockouts, and ensures status is 'approved'.
 *
 * Usage:
 *   node server/utils/mongo/update-super-admin-password.js [--clear-ip IP_ADDRESS]
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDB, disconnectDB } from './mongoose.config.js';
import { User } from '../../models/index.js';
import RateLimit from '../../models/RateLimit.model.js';

async function updateAndUnlockSuperAdmin() {
  try {
    const newPassword = 'Superadmin@123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    console.log('🔄 Updating Super Admin account...');

    const result = await User.findOneAndUpdate(
      { role: 'super_admin' },
      {
        $set: {
          password:              hashedPassword,
          status:                'approved',
          failed_login_attempts: 0,
          account_locked_until:  null
        }
      },
      { new: true }
    );

    if (result) {
      console.log('✅ Super admin password updated successfully');
      console.log('✅ Account lock cleared');
      console.log('✅ Status set to "approved"');
      console.log('📧 Username:   superadmin');
      console.log('📧 Email:      ' + result.email);
      console.log(`🔑 New Password: ${newPassword}`);
    } else {
      console.log('❌ Super admin user not found. Did you run the seed script?');
    }

    // Optional: Clear IP rate limit if provided
    const clearIpIndex = process.argv.indexOf('--clear-ip');
    if (clearIpIndex !== -1 && process.argv[clearIpIndex + 1]) {
      const ip = process.argv[clearIpIndex + 1];
      const key = `login:ip:${ip}`;
      const delResult = await RateLimit.deleteOne({ key });
      if (delResult.deletedCount > 0) {
        console.log(`✅ Rate limit cleared for IP: ${ip}`);
      } else {
        console.log(`ℹ️ No rate limit record found for IP: ${ip}`);
      }
    } else {
      console.log('💡 Note: You can also clear IP rate limits by passing: --clear-ip YOUR_IP');
    }

  } catch (err) {
    console.error('❌ Error updating super admin:', err);
    throw err;
  }
}

connectDB()
  .then(() => {
    console.log('Connected to database');
    return updateAndUnlockSuperAdmin();
  })
  .then(() => {
    console.log('Process completed successfully');
    disconnectDB();
  })
  .catch(err => {
    console.error('Script execution failed:', err);
    process.exit(1);
  });
