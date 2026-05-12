import Ledger from '../../models/Ledger.model.js';
import BankAccount from '../../models/BankAccount.model.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Accounting Service for Labor System
 * Handles cross-database integration between Postgres labor events and MongoDB Ledger.
 */
export const accountingService = {
  
  /**
   * Post Labor Advance Payment to MongoDB Ledger
   */
  async postLaborAdvance(params) {
    const { firm_id, amount, payment_date, bank_account_id, leader_name, created_by } = params;
    
    // 1. Fetch Bank Account Details from MongoDB
    const bankAccount = await BankAccount.findOne({ _id: bank_account_id, firm_id });
    if (!bankAccount) throw new Error('Bank account not found or access denied');

    const voucherGroupId = `LABOR_ADV_${uuidv4().substring(0, 8)}`;
    const transactionDate = payment_date || new Date().toISOString().split('T')[0];

    // 2. Create Double Entry in MongoDB Ledger
    const entries = [
      // Credit: Bank Account
      {
        firm_id,
        account_head: bankAccount.account_name,
        account_type: 'BANK',
        credit_amount: amount,
        debit_amount: 0,
        narration: `Labor Advance to ${leader_name}`,
        bank_account_id,
        ref_type: 'ADVANCE',
        transaction_date: transactionDate,
        voucher_group_id: voucherGroupId,
        created_by
      },
      // Debit: Labor Advance Expense Head
      {
        firm_id,
        account_head: `Labor Advance - ${leader_name}`,
        account_type: 'EXPENSE',
        credit_amount: 0,
        debit_amount: amount,
        narration: `Labor Advance to ${leader_name}`,
        ref_type: 'ADVANCE',
        transaction_date: transactionDate,
        voucher_group_id: voucherGroupId,
        created_by
      }
    ];

    await Ledger.insertMany(entries);
    return voucherGroupId;
  },

  /**
   * Post Labor Final Settlement to MongoDB Ledger
   */
  async postLaborSettlement(params) {
    const { 
      firm_id, 
      total_wages, 
      total_expenses, 
      total_advances, 
      net_payable, 
      payment_date, 
      bank_account_id, 
      leader_name, 
      created_by 
    } = params;

    const bankAccount = await BankAccount.findOne({ _id: bank_account_id, firm_id });
    if (!bankAccount) throw new Error('Bank account not found or access denied');

    const voucherGroupId = `LABOR_SETTLE_${uuidv4().substring(0, 8)}`;
    const transactionDate = payment_date || new Date().toISOString().split('T')[0];
    const totalWagesAndExpenses = Number(total_wages) + Number(total_expenses);

    const entries = [
      // 1. Debit: Labor Wages & Expenses (Total)
      {
        firm_id,
        account_head: 'Labor Wages & Expenses',
        account_type: 'EXPENSE',
        credit_amount: 0,
        debit_amount: totalWagesAndExpenses,
        narration: `Final settlement for ${leader_name}`,
        ref_type: 'WAGE',
        transaction_date: transactionDate,
        voucher_group_id: voucherGroupId,
        created_by
      },
      // 2. Credit: Labor Advance (Clearing previous advances)
      {
        firm_id,
        account_head: `Labor Advance - ${leader_name}`,
        account_type: 'EXPENSE',
        credit_amount: total_advances,
        debit_amount: 0,
        narration: `Clearing advances for settlement - ${leader_name}`,
        ref_type: 'WAGE',
        transaction_date: transactionDate,
        voucher_group_id: voucherGroupId,
        created_by
      },
      // 3. Credit: Bank Account (Final payment)
      {
        firm_id,
        account_head: bankAccount.account_name,
        account_type: 'BANK',
        credit_amount: net_payable,
        debit_amount: 0,
        narration: `Final payout for ${leader_name}`,
        bank_account_id,
        ref_type: 'WAGE',
        transaction_date: transactionDate,
        voucher_group_id: voucherGroupId,
        created_by
      }
    ];

    await Ledger.insertMany(entries);
    return voucherGroupId;
  }
};
