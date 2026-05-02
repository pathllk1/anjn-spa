import { Advance, MasterRoll } from '../../models/index.js';
import mongoose from 'mongoose';
import { postAdvanceLedger, deleteAdvanceLedger } from '../../utils/mongo/advanceLedgerHelper.js';

/**
 * Get active advance balance for an employee
 */
export async function getEmployeeAdvanceBalance(req, res) {
  try {
    const { masterRollId } = req.params;
    const firmId = req.user.firm_id;

    const pipeline = [
      { $match: { master_roll_id: new mongoose.Types.ObjectId(masterRollId), firm_id: new mongoose.Types.ObjectId(firmId) } },
      {
        $group: {
          _id: null,
          totalAdvance: {
            $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', 0] }
          },
          totalRepayment: {
            $sum: { $cond: [{ $eq: ['$type', 'REPAYMENT'] }, '$amount', 0] }
          }
        }
      }
    ];

    const result = await Advance.aggregate(pipeline);
    
    if (result.length === 0) {
      return res.json({ success: true, balance: 0 });
    }

    const balance = result[0].totalAdvance - result[0].totalRepayment;
    res.json({ success: true, balance });
  } catch (error) {
    console.error('Error fetching advance balance:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Get advance history for an employee
 */
export async function getEmployeeAdvanceHistory(req, res) {
  try {
    const { masterRollId } = req.params;
    const firmId = req.user.firm_id;

    const history = await Advance.find({ 
      master_roll_id: masterRollId, 
      firm_id: firmId 
    })
    .sort({ date: -1, createdAt: -1 })
    .lean();

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching advance history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Get all employee balances for a firm (Bulk)
 */
export async function getAllEmployeeBalances(req, res) {
  try {
    const firmId = req.user.firm_id;

    const pipeline = [
      { $match: { firm_id: new mongoose.Types.ObjectId(firmId) } },
      {
        $group: {
          _id: '$master_roll_id',
          totalAdvance: {
            $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', 0] }
          },
          totalRepayment: {
            $sum: { $cond: [{ $eq: ['$type', 'REPAYMENT'] }, '$amount', 0] }
          }
        }
      },
      {
        $project: {
          masterRollId: '$_id',
          balance: { $subtract: ['$totalAdvance', '$totalRepayment'] }
        }
      }
    ];

    const results = await Advance.aggregate(pipeline);
    const balanceMap = {};
    results.forEach(r => {
      balanceMap[r.masterRollId] = r.balance;
    });

    res.json({ success: true, balances: balanceMap });
  } catch (error) {
    console.error('Error fetching bulk balances:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Record a new advance (Disbursement)
 */
export async function recordAdvance(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { masterRollId, amount, date, paymentMode, remarks, bankDetails, bankAccountId, type } = req.body;
    const firmId = req.user.firm_id;
    const userId = req.user.id;
    const finalType = type || 'ADVANCE';

    if (!masterRollId || !amount || !date) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const numAmount = parseFloat(amount);

    // If repayment, check against outstanding balance
    if (finalType === 'REPAYMENT') {
      const pipeline = [
        { $match: { firm_id: new mongoose.Types.ObjectId(firmId), master_roll_id: new mongoose.Types.ObjectId(masterRollId) } },
        {
          $group: {
            _id: '$master_roll_id',
            balance: {
              $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', { $subtract: [0, '$amount'] }] }
            }
          }
        }
      ];
      const balResult = await Advance.aggregate(pipeline).session(session);
      const currentBalance = balResult.length > 0 ? balResult[0].balance : 0;

      if (numAmount > currentBalance) {
        await session.abortTransaction();
        return res.status(400).json({ 
          success: false, 
          message: `Repayment (₹${numAmount}) exceeds outstanding balance (₹${currentBalance.toFixed(2)})` 
        });
      }
    }

    const doc = new Advance({
      firm_id: firmId,
      master_roll_id: masterRollId,
      type: finalType,
      amount: numAmount,
      date,
      payment_mode: paymentMode || 'CASH',
      bank_account_id: bankAccountId,
      bank_account_details: bankDetails,
      remarks,
      created_by: userId,
      updated_by: userId
    });

    // Save advance document
    await doc.save({ session });

    // Post to ledger
    try {
      const voucherGroupId = await postAdvanceLedger(doc, session);
      doc.voucher_group_id = voucherGroupId;
      await doc.save({ session });
    } catch (ledgerError) {
      console.error('Ledger posting failed for advance:', ledgerError);
      await session.abortTransaction();
      return res.status(500).json({ success: false, message: `Ledger posting failed: ${ledgerError.message}` });
    }

    await session.commitTransaction();
    res.status(201).json({ success: true, message: 'Advance recorded and posted to ledger', data: doc });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error recording advance:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  } finally {
    session.endSession();
  }
}

/**
 * Delete an advance record
 */
export async function deleteAdvanceRecord(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { id } = req.params;
    const firmId = req.user.firm_id;

    const record = await Advance.findOne({ _id: id, firm_id: firmId }).session(session);
    if (!record) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    if (record.payment_mode === 'WAGE_DEDUCTION' && record.wage_id) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete a wage deduction repayment from here. Edit the wage record instead.' 
      });
    }

    // Delete ledger entries
    await deleteAdvanceLedger(record._id, firmId, session);

    // Delete advance record
    await record.deleteOne({ session });

    await session.commitTransaction();
    res.json({ success: true, message: 'Record deleted and ledger cleaned' });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting advance record:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
}
