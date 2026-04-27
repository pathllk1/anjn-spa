/**
 * Wages Ledger Helper — Automated ledger posting for wages
 * 
 * Handles:
 * - Double-entry ledger posting on wage creation
 * - Ledger recalculation on wage update
 * - Ledger cleanup on wage deletion
 * - Account head resolution and validation
 * - Atomic transactions for consistency
 */

import { v4 as uuidv4 } from 'uuid';
import { Ledger, ChartOfAccounts, BankAccount, MasterRoll } from '../../models/index.js';

/* ─────────────────────────────────────────────────────────────────────────
   VALIDATION FUNCTIONS
───────────────────────────────────────────────────────────────────────── */

/**
 * Validate wage data before posting to ledger
 * @throws {Error} If validation fails
 */
export async function validateWageForPosting(wage) {
  const errors = [];

  // Amount validation
  if (!wage.gross_salary || wage.gross_salary <= 0) {
    errors.push('Gross salary must be greater than 0');
  }

  if (!wage.net_salary || wage.net_salary <= 0) {
    errors.push('Net salary must be greater than 0');
  }

  // Deduction validation
  const totalDeductions = (wage.epf_deduction || 0) +
                         (wage.esic_deduction || 0) +
                         (wage.other_deduction || 0) +
                         (wage.advance_deduction || 0);

  if (totalDeductions > wage.gross_salary) {
    errors.push(`Total deductions (${totalDeductions}) cannot exceed gross salary (${wage.gross_salary})`);
  }

  // Bank validation (if paid)
  if (wage.paid_date && !wage.bank_account_id) {
    errors.push('Bank account is required for paid wages');
  }

  // Payment mode validation
  if (wage.paid_date && !wage.payment_mode) {
    errors.push('Payment mode is required for paid wages');
  }

  // Salary month format
  if (!/^\d{4}-\d{2}$/.test(wage.salary_month)) {
    errors.push('Salary month must be in YYYY-MM format');
  }

  if (errors.length > 0) {
    throw new Error(`Wage validation failed: ${errors.join('; ')}`);
  }
}

/**
 * Validate ledger entries before posting
 * @throws {Error} If validation fails
 */
