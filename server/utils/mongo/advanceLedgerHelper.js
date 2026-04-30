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
 * Automatically creates the account head if it doesn't exist
 * @param {ObjectId} firmId
 * @param {string} accountName
 * @param {string} accountType
 * @param {ObjectId} userId - User ID for creation
 * @param {Session} session - MongoDB session
 */
async function resolveAccountHead(firmId, accountName, accountType, userId, session = null) {
  let account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: accountName,
    account_type: accountType,
    is_active: true,
  }).session(session).lean();

  if (!account) {
    console.log(`⚠️ Account head not found: ${accountName} (${accountType}). Creating auto...`);
    
    const newAccountData = {
      firm_id: firmId,
      account_name: accountName,
      account_type: accountType,
      is_system: true,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    };

    const createdAccounts = await ChartOfAccounts.create([newAccountData], { session });
    account = createdAccounts[0].toObject();
    
    console.log(`✅ Created auto account head: ${accountName} (${accountType})`);
  }

  return account;
}

/**
 * Resolve bank account and get its ledger account head
 * @param {ObjectId} firmId
 * @param {string} bankLabel - "Bank Name • Account Number"
 * @param {ObjectId} userId - User ID for creation
 * @param {Session} session - MongoDB session
 */
async function resolveBankAccountFromLabel(firmId, bankLabel, userId, session = null) {
  if (!bankLabel) throw new Error('Bank label is required');

  let account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: bankLabel,
    account_type: 'BANK',
    is_active: true,
  }).session(session).lean();

  if (account) return account;

  // If not found, create it as a bank account
  console.log(`⚠️ Bank ledger account not found for label: ${bankLabel}. Creating auto...`);
  
  const newAccountData = {
    firm_id: firmId,
    account_name: bankLabel,
    account_type: 'BANK',
    is_system: true,
    is_active: true,
    created_by: userId,
    updated_by: userId,
  };

  const createdAccounts = await ChartOfAccounts.create([newAccountData], { session });
  account = createdAccounts[0].toObject();
  
  console.log(`✅ Created auto bank ledger account: ${bankLabel}`);
  return account;
}

/**
 * Get default cash account
 * @param {ObjectId} firmId
 * @param {ObjectId} userId - User ID for creation
 * @param {Session} session - MongoDB session
 */
async function getDefaultCashAccount(firmId, userId, session = null) {
  let account = await ChartOfAccounts.findOne({
    firm_id: firmId,
    account_name: 'Cash in Hand',
    account_type: 'CASH',
    is_active: true,
  }).session(session).lean();

  if (!account) {
    console.log(`⚠️ Default cash account not found. Creating "Cash in Hand"...`);
    
    const newAccountData = {
      firm_id: firmId,
      account_name: 'Cash in Hand',
      account_type: 'CASH',
      is_system: true,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    };

    const createdAccounts = await ChartOfAccounts.create([newAccountData], { session });
    account = createdAccounts[0].toObject();
    
    console.log(`✅ Created default cash account: Cash in Hand`);
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
  const userId = advance.created_by || advance.updated_by;
  const transactionDate = advance.date;
  const amount = advance.amount;

  try {
    const advanceAccount = await resolveAccountHead(firmId, 'Advance to Employees', 'ASSET', userId, session);
    let paymentAccount;

    if (advance.payment_mode === 'BANK' && advance.bank_account_details) {
      paymentAccount = await resolveBankAccountFromLabel(firmId, advance.bank_account_details, userId, session);
    } else {
      paymentAccount = await getDefaultCashAccount(firmId, userId, session);
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
