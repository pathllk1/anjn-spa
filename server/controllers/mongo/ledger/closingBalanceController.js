import mongoose from 'mongoose';
import { Ledger } from '../../../models/index.js';

const now = () => new Date().toISOString();
const getActorUsername = (req) => req?.user?.username ?? null;

function getFirmId(req, res, tag) {
  const raw = req.user?.firm_id;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    console.error(`[${tag}] Invalid firm_id:`, raw);
    res.status(400).json({ error: 'Invalid or missing firm ID' });
    return null;
  }
  return raw;
}

/* ── CALCULATE & CREATE CLOSING BALANCE ─────────────────────────────── */

export const createClosingBalance = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'CLOSING_BALANCE_CREATE');
  if (!firmId) return;

  const { account_head, account_type, closing_date, narration } = req.body;

  if (!account_head?.trim()) return res.status(400).json({ error: 'Account head is required' });
  if (!account_type?.trim()) return res.status(400).json({ error: 'Account type is required' });
  if (!closing_date?.trim()) return res.status(400).json({ error: 'Closing date is required' });

  try {
    // Get opening balance (if any before closing date)
    const openingBalances = await Ledger.findOne({
      firm_id: firmId,
      account_head: account_head.trim(),
      account_type: account_type.trim(),
      ref_type: 'OPENING_BALANCE',
      transaction_date: { $lt: closing_date.trim() },
    })
      .sort({ transaction_date: -1 })
      .lean();

    let ob_debit = openingBalances?.debit_amount || 0;
    let ob_credit = openingBalances?.credit_amount || 0;

    // Get all transactions (OPENING_BALANCE, BILL, JOURNAL, VOUCHER, MANUAL) up to closing date
    const transactions = await Ledger.find({
      firm_id: firmId,
      account_head: account_head.trim(),
      transaction_date: { $lte: closing_date.trim() },
      ref_type: { $in: ['OPENING_BALANCE', 'BILL', 'JOURNAL', 'VOUCHER', 'MANUAL'] },
    })
      .sort({ transaction_date: 1, createdAt: 1 })
      .lean();

    // Calculate running balance
    let total_debit = 0;
    let total_credit = 0;
    let closing_debit = 0;
    let closing_credit = 0;

    transactions.forEach(trx => {
      if (trx.ref_type === 'OPENING_BALANCE') {
        if (trx.debit_amount > 0) total_debit += trx.debit_amount;
        if (trx.credit_amount > 0) total_credit += trx.credit_amount;
      } else {
        // Regular transactions
        if (trx.debit_amount > 0) total_debit += trx.debit_amount;
        if (trx.credit_amount > 0) total_credit += trx.credit_amount;
      }
    });

    // Closing balance calculation based on account type
    const net_balance = total_debit - total_credit;

    // For asset/expense/debit accounts: positive balance is debit
    // For liability/income/credit accounts: positive balance is credit
    const debit_accounts = ['ASSET', 'EXPENSE', 'COGS', 'CASH', 'BANK', 'DEBTOR', 'DISCOUNT_GIVEN', 'PREPAID_EXPENSE'];
    
    if (debit_accounts.includes(account_type.trim())) {
      // Debit account
      if (net_balance >= 0) {
        closing_debit = net_balance;
        closing_credit = 0;
      } else {
        closing_debit = 0;
        closing_credit = Math.abs(net_balance);
      }
    } else {
      // Credit account (LIABILITY, INCOME, CAPITAL, etc.)
      if (net_balance >= 0) {
        closing_debit = net_balance;
        closing_credit = 0;
      } else {
        closing_debit = 0;
        closing_credit = Math.abs(net_balance);
      }
    }

    // Create closing balance record
    const doc = new Ledger({
      firm_id: firmId,
      account_head: account_head.trim(),
      account_type: account_type.trim(),
      debit_amount: closing_debit,
      credit_amount: closing_credit,
      narration: narration?.trim() || 'Closing Balance',
      ref_type: 'CLOSING_BALANCE',
      transaction_date: closing_date.trim(),
      created_by: actorUsername,
      is_locked: true, // Closing balances are auto-locked
    });

    await doc.save();

    res.json({
      message: 'Closing balance created successfully',
      id: doc._id,
      closing_balance: {
        _id: doc._id,
        accountHead: doc.account_head,
        accountType: doc.account_type,
        closingDate: doc.transaction_date,
        debitAmount: doc.debit_amount,
        creditAmount: doc.credit_amount,
        narration: doc.narration,
        isLocked: doc.is_locked,
        calculatedFrom: {
          openingDebit: ob_debit,
          openingCredit: ob_credit,
          totalDebit: total_debit,
          totalCredit: total_credit,
        },
      },
    });
  } catch (err) {
    console.error('[CLOSING_BALANCE_CREATE] Error:', err);
    res.status(500).json({ error: 'Failed to create closing balance: ' + err.message });
  }
};