export async function validateLedgerEntries(entries, firmId) {
  const errors = [];

  // Total debits = total credits
  const totalDebits = entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    errors.push(`Debits (${totalDebits.toFixed(2)}) != Credits (${totalCredits.toFixed(2)})`);
  }

  // Account head validation
  for (const entry of entries) {
    const account = await ChartOfAccounts.findOne({
      firm_id: firmId,
      account_name: entry.account_head,
      is_active: true,
    }).lean();

    if (!account) {
      errors.push(`Account head not found or inactive: ${entry.account_head}`);
    }
  }

  // No zero-amount entries
  for (const entry of entries) {
    if ((entry.debit_amount || 0) === 0 && (entry.credit_amount || 0) === 0) {
      errors.push(`Zero-amount entry for ${entry.account_head}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Ledger validation failed: ${errors.join('; ')}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   ACCOUNT RESOLUTION
───────────────────────────────────────────────────────────────────────── */

/**
 * Resolve account head from ChartOfAccounts
 * @throws {Error} If account not found
 */
export async function resolveAccountHead(firmId, accountName, accountType) {
  const account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: accountName,
    account_type: accountType,
    is_active: true,
  }).lean();

  if (!account) {
    throw new Error(`Account head not found: ${accountName} (${accountType})`);
  }

  return account;
}

/**
 * Resolve bank account and get its ledger account head
 * @throws {Error} If bank account not found
 */
export async function resolveBankAccount(firmId, bankAccountId) {
  const bankAccount = await BankAccount.findOne({
    _id: bankAccountId,
    firm_id: firmId,
    status: 'ACTIVE',
  }).lean();

  if (!bankAccount) {
    throw new Error(`Bank account not found or inactive: ${bankAccountId}`);
  }

  // Create account head name from bank details
  const accountHeadName = `${bankAccount.bank_name} - ${bankAccount.account_number}`;

  // Try to find or create the account head
  let account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: accountHeadName,
    account_type: 'BANK',
    is_active: true,
  }).lean();

  if (!account) {
    throw new Error(`Bank ledger account not found: ${accountHeadName}`);
  }

  return account;
}

/**
 * Get or create default cash account
 */
export async function getDefaultCashAccount(firmId) {
  let account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: 'Cash in Hand',
    account_type: 'CASH',
    is_active: true,
  }).lean();

  if (!account) {
    throw new Error('Default cash account not found. Please create "Cash in Hand" account.');
  }

  return account;
}

/* ─────────────────────────────────────────────────────────────────────────
   LEDGER POSTING
───────────────────────────────────────────────────────────────────────── */

/**
 * Post wage to ledger with double-entry compliance
 * 
 * Creates entries:
 * 1. DEBIT: Salaries & Wages (Expense)
 * 2. CREDIT: Bank/Cash (Asset)
 * 3. CREDIT: EPF Payable (Liability) - if epf_deduction > 0
 * 4. CREDIT: ESIC Payable (Liability) - if esic_deduction > 0
 * 5. CREDIT: Other Deductions - if other_deduction > 0
 * 6. CREDIT: Advance to Employees (Asset) - if advance_deduction > 0
 * 
 * @param {Object} wage - Wage document
 * @param {Session} session - MongoDB session for atomic transaction
 * @returns {String} voucher_group_id (UUID)
 * @throws {Error} If posting fails
 */
export async function postWageLedger(wage, session) {
  // Validate wage
  await validateWageForPosting(wage);

  const voucherId = uuidv4();
  const entries = [];
  const firmId = wage.firm_id;
  const transactionDate = wage.paid_date || new Date().toISOString().split('T')[0];

  try {
    // 1. DEBIT: Salaries & Wages (Expense)
    const expenseAccount = await resolveAccountHead(firmId, 'Salaries & Wages', 'EXPENSE');
    entries.push({
      firm_id: firmId,
      account_head: expenseAccount.account_name,
      account_type: expenseAccount.account_type,
      debit_amount: wage.gross_salary,
      credit_amount: 0,
      ref_type: 'WAGE',
      ref_id: wage._id,
      master_roll_id: wage.master_roll_id,
      voucher_group_id: voucherId,
      transaction_date: transactionDate,
      narration: `Wages for ${wage.salary_month}`,
      is_wage_entry: true,
    });

    // 2. CREDIT: Bank/Cash (Asset)
    let bankAccount;
    if (wage.paid_date && wage.bank_account_id) {
      bankAccount = await resolveBankAccount(firmId, wage.bank_account_id);
    } else {
      bankAccount = await getDefaultCashAccount(firmId);
    }

    entries.push({
      firm_id: firmId,
      account_head: bankAccount.account_name,
      account_type: bankAccount.account_type,
      debit_amount: 0,
      credit_amount: wage.net_salary,
      ref_type: 'WAGE',
      ref_id: wage._id,
      master_roll_id: wage.master_roll_id,
      voucher_group_id: voucherId,
      bank_account_id: wage.bank_account_id || null,
      payment_mode: wage.payment_mode || null,
      transaction_date: transactionDate,
      narration: `Wages paid - ${wage.salary_month}${wage.cheque_no ? ` - Chq: ${wage.cheque_no}` : ''}`,
      is_wage_entry: true,
    });

    // 3. CREDIT: EPF Payable (if deduction > 0)
    if ((wage.epf_deduction || 0) > 0) {
      const epfAccount = await resolveAccountHead(firmId, 'EPF Payable', 'PAYABLE');
      entries.push({
        firm_id: firmId,
        account_head: epfAccount.account_name,
        account_type: epfAccount.account_type,
        debit_amount: 0,
        credit_amount: wage.epf_deduction,
        ref_type: 'WAGE',
        ref_id: wage._id,
        master_roll_id: wage.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `EPF Payable - ${wage.salary_month}`,
        is_wage_entry: true,
      });
    }

    // 4. CREDIT: ESIC Payable (if deduction > 0)
    if ((wage.esic_deduction || 0) > 0) {
      const esicAccount = await resolveAccountHead(firmId, 'ESIC Payable', 'PAYABLE');
      entries.push({
        firm_id: firmId,
        account_head: esicAccount.account_name,
        account_type: esicAccount.account_type,
        debit_amount: 0,
        credit_amount: wage.esic_deduction,
        ref_type: 'WAGE',
        ref_id: wage._id,
        master_roll_id: wage.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `ESIC Payable - ${wage.salary_month}`,
        is_wage_entry: true,
      });
    }

    // 5. CREDIT: Other Deductions (if deduction > 0)
    if ((wage.other_deduction || 0) > 0) {
      const otherAccount = await resolveAccountHead(firmId, 'Other Deductions', 'PAYABLE');
      entries.push({
        firm_id: firmId,
        account_head: otherAccount.account_name,
        account_type: otherAccount.account_type,
        debit_amount: 0,
        credit_amount: wage.other_deduction,
        ref_type: 'WAGE',
        ref_id: wage._id,
        master_roll_id: wage.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `Other Deductions - ${wage.salary_month}`,
        is_wage_entry: true,
      });
    }

    // 6. CREDIT: Advance to Employees (if advance_deduction > 0)
    if ((wage.advance_deduction || 0) > 0) {
      const advanceAccount = await resolveAccountHead(firmId, 'Advance to Employees', 'ASSET');
      entries.push({
        firm_id: firmId,
        account_head: advanceAccount.account_name,
        account_type: advanceAccount.account_type,
        debit_amount: 0,
        credit_amount: wage.advance_deduction,
        ref_type: 'WAGE',
        ref_id: wage._id,
        master_roll_id: wage.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `Advance Recovery - ${wage.salary_month}`,
        is_wage_entry: true,
      });
    }

    // Validate ledger entries
    await validateLedgerEntries(entries, firmId);

    // Insert ledger entries atomically
    await Ledger.insertMany(entries, { session });

    console.log(`✅ Ledger posted for wage ${wage._id}: ${entries.length} entries`);
    return voucherId;

  } catch (error) {
    console.error(`❌ Ledger posting failed for wage ${wage._id}:`, error.message);
    throw new Error(`Ledger posting failed: ${error.message}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   LEDGER DELETION
───────────────────────────────────────────────────────────────────────── */

/**
 * Delete all ledger entries for a wage
 * @param {ObjectId} wageId - Wage ID
 * @param {ObjectId} firmId - Firm ID
 * @param {Session} session - MongoDB session
 */
export async function deleteWageLedger(wageId, firmId, session) {
  try {
    const result = await Ledger.deleteMany(
      {
        ref_type: 'WAGE',
        ref_id: wageId,
        firm_id: firmId,
      },
      { session }
    );

    console.log(`✅ Deleted ${result.deletedCount} ledger entries for wage ${wageId}`);
    return result.deletedCount;

  } catch (error) {
    console.error(`❌ Ledger deletion failed for wage ${wageId}:`, error.message);
    throw new Error(`Ledger deletion failed: ${error.message}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   LEDGER RECALCULATION
───────────────────────────────────────────────────────────────────────── */

/**
 * Recalculate ledger entries for updated wage
 * Deletes old entries and posts new ones
 * @param {Object} wage - Updated wage document
 * @param {Session} session - MongoDB session
 * @returns {String} new voucher_group_id
 */
export async function recalculateWageLedger(wage, session) {
  try {
    // 1. Delete old entries
    await deleteWageLedger(wage._id, wage.firm_id, session);

    // 2. Post new entries
    const newVoucherId = await postWageLedger(wage, session);

    console.log(`✅ Ledger recalculated for wage ${wage._id}`);
    return newVoucherId;

  } catch (error) {
    console.error(`❌ Ledger recalculation failed for wage ${wage._id}:`, error.message);
    throw new Error(`Ledger recalculation failed: ${error.message}`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   BULK OPERATIONS
───────────────────────────────────────────────────────────────────────── */

/**
 * Post ledger for multiple wages
 * @param {Array} wages - Array of wage documents
 * @param {Session} session - MongoDB session
 * @returns {Array} Array of voucher IDs
 */
export async function postWagesLedgerBulk(wages, session) {
  const voucherIds = [];

  for (const wage of wages) {
    try {
      const voucherId = await postWageLedger(wage, session);
      voucherIds.push({ wage_id: wage._id, voucher_id: voucherId, success: true });
    } catch (error) {
      voucherIds.push({ wage_id: wage._id, error: error.message, success: false });
    }
  }

  return voucherIds;
}

export default {
  validateWageForPosting,
  validateLedgerEntries,
  resolveAccountHead,
  resolveBankAccount,
  getDefaultCashAccount,
  postWageLedger,
  deleteWageLedger,
  recalculateWageLedger,
  postWagesLedgerBulk,
};
