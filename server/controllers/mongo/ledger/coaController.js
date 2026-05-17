import mongoose from 'mongoose';
import { ChartOfAccounts, Ledger, Party, BankAccount } from '../../../models/index.js';
import { getSql } from '../../../postgres/config/pg.config.js';

/**
 * GET /api/ledger/coa
 * Get all account heads in the Chart of Accounts
 */
export const getCOA = async (req, res) => {
  try {
    const firmId = new mongoose.Types.ObjectId(req.user.firm_id);
    const { search, type } = req.query;

    const pipeline = [
      { $match: { firm_id: firmId } },
      // Join with Ledger to get live totals
      {
        $lookup: {
          from: 'ledgers',
          let: { headName: '$account_name' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$firm_id', firmId] },
                    { $eq: ['$account_head', '$$headName'] }
                  ]
                }
              } 
            },
            {
              $group: {
                _id: null,
                total_debit: { $sum: '$debit_amount' },
                total_credit: { $sum: '$credit_amount' }
              }
            }
          ],
          as: 'ledger_totals'
        }
      },
      { $unwind: { path: '$ledger_totals', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          current_debit: { $ifNull: ['$ledger_totals.total_debit', 0] },
          current_credit: { $ifNull: ['$ledger_totals.total_credit', 0] },
          closing_balance: {
            $add: [
              { $ifNull: ['$opening_balance', 0] },
              { $subtract: [
                { $ifNull: ['$ledger_totals.total_debit', 0] },
                { $ifNull: ['$ledger_totals.total_credit', 0] }
              ]}
            ]
          }
        }
      }
    ];

    if (type) {
      pipeline.push({ $match: { account_type: type } });
    }
    if (search) {
      pipeline.push({ $match: { account_name: { $regex: search, $options: 'i' } } });
    }

    pipeline.push({ $sort: { account_type: 1, account_name: 1 } });

    const accounts = await ChartOfAccounts.aggregate(pipeline);

    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/ledger/coa
 * Create a new account head
 */
export const createCOA = async (req, res) => {
  try {
    const firmId = req.user.firm_id;
    const userId = req.user.id;
    const { account_name, account_type, account_code, description, opening_balance } = req.body;

    if (!account_name || !account_type) {
      return res.status(400).json({ success: false, error: 'Account name and type are required' });
    }

    const newAccount = await ChartOfAccounts.create({
      firm_id: firmId,
      account_name,
      account_type,
      account_code,
      description,
      opening_balance: opening_balance || 0,
      created_by: userId,
      updated_by: userId
    });

    res.json({ success: true, data: newAccount });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Account name already exists for this firm' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * PUT /api/ledger/coa/:id
 * Update an existing account head
 */
export const updateCOA = async (req, res) => {
  try {
    const { id } = req.params;
    const firmId = req.user.firm_id;
    const userId = req.user.id;
    const updates = req.body;

    // Remove system fields
    delete updates.firm_id;
    delete updates.created_by;
    delete updates.is_system;

    const account = await ChartOfAccounts.findOneAndUpdate(
      { _id: id, firm_id: firmId, is_system: false },
      { ...updates, updated_by: userId },
      { new: true, runValidators: true }
    );

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found or is a protected system account' });
    }

    res.json({ success: true, data: account });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * DELETE /api/ledger/coa/:id
 * Delete an account head
 */
export const deleteCOA = async (req, res) => {
  try {
    const { id } = req.params;
    const firmId = req.user.firm_id;

    // Check if account is in use in Ledger
    const account = await ChartOfAccounts.findOne({ _id: id, firm_id: firmId });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    
    if (account.is_system) {
      return res.status(403).json({ success: false, error: 'Cannot delete protected system accounts' });
    }

    const inUse = await Ledger.findOne({ firm_id: firmId, account_head: account.account_name });
    if (inUse) {
      return res.status(400).json({ success: false, error: 'Cannot delete account that has ledger entries. Please delete transactions first.' });
    }

    await ChartOfAccounts.deleteOne({ _id: id });
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/ledger/coa/sync
 * Utility to sync existing Ledger/Party/Labor data into COA
 */
export const syncCOA = async (req, res) => {
  try {
    const firmId = req.user.firm_id;
    const userId = req.user.id;
    const sql = getSql();

    // 1. Get unique account heads from Ledger
    const ledgerHeads = await Ledger.aggregate([
      { $match: { firm_id: new mongoose.Types.ObjectId(firmId) } },
      { $group: { _id: { name: '$account_head', type: '$account_type' } } }
    ]);

    // 2. Get unique firms from Party (MongoDB)
    const parties = await Party.find({ firm_id: firmId }).select('firm').lean();

    // 3. Get Bank Accounts from Master
    const bankAccounts = await BankAccount.find({ firm_id: firmId, status: 'ACTIVE' }).lean();

    // 4. Get Labor Leaders from PostgreSQL (Resilient check)
    let leaders = [];
    if (sql) {
      try {
        leaders = await sql`SELECT name FROM labor_leaders WHERE firm_id = ${String(firmId)}`;
      } catch (pgErr) {
        console.warn('[COA_SYNC] Postgres lookup failed, skipping labor leaders:', pgErr.message);
      }
    }

    let created = 0;
    let skipped = 0;

    // Helper to create COA head
    const createHead = async (name, type) => {
      if (!name) return;
      const exists = await ChartOfAccounts.findOne({ firm_id: firmId, account_name: name });
      if (!exists) {
        await ChartOfAccounts.create({
          firm_id: firmId,
          account_name: name,
          account_type: type,
          created_by: userId,
          updated_by: userId
        });
        created++;
      } else {
        skipped++;
      }
    };

    // Sync Ledger Heads
    for (const head of ledgerHeads) {
      await createHead(head._id.name, head._id.type || 'GENERAL');
    }

    // Sync Parties
    for (const party of parties) {
      await createHead(party.firm, 'DEBTOR');
    }

    // Sync Bank Accounts (Canonical)
    for (const bank of bankAccounts) {
      await createHead(getCanonicalBankName(bank), 'BANK');
    }

    // Sync Labor Leaders
    for (const leader of leaders) {
      await createHead(leader.name, 'LABOR_LEADER');
    }

    res.json({ success: true, message: `Sync complete. Created: ${created}, Skipped: ${skipped}` });
  } catch (err) {
    console.error('[COA_SYNC] Error:', err);
    res.status(500).json({ success: false, error: 'Sync failed: ' + err.message });
  }
};
