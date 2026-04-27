/**
 * Initialize Chart of Accounts for a firm
 * Creates system accounts required for wages accounting
 */

import { ChartOfAccounts } from '../../models/index.js';

const SYSTEM_ACCOUNTS = [
  {
    account_name: 'Salaries & Wages',
    account_type: 'EXPENSE',
    account_code: 'EXP-001',
    description: 'Employee salaries and wages',
    is_system: true,
  },
  {
    account_name: 'EPF Payable',
    account_type: 'PAYABLE',
    account_code: 'PAY-001',
    description: 'Employee Provident Fund payable to government',
    is_system: true,
  },
  {
    account_name: 'ESIC Payable',
    account_type: 'PAYABLE',
    account_code: 'PAY-002',
    description: 'Employee State Insurance payable to government',
    is_system: true,
  },
  {
    account_name: 'Other Deductions',
    account_type: 'PAYABLE',
    account_code: 'PAY-003',
    description: 'Other wage deductions',
    is_system: true,
  },
  {
    account_name: 'Advance to Employees',
    account_type: 'ASSET',
    account_code: 'ASS-001',
    description: 'Advances given to employees',
    is_system: true,
  },
  {
    account_name: 'Cash in Hand',
    account_type: 'CASH',
    account_code: 'CASH-001',
    description: 'Cash in hand',
    is_system: true,
  },
];

/**
 * Initialize chart of accounts for a firm
 * @param {ObjectId} firmId - Firm ID
 * @param {ObjectId} userId - User ID (for created_by/updated_by)
 * @returns {Object} Result with created and skipped counts
 */
export async function initializeChartOfAccounts(firmId, userId) {
  let created = 0;
  let skipped = 0;
  const errors = [];

  try {
    for (const account of SYSTEM_ACCOUNTS) {
      try {
        // Check if account already exists
        const existing = await ChartOfAccounts.findOne({
          firm_id: firmId,
          account_name: account.account_name,
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create account
        await ChartOfAccounts.create({
          firm_id,
          ...account,
          is_active: true,
          opening_balance: 0,
          created_by: userId,
          updated_by: userId,
        });

        created++;
        console.log(`✅ Created account: ${account.account_name}`);
      } catch (error) {
        errors.push({
          account: account.account_name,
          error: error.message,
        });
        console.error(`❌ Failed to create account ${account.account_name}:`, error.message);
      }
    }

    return {
      success: true,
      created,
      skipped,
      errors,
      message: `Chart of Accounts initialized: ${created} created, ${skipped} skipped`,
    };
  } catch (error) {
    console.error('❌ Chart of Accounts initialization failed:', error);
    return {
      success: false,
      created,
      skipped,
      errors: [{ error: error.message }],
      message: `Chart of Accounts initialization failed: ${error.message}`,
    };
  }
}

export default { initializeChartOfAccounts };