/* ── GET ALL CLOSING BALANCES ────────────────────────────────────────── */

export const getClosingBalances = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'CLOSING_BALANCES_GET');
    if (!firmId) return;

    const { closing_date, search, page = 1, limit = 50 } = req.query;
    const pageInt = Math.max(1, parseInt(page) || 1);
    const limitInt = Math.min(100, Math.max(1, parseInt(limit) || 50));

    const match = {
      firm_id: new mongoose.Types.ObjectId(firmId),
      ref_type: 'CLOSING_BALANCE',
    };

    if (closing_date) {
      match.transaction_date = closing_date;
    }

    if (search?.trim()) {
      match.account_head = { $regex: search.trim(), $options: 'i' };
    }

    const total = await Ledger.countDocuments(match);
    const records = await Ledger.find(match)
      .sort({ transaction_date: -1, account_head: 1 })
      .skip((pageInt - 1) * limitInt)
      .limit(limitInt)
      .lean();

    const formatted = records.map(r => ({
      _id: r._id,
      accountHead: r.account_head,
      accountType: r.account_type,
      closingDate: r.transaction_date,
      debitAmount: r.debit_amount,
      creditAmount: r.credit_amount,
      narration: r.narration,
      isLocked: r.is_locked,
      createdBy: r.created_by,
    }));

    res.json({
      records: formatted,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total,
        pages: Math.ceil(total / limitInt),
      },
    });
  } catch (err) {
    console.error('[CLOSING_BALANCES_GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ── GET CLOSING BALANCE BY ID ───────────────────────────────────────── */

export const getClosingBalanceById = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'CLOSING_BALANCE_GET_BY_ID');
    if (!firmId) return;

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid closing balance ID' });
    }

    const cb = await Ledger.findOne({
      _id: id,
      firm_id: firmId,
      ref_type: 'CLOSING_BALANCE',
    }).lean();

    if (!cb) {
      return res.status(404).json({ error: 'Closing balance not found' });
    }

    res.json({
      _id: cb._id,
      accountHead: cb.account_head,
      accountType: cb.account_type,
      closingDate: cb.transaction_date,
      debitAmount: cb.debit_amount,
      creditAmount: cb.credit_amount,
      narration: cb.narration,
      isLocked: cb.is_locked,
    });
  } catch (err) {
    console.error('[CLOSING_BALANCE_GET_BY_ID] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ── DELETE CLOSING BALANCE ──────────────────────────────────────────── */

export const deleteClosingBalance = async (req, res) => {
  const firmId = getFirmId(req, res, 'CLOSING_BALANCE_DELETE');
  if (!firmId) return;

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid closing balance ID' });
  }

  try {
    const cb = await Ledger.findOne({
      _id: id,
      firm_id: firmId,
      ref_type: 'CLOSING_BALANCE',
    });

    if (!cb) {
      return res.status(404).json({ error: 'Closing balance not found' });
    }

    if (cb.is_locked) {
      return res.status(400).json({ error: 'Cannot delete locked closing balance' });
    }

    await Ledger.deleteOne({ _id: id });

    res.json({ message: 'Closing balance deleted successfully' });
  } catch (err) {
    console.error('[CLOSING_BALANCE_DELETE] Error:', err);
    res.status(500).json({ error: 'Failed to delete closing balance: ' + err.message });
  }
};

/* ── GET CLOSING BALANCE SUMMARY (for period end reports) ────────────── */

export const getClosingBalanceSummary = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'CLOSING_BALANCE_SUMMARY');
    if (!firmId) return;

    const { closing_date } = req.query;

    const match = {
      firm_id: new mongoose.Types.ObjectId(firmId),
      ref_type: 'CLOSING_BALANCE',
    };
    if (closing_date) {
      match.transaction_date = { $lte: closing_date };
    }

    const summary = await Ledger.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            account_head: '$account_head',
            account_type: '$account_type',
          },
          total_debit: { $sum: '$debit_amount' },
          total_credit: { $sum: '$credit_amount' },
          latest_date: { $max: '$transaction_date' },
        },
      },
      {
        $project: {
          _id: 0,
          account_head: '$_id.account_head',
          account_type: '$_id.account_type',
          total_debit: 1,
          total_credit: 1,
          balance: { $subtract: ['$total_debit', '$total_credit'] },
          latestDate: '$latest_date',
        },
      },
      { $sort: { account_head: 1 } },
    ]);

    res.json(summary);
  } catch (err) {
    console.error('[CLOSING_BALANCE_SUMMARY] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ── BULK CREATE CLOSING BALANCES (for all accounts on a date) ───────── */

export const bulkCreateClosingBalances = async (req, res) => {
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });

  const firmId = getFirmId(req, res, 'CLOSING_BALANCE_BULK_CREATE');
  if (!firmId) return;

  // Use current date or provided date (default to today)
  const { closing_date } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const closingDateToUse = closing_date?.trim() || today;

  try {
    // Get all unique account heads with transactions on or before closing date
    const accounts = await Ledger.aggregate([
      {
        $match: {
          firm_id: new mongoose.Types.ObjectId(firmId),
          transaction_date: { $lte: closingDateToUse },
          ref_type: { $in: ['OPENING_BALANCE', 'BILL', 'JOURNAL', 'VOUCHER', 'MANUAL'] },
        },
      },
      {
        $group: {
          _id: {
            account_head: '$account_head',
            account_type: '$account_type',
          },
        },
      },
    ]);

    const closingBalances = [];
    const errors = [];

    for (const account of accounts) {
      try {
        // Get all transactions from the earliest date (opening balance or first transaction) to closing date
        const transactions = await Ledger.find({
          firm_id: firmId,
          account_head: account._id.account_head,
          account_type: account._id.account_type,
          transaction_date: { $lte: closingDateToUse },
          ref_type: { $in: ['OPENING_BALANCE', 'BILL', 'JOURNAL', 'VOUCHER', 'MANUAL'] },
        })
          .sort({ transaction_date: 1, createdAt: 1 })
          .lean();

        if (transactions.length === 0) continue;

        let total_debit = 0;
        let total_credit = 0;

        transactions.forEach(trx => {
          if (trx.debit_amount > 0) total_debit += trx.debit_amount;
          if (trx.credit_amount > 0) total_credit += trx.credit_amount;
        });

        const net_balance = total_debit - total_credit;
        const debit_accounts = ['ASSET', 'EXPENSE', 'COGS', 'CASH', 'BANK', 'DEBTOR', 'DISCOUNT_GIVEN', 'PREPAID_EXPENSE'];
        
        let closing_debit = 0;
        let closing_credit = 0;

        if (debit_accounts.includes(account._id.account_type)) {
          if (net_balance >= 0) {
            closing_debit = net_balance;
            closing_credit = 0;
          } else {
            closing_debit = 0;
            closing_credit = Math.abs(net_balance);
          }
        } else {
          if (net_balance >= 0) {
            closing_debit = net_balance;
            closing_credit = 0;
          } else {
            closing_debit = 0;
            closing_credit = Math.abs(net_balance);
          }
        }

        // Check if closing balance already exists for this account on this date
        const existing = await Ledger.findOne({
          firm_id: firmId,
          account_head: account._id.account_head,
          transaction_date: closingDateToUse,
          ref_type: 'CLOSING_BALANCE',
        });

        if (!existing) {
          const doc = new Ledger({
            firm_id: firmId,
            account_head: account._id.account_head,
            account_type: account._id.account_type,
            debit_amount: closing_debit,
            credit_amount: closing_credit,
            narration: 'Closing Balance',
            ref_type: 'CLOSING_BALANCE',
            transaction_date: closingDateToUse,
            created_by: actorUsername,
            is_locked: true,
          });

          await doc.save();
          closingBalances.push(doc);
        }
      } catch (err) {
        errors.push({
          account: `${account._id.account_head} (${account._id.account_type})`,
          error: err.message,
        });
      }
    }

    res.json({
      message: `Generated ${closingBalances.length} closing balance(s) for ${closingDateToUse}`,
      closing_date: closingDateToUse,
      created_count: closingBalances.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[CLOSING_BALANCE_BULK_CREATE] Error:', err);
    res.status(500).json({ error: 'Failed to create closing balances: ' + err.message });
  }
};
