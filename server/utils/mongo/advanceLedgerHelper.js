/**
 * Advance Ledger Helper — Automated ledger posting for employee advances
 * 
 * Handles:
 * - Double-entry ledger posting on advance creation (Disbursement)
 * - Double-entry ledger posting on repayment creation
 * - Ledger cleanup on advance record deletion
 * - Account head resolution and validation
 */

import { v4 as uuidv4 } from 'uuid';
import { Ledger, ChartOfAccounts, BankAccount } from '../../models/index.js';

/* ─────────────────────────────────────────────────────────────────────────
   ACCOUNT RESOLUTION
───────────────────────────────────────────────────────────────────────── */

/**
 * Resolve account head from ChartOfAccounts
 * @throws {Error} If account not found
 */
async function resolveAccountHead(firmId, accountName, accountType) {
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
 * @param {ObjectId} firmId
 * @param {string} bankLabel - "Bank Name • Account Number"
 */
async function resolveBankAccountFromLabel(firmId, bankLabel) {
  if (!bankLabel) throw new Error('Bank label is required');

  // Attempt to find the account head by name directly first
  // Bank labels are formatted as: "Account Name • Bank Name • A/C 1234"
  // But ChartOfAccounts often stores them slightly differently.
  // We'll try to match by the label itself or look up in BankAccount model.
  
  const account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: bankLabel,
    account_type: 'BANK',
    is_active: true,
  }).lean();

  if (account) return account;

  // If not found by name, try parsing the label or searching BankAccount
  // For now, we assume the label matches the account_name in ChartOfAccounts
  // because that's how the system is designed to work for other modules.
  throw new Error(`Bank ledger account not found for label: ${bankLabel}`);
}

/**
 * Get default cash account
 */
async function getDefaultCashAccount(firmId) {
  const account = await ChartOfAccounts.findOne({
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
 * Post advance record to ledger
 * 
 * For ADVANCE (Disbursement):
 * 1. DEBIT: Advance to Employees (Asset)
 * 2. CREDIT: Bank/Cash (Asset)
 * 
 * For REPAYMENT (Collection):
 * 1. DEBIT: Bank/Cash (Asset)
 * 2. CREDIT: Advance to Employees (Asset)
 * 
 * @param {Object} advance - Advance document
 * @param {Session} session - MongoDB session
 * @returns {String} voucher_group_id
 */
export async function postAdvanceLedger(advance, session) {
  const voucherId = uuidv4();
  const entries = [];
  const firmId = advance.firm_id;
  const transactionDate = advance.date;
  const amount = advance.amount;

  try {
    const advanceAccount = await resolveAccountHead(firmId, 'Advance to Employees', 'ASSET');
    let paymentAccount;

    if (advance.payment_mode === 'BANK' && advance.bank_account_details) {
      paymentAccount = await resolveBankAccountFromLabel(firmId, advance.bank_account_details);
    } else {
      paymentAccount = await getDefaultCashAccount(firmId);
    }

    if (advance.type === 'ADVANCE') {
      // disbursement: Advance (Dr), Cash/Bank (Cr)
      entries.push({
        firm_id: firmId,
        account_head: advanceAccount.account_name,
        account_type: advanceAccount.account_type,
        debit_amount: amount,
        credit_amount: 0,
        ref_type: 'ADVANCE',
        ref_id: advance._id,
        master_roll_id: advance.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `Advance disbursed: ${advance.remarks || ''}`,
      });

      entries.push({
        firm_id: firmId,
        account_head: paymentAccount.account_name,
        account_type: paymentAccount.account_type,
        debit_amount: 0,
        credit_amount: amount,
        ref_type: 'ADVANCE',
        ref_id: advance._id,
        master_roll_id: advance.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `Advance disbursed: ${advance.remarks || ''}`,
      });
    } else {
      // repayment: Cash/Bank (Dr), Advance (Cr)
      entries.push({
        firm_id: firmId,
        account_head: paymentAccount.account_name,
        account_type: paymentAccount.account_type,
        debit_amount: amount,
        credit_amount: 0,
        ref_type: 'ADVANCE',
        ref_id: advance._id,
        master_roll_id: advance.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `Advance repayment: ${advance.remarks || ''}`,
      });

      entries.push({
        firm_id: firmId,
        account_head: advanceAccount.account_name,
        account_type: advanceAccount.account_type,
        debit_amount: 0,
        credit_amount: amount,
        ref_type: 'ADVANCE',
        ref_id: advance._id,
        master_roll_id: advance.master_roll_id,
        voucher_group_id: voucherId,
        transaction_date: transactionDate,
        narration: `Advance repayment: ${advance.remarks || ''}`,
      });
    }

    await Ledger.insertMany(entries, { session });
    return voucherId;

  } catch (error) {
    console.error(`❌ Ledger posting failed for advance ${advance._id}:`, error.message);
    throw error;
  }
}

/**
 * Delete ledger entries for an advance record
 */
export async function deleteAdvanceLedger(advanceId, firmId, session) {
  return Ledger.deleteMany(
    {
      ref_type: 'ADVANCE',
      ref_id: advanceId,
      firm_id: firmId,
    },
    { session }
  );
}

export default {
  postAdvanceLedger,
  deleteAdvanceLedger
};
