import mongoose from 'mongoose';
import { ChartOfAccounts, Ledger, Party, BankAccount } from '../../../models/index.js';
import { getSql } from '../../../postgres/config/pg.config.js';
import { getCanonicalBankName } from '../../../utils/mongo/bankLedgerUtils.js';

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
      
      // 1. Join Ledger using a Smart Hybrid Match (ID prioritized over Name)
      {
        $lookup: {
          from: 'ledgers',
          let: { 
            headName: '$account_name', 
            bId: '$bank_account_id', 
            pId: '$party_id',
            fid: firmId 
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$firm_id', '$$fid'] },
                    {
                      $or: [
                        // Exact String Match (Legacy/General)
                        { $eq: ['$account_head', '$$headName'] },
                        // Bank Account ID Match (Precise)
                        {
                          $and: [
                            { $ne: ['$$bId', null] },
                            { $eq: ['$bank_account_id', '$$bId'] }
                          ]
                        },
                        // Party ID Match (Precise)
                        {
                          $and: [
                            { $ne: ['$$pId', null] },
                            { $eq: ['$party_id', '$$pId'] }
                          ]
                        }
                      ]
                    }
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
          as: 'totals'
        }
      },
      { $unwind: { path: '$totals', preserveNullAndEmptyArrays: true } },

      // 2. Project Final Real-time Position
      {
        $project: {
          account_name: 1, account_type: 1, account_code: 1, is_system: 1, opening_balance: 1, 
          party_id: 1, bank_account_id: 1,
          current_debit: { $ifNull: ['$totals.total_debit', 0] },
          current_credit: { $ifNull: ['$totals.total_credit', 0] },
          closing_balance: {
            $add: [
              { $ifNull: ['$opening_balance', 0] },
              { $subtract: [
                { $ifNull: ['$totals.total_debit', 0] },
                { $ifNull: ['$totals.total_credit', 0] }
              ]}
            ]
          }
        }
      }
    ];

    if (type) pipeline.push({ $match: { account_type: type } });
    if (search) pipeline.push({ $match: { account_name: { $regex: search, $options: 'i' } } });
    pipeline.push({ $sort: { account_type: 1, account_name: 1 } });

    const accounts = await ChartOfAccounts.aggregate(pipeline);

    res.json({ success: true, data: accounts });
  } catch (err) {
    console.error('[GET_COA_ERROR]', err);
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
 * Utility to sync existing Ledger/Party/Labor data into COA with Intelligent Consolidation
 */
export const syncCOA = async (req, res) => {
  try {
    const firmId = req.user.firm_id;
    const userId = req.user.id;
    const sql = getSql();

    let created = 0;
    let merged = 0;

    // 1. Establish Canonical Bank Heads First
    const bankAccounts = await BankAccount.find({ firm_id: firmId }).lean();
    const bankMap = new Map(); // Map variations to canonical ID/Name

    for (const bank of bankAccounts) {
      const canonicalName = getCanonicalBankName(bank);
      
      // Upsert the canonical head
      await ChartOfAccounts.findOneAndUpdate(
        { firm_id: firmId, bank_account_id: bank._id },
        { 
          $set: { 
            account_name: canonicalName,
            account_type: 'BANK',
            updated_by: userId 
          },
          $setOnInsert: { created_by: userId, opening_balance: 0 }
        },
        { upsert: true }
      );
      
      bankMap.set(bank._id.toString(), { id: bank._id, name: canonicalName });
      // Add common name variations to map
      if (bank.bank_name) bankMap.set(bank.bank_name.toLowerCase().trim(), bank._id);
      if (bank.account_name) bankMap.set(bank.account_name.toLowerCase().trim(), bank._id);
      bankMap.set(String(bank.account_number).trim(), bank._id);
    }

    // 2. Sync Parties (with party_id mapping)
    const parties = await Party.find({ firm_id: firmId }).select('firm').lean();
    for (const party of parties) {
      await ChartOfAccounts.findOneAndUpdate(
        { firm_id: firmId, party_id: party._id },
        { 
          $set: { account_name: party.firm, account_type: 'DEBTOR', updated_by: userId },
          $setOnInsert: { created_by: userId, opening_balance: 0 }
        },
        { upsert: true }
      );
    }

    // 3. Sync & Consolidate from Ledger
    const ledgerHeads = await Ledger.aggregate([
      { $match: { firm_id: new mongoose.Types.ObjectId(firmId) } },
      { $group: { 
          _id: { name: '$account_head', type: '$account_type', bank_id: '$bank_account_id' } 
      } }
    ]);

    for (const head of ledgerHeads) {
      const h = head._id;
      const lowerName = h.name.toLowerCase().trim();
      
      // Check if this ledger head is actually a bank we already synced
      let resolvedBankId = h.bank_id;
      if (!resolvedBankId) {
        // Try resolving by name variations (splitting by common delimiters)
        for (const [key, val] of bankMap.entries()) {
          if (typeof key === 'string' && (lowerName.includes(key) || key.includes(lowerName))) {
            resolvedBankId = val instanceof mongoose.Types.ObjectId ? val : (val.id || null);
            if (resolvedBankId) break;
          }
        }
      }

      if (resolvedBankId) {
        // This is a bank transaction. We already have a canonical head for this ID.
        // We do NOT create a new COA entry. If a name-only COA entry exists, we merge it.
        const existingByName = await ChartOfAccounts.findOne({ firm_id: firmId, account_name: h.name, bank_account_id: null });
        if (existingByName) {
          await ChartOfAccounts.deleteOne({ _id: existingByName._id });
          merged++;
        }
        continue;
      }

      // If not a bank, or a bank we couldn't resolve, sync normally
      const exists = await ChartOfAccounts.findOne({ firm_id: firmId, account_name: h.name });
      if (!exists) {
        await ChartOfAccounts.create({
          firm_id: firmId,
          account_name: h.name,
          account_type: h.type || 'GENERAL',
          created_by: userId,
          updated_by: userId
        });
        created++;
      }
    }

    // 4. Final Cleanup: Ensure no duplicate account names for the same firm
    // (In case legacy data created "Bank A" and "Bank A " with a space)
    const allHeads = await ChartOfAccounts.find({ firm_id: firmId }).sort({ createdAt: 1 });
    const seen = new Set();
    for (const head of allHeads) {
      const normalized = head.account_name.trim().toLowerCase();
      if (seen.has(normalized)) {
        await ChartOfAccounts.deleteOne({ _id: head._id });
        merged++;
      } else {
        seen.add(normalized);
      }
    }

    // 5. Sync Labor Leaders
    if (sql) {
      try {
        const leaders = await sql`SELECT name FROM labor_leaders WHERE firm_id = ${String(firmId)}`;
        for (const leader of leaders) {
          const exists = await ChartOfAccounts.findOne({ firm_id: firmId, account_name: leader.name });
          if (!exists) {
            await ChartOfAccounts.create({
              firm_id: firmId,
              account_name: leader.name,
              account_type: 'LABOR_LEADER',
              created_by: userId,
              updated_by: userId
            });
            created++;
          }
        }
      } catch (err) { console.warn('[COA_SYNC] Postgres fail:', err.message); }
    }

    res.json({ success: true, message: `Intelligent Sync Complete. Created: ${created}, Merged: ${merged}` });
  } catch (err) {
    console.error('[COA_SYNC] Error:', err);
    res.status(500).json({ success: false, error: 'Sync failed: ' + err.message });
  }
};
