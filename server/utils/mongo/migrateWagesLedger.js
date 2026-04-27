/**
 * Migration Script: Initialize Chart of Accounts and Post Ledger for Historical Wages
 * 
 * This script:
 * 1. Creates Chart of Accounts for all firms
 * 2. Posts ledger entries for all historical wages
 * 3. Generates a migration report
 * 
 * Usage:
 *   node server/utils/mongo/migrateWagesLedger.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './mongoose.config.js';
import { Firm, Wage, ChartOfAccounts, User } from '../../models/index.js';
import { initializeChartOfAccounts } from './initializeChartOfAccounts.js';
import { postWageLedger } from './wagesLedgerHelper.js';

async function migrateWagesLedger() {
  const session = await mongoose.startSession();
  session.startTransaction();

  const report = {
    firms_processed: 0,
    firms_failed: 0,
    accounts_created: 0,
    wages_migrated: 0,
    wages_failed: 0,
    errors: [],
    start_time: new Date(),
  };

  try {
    console.log('🚀 Starting Wages Ledger Migration...\n');

    // Get all firms
    const firms = await Firm.find().lean();
    console.log(`📊 Found ${firms.length} firms to process\n`);

    for (const firm of firms) {
      try {
        console.log(`\n📋 Processing Firm: ${firm.name} (${firm._id})`);

        // Get a super admin user for this firm (or any user)
        const user = await User.findOne({ firm_id: firm._id }).lean();
        if (!user) {
          console.log(`⚠️  No user found for firm ${firm.name}, skipping...`);
          report.firms_failed++;
          continue;
        }

        // 1. Initialize Chart of Accounts
        console.log('  → Initializing Chart of Accounts...');
        const coaResult = await initializeChartOfAccounts(firm._id, user._id);
        if (coaResult.success) {
          console.log(`  ✅ ${coaResult.message}`);
          report.accounts_created += coaResult.created;
        } else {
          console.log(`  ❌ ${coaResult.message}`);
          report.errors.push({
            firm: firm.name,
            step: 'Chart of Accounts',
            error: coaResult.message,
          });
          report.firms_failed++;
          continue;
        }

        // 2. Get all wages for this firm without ledger entries
        const wages = await Wage.find({
          firm_id: firm._id,
          voucher_group_id: null,
          status: { $ne: 'POSTED' },
        }).lean();

        console.log(`  → Found ${wages.length} wages to migrate`);

        // 3. Post ledger entries for each wage
        for (const wage of wages) {
          try {
            // Fetch full wage document (not lean) for posting
            const fullWage = await Wage.findById(wage._id);
            
            const voucherId = await postWageLedger(fullWage, session);
            
            // Update wage with posting info
            fullWage.voucher_group_id = voucherId;
            fullWage.status = 'POSTED';
            fullWage.posted_date = new Date();
            fullWage.posted_by = user._id;
            await fullWage.save({ session });

            report.wages_migrated++;
          } catch (error) {
            report.wages_failed++;
            report.errors.push({
              firm: firm.name,
              wage_id: wage._id,
              error: error.message,
            });
            console.log(`    ❌ Failed to migrate wage ${wage._id}: ${error.message}`);
          }
        }

        console.log(`  ✅ Migrated ${report.wages_migrated} wages for ${firm.name}`);
        report.firms_processed++;

      } catch (error) {
        report.firms_failed++;
        report.errors.push({
          firm: firm.name,
          error: error.message,
        });
        console.error(`❌ Error processing firm ${firm.name}:`, error.message);
      }
    }

    // Commit transaction
    await session.commitTransaction();

    // Generate report
    report.end_time = new Date();
    report.duration_ms = report.end_time - report.start_time;

    console.log('\n\n📊 MIGRATION REPORT');
    console.log('═'.repeat(50));
    console.log(`Firms Processed:    ${report.firms_processed}`);
    console.log(`Firms Failed:       ${report.firms_failed}`);
    console.log(`Accounts Created:   ${report.accounts_created}`);
    console.log(`Wages Migrated:     ${report.wages_migrated}`);
    console.log(`Wages Failed:       ${report.wages_failed}`);
    console.log(`Duration:           ${(report.duration_ms / 1000).toFixed(2)}s`);
    console.log('═'.repeat(50));

    if (report.errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      report.errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.firm || err.wage_id || 'Unknown'}: ${err.error}`);
      });
    }

    console.log('\n✅ Migration completed successfully!');
    return report;

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Migration failed:', error);
    report.errors.push({ error: error.message });
    return report;
  } finally {
    await session.endSession();
  }
}

// Run migration if this script is executed directly
const isDirectRun = process.argv[1].includes('migrateWagesLedger.js');
if (isDirectRun) {
  connectDB()
    .then(() => {
      console.log('✅ Connected to database\n');
      return migrateWagesLedger();
    })
    .then((report) => {
      console.log('\n✅ Migration process completed');
      process.exit(report.errors.length === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    })
    .finally(() => {
      disconnectDB();
    });
}

export { migrateWagesLedger };
