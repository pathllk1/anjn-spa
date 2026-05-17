import mongoose from 'mongoose';
import { Ledger, Firm, BankAccount, ChartOfAccounts } from '../../../models/index.js';
import { getCanonicalBankName } from '../../../utils/mongo/bankLedgerUtils.js';
export {
  exportAccountLedgerPdf,
  exportGeneralLedgerPdf,
  exportTrialBalancePdf,
  exportAccountTypePdf,
  exportProfitLossPdf,
  exportBalanceSheetPdf,
}
  from './pdfMakeController.js';
  

/* ── GET LEDGER ACCOUNTS (grouped summary per account_head) ──────────── */

export const getLedgerAccounts = async (req, res) => {
  try {
    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    const fid = new mongoose.Types.ObjectId(req.user.firm_id);
    const { start_date, end_date } = req.query;

    const matchStage = { firm_id: fid };
    if (start_date || end_date) {
      matchStage.transaction_date = {};
      if (start_date) matchStage.transaction_date.$gte = start_date;
      if (end_date)   matchStage.transaction_date.$lte = end_date;
    }

    // Get ledger accounts (include all transactions including opening balances)
    const ledgerAccounts = await Ledger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            account_head: '$account_head',
            account_type: '$account_type',
            bank_account_id: { $cond: [ { $eq: ['$account_type', 'BANK'] }, '$bank_account_id', null ] }
          },
          total_debit:  { $sum: '$debit_amount'  },
          total_credit: { $sum: '$credit_amount' },
        },
      },
      {
        $lookup: {
          from: BankAccount.collection.name,
          localField: '_id.bank_account_id',
          foreignField: '_id',
          as: 'bank_account',
        },
      },
      {
        $project: {
          _id:          0,
          account_head: {
            $cond: [
              {
                $and: [
                  { $eq: ['$_id.account_type', 'BANK'] },
                  { $gt: [{ $size: '$bank_account' }, 0] },
                ],
              },
              {
                $let: {
                  vars: {
                    b: { $arrayElemAt: ['$bank_account', 0] }
                  },
                  in: {
                    $concat: [
                      { $toUpper: { $ifNull: ['$$b.bank_name', 'Bank'] } },
                      ' (A/c ...',
                      { $let: {
                        vars: { acc: { $ifNull: ['$$b.account_number', '0000'] } },
                        in: { $substr: ['$$acc', { $subtract: [{ $strLenCP: '$$acc' }, 4] }, 4] }
                      }},
                      ')'
                    ]
                  }
                }
              },
              '$_id.account_head',
            ],
          },
          account_type: '$_id.account_type',
          total_debit:  1,
          total_credit: 1,
          balance:      { $subtract: ['$total_debit', '$total_credit'] },
        },
      },
      { $sort: { account_head: 1 } },
    ]);

    // FIX: Opening balances are now included in the main query above.
    // When start_date is provided, the balance calculation automatically includes
    // all transactions from the beginning (including opening balance entries),
    // so the balance before start_date is naturally represented.
    // No separate merge logic needed.

    const accounts = ledgerAccounts.sort((a, b) => 
      a.account_head.localeCompare(b.account_head)
    );

    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET ACCOUNT DETAILS (individual ledger rows, ASC for running balance) */

export const getAccountDetails = async (req, res) => {
  try {
    const { account_head }        = req.params;
    const { start_date, end_date } = req.query;

    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    const firmId = req.user.firm_id;

    // 1. Resolve Bank Account if applicable
    let bankAc = await BankAccount.findOne({ 
      firm_id: firmId, 
      $or: [
        { bank_name: account_head },
        { account_name: account_head }
      ] 
    }).lean();

    // 2. If not found by name, try parsing if it follows older formats (Bank - Acc)
    if (!bankAc && account_head.includes(' - ')) {
      const parts = account_head.split(' - ');
      const accNo = parts.pop();
      bankAc = await BankAccount.findOne({ 
        firm_id: firmId, 
        account_number: accNo.trim()
      }).lean();
    }

    // 3. Robust Filter: Find by Canonical Name OR Bank ID
    const filter = { firm_id: firmId };
    const searchHeads = [account_head];
    
    if (bankAc) {
      searchHeads.push(getCanonicalBankName(bankAc));
      filter.$or = [
        { account_head: { $in: searchHeads } },
        { bank_account_id: bankAc._id }
      ];
    } else {
      filter.account_head = account_head;
    }

    // Calculate opening balance (all transactions before start_date)
    let openingBalance = 0;
    if (start_date) {
      const openingFilter = { 
        ...filter, 
        transaction_date: { $lt: start_date }
      };
      
      const openingRecords = await Ledger.find(openingFilter).lean();
      openingBalance = openingRecords.reduce((sum, r) => {
        return sum + (r.debit_amount || 0) - (r.credit_amount || 0);
      }, 0);
    }

    if (start_date) filter.transaction_date = { ...filter.transaction_date, $gte: start_date };
    if (end_date)   filter.transaction_date = { ...filter.transaction_date, $lte: end_date };

    const records = await Ledger.find(filter)
      .sort({ transaction_date: 1, createdAt: 1 })
      .lean();

    // FIX: Return both records and opening balance for client-side calculation
    res.json({
      opening_balance: openingBalance,
      records: records
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET ACCOUNT TYPE SUMMARIES ──────────────────────────────────────── */

export const getAccountTypeSummaries = async (req, res) => {
  try {
    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    const fid = new mongoose.Types.ObjectId(req.user.firm_id);
    const { start_date, end_date } = req.query;

    const matchStage = { firm_id: fid };
    if (start_date || end_date) {
      matchStage.transaction_date = {};
      if (start_date) matchStage.transaction_date.$gte = start_date;
      if (end_date)   matchStage.transaction_date.$lte = end_date;
    }

    const summaries = await Ledger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:          { account_head: '$account_head', account_type: '$account_type' },
          total_debit:  { $sum: '$debit_amount'  },
          total_credit: { $sum: '$credit_amount' },
        },
      },
      {
        $group: {
          _id:           '$_id.account_type',
          account_count: { $sum: 1 },
          total_debit:   { $sum: '$total_debit'  },
          total_credit:  { $sum: '$total_credit' },
          total_balance: { $sum: { $subtract: ['$total_debit', '$total_credit'] } },
        },
      },
      {
        $project: {
          _id:           0,
          account_type:  '$_id',
          account_count: 1,
          total_debit:   1,
          total_credit:  1,
          total_balance: 1,
        },
      },
      { $sort: { account_type: 1 } },
    ]);

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET ACCOUNT SUGGESTIONS (autocomplete) ──────────────────────────── */

export const getAccountSuggestions = async (req, res) => {
  try {
    if (!req.user?.firm_id) {
      return res.status(403).json({ error: 'User is not associated with any firm' });
    }

    const { q } = req.query;

    const fid = new mongoose.Types.ObjectId(req.user.firm_id);

    const matchStage = { firm_id: fid };
    if (q?.trim()) {
      matchStage.account_head = { $regex: q.trim(), $options: 'i' };
    }

    const suggestions = await Ledger.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { account_head: '$account_head', account_type: '$account_type' },
        },
      },
      {
        $project: {
          _id:          0,
          account_head: '$_id.account_head',
          account_type: '$_id.account_type',
        },
      },
      { $sort:  { account_head: 1 } },
      { $limit: 20 },
    ]);

    res.json(suggestions);
  } catch (err) {
    console.error('[ACCOUNT_SUGGESTIONS] Error:', err);
    res.status(500).json({ error: err.message });
  }
};
