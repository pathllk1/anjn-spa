/**
 * Wages Controller — Mongoose version
 *
 * Key changes from the SQLite version:
 *  - All db.prepare().run/get/all replaced with Mongoose model queries
 *  - db.transaction() for bulk ops replaced with individual awaited calls
 *    (same partial-success behaviour as the original)
 *  - Wage.getLastWageForEmployee replaced with Wage.findOne sort query
 *  - Wage.getByFirmAndMonth replaced with Wage.find filter
 *  - Date comparisons for eligibility work on strings (YYYY-MM-DD) — same logic as original
 *  - IDs are MongoDB ObjectIds instead of integers
 */

import { Wage, MasterRoll, Advance, WageJob } from '../../models/index.js';
import { postWageLedger, deleteWageLedger, recalculateWageLedger } from '../../utils/mongo/wagesLedgerHelper.js';
import { processWageJob } from '../../utils/mongo/wageJobProcessor.js';

/* ── HELPER FUNCTIONS ────────────────────────────────────────────────────── */

function getMonthEndDate(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const nextMonth = parseInt(month) === 12 ? '01' : String(parseInt(month) + 1).padStart(2, '0');
  const nextYear  = parseInt(month) === 12 ? parseInt(year) + 1 : year;
  const lastDay   = new Date(nextYear, parseInt(nextMonth) - 1, 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

function getMonthStartDate(yearMonth) {
  return `${yearMonth}-01`;
}

function isEmployeeEligible(employee, yearMonth) {
  const monthStart = getMonthStartDate(yearMonth);
  const monthEnd   = getMonthEndDate(yearMonth);

  if (employee.date_of_joining > monthEnd) return false;
  if (employee.date_of_exit && employee.date_of_exit < monthStart) return false;

  return true;
}

function calculateNetSalary(gross, epf, esic, otherDeduction, otherBenefit, advanceDeduction = 0) {
  return gross - ((epf ?? 0) + (esic ?? 0) + (otherDeduction ?? 0) + (advanceDeduction ?? 0)) + (otherBenefit ?? 0);
}

function calculatePerDayWage(gross, wageDays) {
  return wageDays > 0 ? parseFloat((gross / wageDays).toFixed(2)) : 0;
}

function validatePaymentFields(wage) {
  const validModes = ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'IMPS', 'UPI'];
  if (wage.payment_mode && !validModes.includes(wage.payment_mode)) {
    return 'Invalid payment mode';
  }
  
  // If payment details are provided, validation rules apply
  if (wage.payment_mode === 'CHEQUE') {
    if (!wage.cheque_no) return 'Cheque number is required for CHEQUE payment';
    if (!wage.bank_account_id) return 'Bank account is required for CHEQUE payment';
  }
  
  if (['NEFT', 'RTGS', 'IMPS', 'UPI'].includes(wage.payment_mode)) {
    if (!wage.bank_account_id) return `Bank account is required for ${wage.payment_mode} payment`;
  }

  return null;
}

/**
 * Validate advance deduction against outstanding balance
 */
async function validateAdvanceDeduction(firmId, masterRollId, advanceDeduction) {
  if (!advanceDeduction || advanceDeduction === 0) return null;

  // Get outstanding advance balance
  const advances = await Advance.find({
    firm_id: firmId,
    master_roll_id: masterRollId,
    status: { $in: ['PENDING', 'POSTED'] }
  }).lean();

  const totalAdvance = advances.reduce((sum, a) => {
    if (a.type === 'ADVANCE') return sum + (a.amount || 0);
    if (a.type === 'REPAYMENT') return sum - (a.amount || 0);
    return sum;
  }, 0);

  if (advanceDeduction > totalAdvance) {
    return `Advance deduction (₹${advanceDeduction}) exceeds outstanding balance (₹${totalAdvance})`;
  }

  return null;
}

/**
 * Validate wage days is positive
 */
function validateWageDays(wageDays) {
  if (!wageDays || wageDays <= 0) {
    return 'Wage days must be greater than 0';
  }
  if (wageDays > 31) {
    return 'Wage days cannot exceed 31';
  }
  return null;
}

/**
 * Validate gross salary is positive
 */
function validateGrossSalary(grossSalary) {
  if (!grossSalary || grossSalary <= 0) {
    return 'Gross salary must be greater than 0';
  }
  return null;
}

const MONTH_REGEX = /^\d{4}-\d{2}$/;

/* ── GET EMPLOYEES FOR WAGES ─────────────────────────────────────────────── */

export async function getEmployeesForWages(req, res) {
  try {
    const { month }  = req.body;
    const firmId     = req.user.firm_id;

    if (!month)                    return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });
    if (!MONTH_REGEX.test(month))  return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });

    // All active employees for this firm
    const employees = await MasterRoll.find({ firm_id: firmId, status: 'Active' })
      .select('employee_name aadhar bank account_no p_day_wage project site date_of_joining date_of_exit')
      .sort({ employee_name: 1 })
      .lean();

    // Employees who already have wages this month
    const paidDocs = await Wage.find({ firm_id: firmId, salary_month: month })
      .select('master_roll_id')
      .lean();

    const paidSet = new Set(paidDocs.map(d => String(d.master_roll_id)));

    const eligibleEmployees = await Promise.all(
      employees
        .filter(emp => isEmployeeEligible(emp, month) && !paidSet.has(String(emp._id)))
        .map(async emp => {
          const lastWage = await Wage.findOne({ master_roll_id: emp._id, firm_id: firmId })
            .sort({ salary_month: -1 })
            .lean();

          return {
            master_roll_id:   emp._id,
            employee_name:    emp.employee_name,
            aadhar:           emp.aadhar,
            bank:             emp.bank,
            account_no:       emp.account_no,
            p_day_wage:       emp.p_day_wage         ?? 0,
            last_p_day_wage:  lastWage?.p_day_wage   ?? (emp.p_day_wage ?? 0),
            project:          emp.project            ?? '',
            site:             emp.site               ?? '',
            last_wage_days:   lastWage?.wage_days     ?? 26,
            last_gross_salary: lastWage?.gross_salary ?? (emp.p_day_wage ?? 0) * 26,
            date_of_joining:  emp.date_of_joining,
            date_of_exit:     emp.date_of_exit,
          };
        })
    );

    res.json({
      success: true,
      data:    eligibleEmployees,
      meta: {
        total:        eligibleEmployees.length,
        total_active: employees.length,
        already_paid: paidDocs.length,
        month,
        firmId,
      },
    });
  } catch (error) {
    console.error('Error fetching employees for wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET EXISTING WAGES FOR MONTH ────────────────────────────────────────── */

export async function getExistingWagesForMonth(req, res) {
  try {
    const { month } = req.query;
    const firmId    = req.user.firm_id;

    if (!month)                   return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });
    if (!MONTH_REGEX.test(month)) return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });

    // Get wages first
    const rawWages = await Wage.find({ firm_id: firmId, salary_month: month })
      .populate('created_by', 'fullname')
      .populate('updated_by', 'fullname')
      .lean();

    // Get all unique master_roll_ids
    const masterRollIds = [...new Set(rawWages.map(w => w.master_roll_id).filter(id => id))];

    // Fetch master roll data
    const masterRolls = await MasterRoll.find({ _id: { $in: masterRollIds } })
      .select('employee_name aadhar bank account_no project site')
      .lean();

    // Create lookup map
    const masterRollMap = new Map();
    masterRolls.forEach(mr => {
      masterRollMap.set(mr._id.toString(), mr);
    });

    // Merge data — also expose _id as a plain string `id` so the frontend
    // can use wage.id consistently (lean() returns _id as ObjectId, not id).
    const wages = rawWages.map(wage => {
      const masterRoll = masterRollMap.get(wage.master_roll_id?.toString());
      if (masterRoll) {
        wage.master_roll_id = {
          ...masterRoll,
          _id: masterRoll._id,
        };
      }
      return {
        ...wage,
        id: wage._id.toString(), // normalize: frontend uses wage.id everywhere
      };
    });

    // Sort by employee name
    wages.sort((a, b) => {
      const aName = a.master_roll_id?.employee_name || '';
      const bName = b.master_roll_id?.employee_name || '';
      return aName.localeCompare(bName);
    });

    res.json({ success: true, data: wages, meta: { total: wages.length, month, firmId } });
  } catch (error) {
    console.error('Error fetching existing wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── CREATE WAGES (BULK) ─────────────────────────────────────────────────── */

export async function createWagesBulk(req, res) {
  try {
    const { month, wages } = req.body;
    const userId  = req.user.id;
    const firmId  = req.user.firm_id;

    if (!month || !Array.isArray(wages) || wages.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid wage data. Provide month and wages array.' });
    }
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });
    }

    // For batches of 20+, return error asking client to split into smaller batches
    // This ensures Vercel timeout safety (20 records × ~200ms = ~4 seconds per request)
    if (wages.length > 20) {
      return res.status(400).json({
        success: false,
        message: `Batch size too large. Maximum 20 records per request. Received ${wages.length}. Please split into multiple requests.`,
        max_batch_size: 20,
        required_batches: Math.ceil(wages.length / 20),
      });
    }

    // For small batches (< 10), process synchronously
    const session = await Wage.startSession();
    session.startTransaction();

    try {
      const results = [];

      for (const wage of wages) {
        try {
          if (!wage.master_roll_id || wage.gross_salary === undefined || !wage.wage_days) {
            results.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Missing required fields' });
            continue;
          }

          const existing = await Wage.findOne({ firm_id: firmId, master_roll_id: wage.master_roll_id, salary_month: month }).session(session).lean();
          if (existing) {
            results.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Wage already exists for this employee in this month' });
            continue;
          }

          // Validate wage days
          const wageDaysError = validateWageDays(wage.wage_days);
          if (wageDaysError) {
            results.push({ master_roll_id: wage.master_roll_id, success: false, message: wageDaysError });
            continue;
          }

          // Validate gross salary
          const grossSalaryError = validateGrossSalary(wage.gross_salary);
          if (grossSalaryError) {
            results.push({ master_roll_id: wage.master_roll_id, success: false, message: grossSalaryError });
            continue;
          }

          // Validate advance deduction
          const advanceError = await validateAdvanceDeduction(firmId, wage.master_roll_id, wage.advance_deduction);
          if (advanceError) {
            results.push({ master_roll_id: wage.master_roll_id, success: false, message: advanceError });
            continue;
          }

          // Validate payment fields
          const paymentError = validatePaymentFields(wage);
          if (paymentError) {
            results.push({ master_roll_id: wage.master_roll_id, success: false, message: paymentError });
            continue;
          }

          const employee = await MasterRoll.findOne({ _id: wage.master_roll_id, firm_id: firmId })
            .session(session)
            .select('project site')
            .lean();

          if (!employee) {
            results.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Employee not found' });
            continue;
          }

          const doc = await Wage.create([{
            firm_id:          firmId,
            master_roll_id:   wage.master_roll_id,
            p_day_wage:       calculatePerDayWage(wage.gross_salary, wage.wage_days),
            wage_days:        wage.wage_days,
            project:          employee.project           ?? null,
            site:             employee.site              ?? null,
            gross_salary:     wage.gross_salary,
            epf_deduction:    wage.epf_deduction         ?? 0,
            esic_deduction:   wage.esic_deduction        ?? 0,
            other_deduction:  wage.other_deduction       ?? 0,
            other_benefit:    wage.other_benefit         ?? 0,
            advance_deduction: wage.advance_deduction     ?? 0,
            net_salary:       calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction),
            salary_month:     month,
            paid_date:        wage.paid_date             ?? null,
            cheque_no:        wage.cheque_no             ?? null,
            bank_account_id:  wage.bank_account_id       ?? null,
            payment_mode:     wage.payment_mode          ?? null,
            status:           'DRAFT',
            created_by:       userId,
            updated_by:       userId,
          }], { session });

          const wageDoc = doc[0];

          if ((wage.advance_deduction || 0) > 0) {
            await Advance.create([{
              firm_id: firmId,
              master_roll_id: wage.master_roll_id,
              type: 'REPAYMENT',
              amount: wage.advance_deduction,
              date: wage.paid_date || new Date().toISOString().split('T')[0],
              payment_mode: 'WAGE_DEDUCTION',
              wage_id: wageDoc._id,
              remarks: `Repayment from wages - ${month}`,
              status: 'PENDING',
              created_by: userId,
              updated_by: userId
            }], { session });
          }

          try {
            const voucherId = await postWageLedger(wageDoc, session);
            
            wageDoc.voucher_group_id = voucherId;
            wageDoc.status = 'POSTED';
            wageDoc.posted_date = new Date();
            wageDoc.posted_by = userId;
            await wageDoc.save({ session });

            results.push({ master_roll_id: wage.master_roll_id, wage_id: wageDoc._id, voucher_id: voucherId, success: true });
          } catch (ledgerError) {
            await session.abortTransaction();
            return res.status(500).json({ 
              success: false, 
              message: `Ledger posting failed: ${ledgerError.message}`,
              details: { master_roll_id: wage.master_roll_id }
            });
          }

        } catch (error) {
          results.push({ master_roll_id: wage.master_roll_id, success: false, message: error.message });
        }
      }

      await session.commitTransaction();

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.json({
        success: true,
        message: `Wages created successfully. Success: ${successCount}, Failed: ${failureCount}`,
        results,
        meta:    { total: wages.length, success: successCount, failed: failureCount, month },
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Error creating wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── UPDATE SINGLE WAGE ──────────────────────────────────────────────────── */

export async function updateWage(req, res) {
  const session = await Wage.startSession();
  session.startTransaction();

  try {
    const { id }     = req.params;
    const userId     = req.user.id;
    const firmId     = req.user.firm_id;

    const { wage_days, gross_salary, epf_deduction, esic_deduction,
            other_deduction, other_benefit, advance_deduction, paid_date, cheque_no, bank_account_id, payment_mode } = req.body;

    if (!wage_days || gross_salary === undefined) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'wage_days and gross_salary are required' });
    }

    const paymentError = validatePaymentFields(req.body);
    if (paymentError) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: paymentError });
    }

    const existingWage = await Wage.findOne({ _id: id, firm_id: firmId }).session(session);
    if (!existingWage) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    }

    // If wage is locked, cannot update
    if (existingWage.status === 'LOCKED') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Wage is locked and cannot be updated' });
    }

    // Delete old ledger entries if wage was posted
    if (existingWage.status === 'POSTED') {
      try {
        await deleteWageLedger(existingWage._id, firmId, session);
      } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: `Failed to delete old ledger entries: ${error.message}` });
      }
    }

    // Update wage fields
    existingWage.p_day_wage       = calculatePerDayWage(gross_salary, wage_days);
    existingWage.wage_days        = wage_days;
    existingWage.gross_salary     = gross_salary;
    existingWage.epf_deduction    = epf_deduction    ?? 0;
    existingWage.esic_deduction   = esic_deduction   ?? 0;
    existingWage.other_deduction  = other_deduction  ?? 0;
    existingWage.other_benefit    = other_benefit    ?? 0;
    existingWage.advance_deduction = advance_deduction ?? 0;
    existingWage.net_salary       = calculateNetSalary(gross_salary, epf_deduction, esic_deduction, other_deduction, other_benefit, advance_deduction);
    existingWage.paid_date        = paid_date        ?? null;
    existingWage.cheque_no        = cheque_no        ?? null;
    existingWage.bank_account_id  = bank_account_id  ?? null;
    existingWage.payment_mode     = payment_mode     ?? null;
    existingWage.updated_by       = userId;

    // Post new ledger entries if wage was posted
    if (existingWage.status === 'POSTED') {
      try {
        const voucherId = await postWageLedger(existingWage, session);
        existingWage.voucher_group_id = voucherId;
        existingWage.posted_date = new Date();
        existingWage.posted_by = userId;
      } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: `Failed to post new ledger entries: ${error.message}` });
      }
    }

    await existingWage.save({ session });

    // Sync Advance model repayment
    if (existingWage.advance_deduction > 0) {
      await Advance.findOneAndUpdate(
        { wage_id: existingWage._id, type: 'REPAYMENT' },
        {
          firm_id: firmId,
          master_roll_id: existingWage.master_roll_id,
          type: 'REPAYMENT',
          amount: existingWage.advance_deduction,
          date: existingWage.paid_date || new Date().toISOString().split('T')[0],
          payment_mode: 'WAGE_DEDUCTION',
          wage_id: existingWage._id,
          remarks: `Repayment from wages - ${existingWage.salary_month}`,
          updated_by: userId,
          $setOnInsert: { created_by: userId }
        },
        { upsert: true, session }
      );
    } else {
      await Advance.deleteOne({ wage_id: existingWage._id, type: 'REPAYMENT' }, { session });
    }

    await session.commitTransaction();

    res.json({ success: true, message: 'Wage updated successfully', data: existingWage });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  } finally {
    await session.endSession();
  }
}

/* ── BULK UPDATE WAGES ───────────────────────────────────────────────────── */

export async function updateWagesBulk(req, res) {
  const session = await Wage.startSession();
  session.startTransaction();

  try {
    const { wages } = req.body;
    const userId    = req.user.id;
    const firmId    = req.user.firm_id;

    if (!Array.isArray(wages) || wages.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid wage data. Provide wages array.' });
    }

    const results = [];

    for (const wage of wages) {
      try {
        if (!wage.id || !wage.wage_days || wage.gross_salary === undefined) {
          results.push({ id: wage.id, success: false, message: 'Missing required fields: id, wage_days, gross_salary' });
          continue;
        }

        const paymentError = validatePaymentFields(wage);
        if (paymentError) {
          results.push({ id: wage.id, success: false, message: paymentError });
          continue;
        }

        const doc = await Wage.findOne({ _id: wage.id, firm_id: firmId }).session(session);
        if (!doc) {
          results.push({ id: wage.id, success: false, message: 'Wage record not found or access denied' });
          continue;
        }

        // If wage is locked, cannot update
        if (doc.status === 'LOCKED') {
          results.push({ id: wage.id, success: false, message: 'Wage is locked and cannot be updated' });
          continue;
        }

        // Delete old ledger entries if wage was posted
        if (doc.status === 'POSTED') {
          try {
            await deleteWageLedger(doc._id, firmId, session);
          } catch (error) {
            results.push({ id: wage.id, success: false, message: `Failed to delete old ledger: ${error.message}` });
            continue;
          }
        }

        // Update wage
        doc.p_day_wage        = calculatePerDayWage(wage.gross_salary, wage.wage_days);
        doc.wage_days         = wage.wage_days;
        doc.gross_salary      = wage.gross_salary;
        doc.epf_deduction     = wage.epf_deduction    ?? 0;
        doc.esic_deduction    = wage.esic_deduction   ?? 0;
        doc.other_deduction   = wage.other_deduction  ?? 0;
        doc.other_benefit     = wage.other_benefit    ?? 0;
        doc.advance_deduction = wage.advance_deduction ?? 0;
        doc.net_salary        = calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction);
        doc.paid_date         = wage.paid_date        ?? null;
        doc.cheque_no         = wage.cheque_no        ?? null;
        doc.bank_account_id   = wage.bank_account_id  ?? null;
        doc.payment_mode      = wage.payment_mode     ?? null;
        doc.updated_by        = userId;

        // Post new ledger entries if wage was posted
        if (doc.status === 'POSTED') {
          try {
            const voucherId = await postWageLedger(doc, session);
            doc.voucher_group_id = voucherId;
            doc.posted_date = new Date();
            doc.posted_by = userId;
          } catch (error) {
            results.push({ id: wage.id, success: false, message: `Failed to post new ledger: ${error.message}` });
            continue;
          }
        }

        await doc.save({ session });

        // Sync Advance model repayment
        if (doc.advance_deduction > 0) {
          await Advance.findOneAndUpdate(
            { wage_id: doc._id, type: 'REPAYMENT' },
            {
              firm_id: firmId,
              master_roll_id: doc.master_roll_id,
              type: 'REPAYMENT',
              amount: doc.advance_deduction,
              date: doc.paid_date || new Date().toISOString().split('T')[0],
              payment_mode: 'WAGE_DEDUCTION',
              wage_id: doc._id,
              remarks: `Repayment from wages - ${doc.salary_month}`,
              updated_by: userId,
              $setOnInsert: { created_by: userId }
            },
            { upsert: true, session }
          );
        } else {
          await Advance.deleteOne({ wage_id: doc._id, type: 'REPAYMENT' }, { session });
        }

        results.push({ id: wage.id, success: true, message: 'Updated' });
      } catch (error) {
        results.push({ id: wage.id, success: false, message: error.message });
      }
    }

    await session.commitTransaction();

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Wages updated successfully. Success: ${successCount}, Failed: ${results.length - successCount}`,
      results,
      meta:    { total: wages.length, success: successCount, failed: results.length - successCount },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error bulk updating wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  } finally {
    await session.endSession();
  }
}

/* ── DELETE SINGLE WAGE ──────────────────────────────────────────────────── */

export async function deleteWage(req, res) {
  const session = await Wage.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const firmId = req.user.firm_id;

    const deleted = await Wage.findOneAndDelete({ _id: id, firm_id: firmId }, { session });
    if (!deleted) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    }

    // Delete ledger entries if wage was posted
    if (deleted.status === 'POSTED') {
      try {
        await deleteWageLedger(deleted._id, firmId, session);
      } catch (error) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: `Failed to delete ledger entries: ${error.message}` });
      }
    }

    // Delete advance repayment linked to this wage
    await Advance.deleteMany({ wage_id: id }, { session });

    await session.commitTransaction();

    res.json({ success: true, message: 'Wage deleted successfully', deletedId: id });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  } finally {
    await session.endSession();
  }
}

/* ── BULK DELETE WAGES ───────────────────────────────────────────────────── */

export async function deleteWagesBulk(req, res) {
  const session = await Wage.startSession();
  session.startTransaction();

  try {
    const { ids } = req.body;
    const firmId  = req.user.firm_id;

    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid data. Provide ids array.' });
    }

    const results = [];

    for (const id of ids) {
      try {
        const deleted = await Wage.findOneAndDelete({ _id: id, firm_id: firmId }, { session });
        if (deleted) {
          // Delete ledger entries if wage was posted
          if (deleted.status === 'POSTED') {
            try {
              await deleteWageLedger(deleted._id, firmId, session);
            } catch (error) {
              throw new Error(`Failed to delete ledger entries: ${error.message}`);
            }
          }

          // Delete advance repayment
          await Advance.deleteMany({ wage_id: id }, { session });
          results.push({ id, success: true,  message: 'Deleted' });
        } else {
          results.push({ id, success: false, message: 'Wage record not found or access denied' });
        }
      } catch (error) {
        results.push({ id, success: false, message: error.message });
      }
    }

    await session.commitTransaction();

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Wages deleted successfully. Success: ${successCount}, Failed: ${results.length - successCount}`,
      results,
      meta:    { total: ids.length, success: successCount, failed: results.length - successCount },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error bulk deleting wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  } finally {
    await session.endSession();
  }
}

/* ── GET WAGE BY ID ──────────────────────────────────────────────────────── */

export async function getWageById(req, res) {
  try {
    const wage = await Wage.findOne({ _id: req.params.id, firm_id: req.user.firm_id }).lean();
    if (!wage) return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    res.json({ success: true, data: wage });
  } catch (error) {
    console.error('Error fetching wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET WAGES HISTORY FOR EMPLOYEE ───────────────────────────────────────── */

export async function getWagesHistoryForEmployee(req, res) {
  try {
    const { masterRollId } = req.params;
    const firmId = req.user.firm_id;

    if (!masterRollId) {
      return res.status(400).json({ success: false, message: 'Master roll ID is required' });
    }

    // Verify the employee belongs to the user's firm
    const employee = await MasterRoll.findOne({ _id: masterRollId, firm_id: firmId })
      .select('employee_name')
      .lean();

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found or access denied' });
    }

    // Get all wages for this employee, sorted by month descending
    const wages = await Wage.find({ master_roll_id: masterRollId, firm_id: firmId })
      .select('salary_month wage_days gross_salary net_salary epf_deduction esic_deduction other_deduction other_benefit paid_date')
      .sort({ salary_month: -1 })
      .lean();

    // Format the data for frontend
    const history = wages.map(wage => ({
      id: wage._id.toString(),
      month: wage.salary_month,
      wage_days: wage.wage_days,
      gross_salary: wage.gross_salary,
      net_salary: wage.net_salary,
      epf_deduction: wage.epf_deduction,
      esic_deduction: wage.esic_deduction,
      other_deduction: wage.other_deduction,
      other_benefit: wage.other_benefit,
      paid_date: wage.paid_date
    }));

    res.json({
      success: true,
      data: {
        employee: {
          id: masterRollId,
          name: employee.employee_name
        },
        history: history,
        totalRecords: history.length
      }
    });
  } catch (error) {
    console.error('Error fetching wages history:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET WAGES FOR MONTH (deprecated — use getExistingWagesForMonth) ─────── */

export async function getWagesForMonth(req, res) {
  try {
    const { month } = req.query;
    const firmId    = req.user.firm_id;

    if (!month) return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });

    const wages = await Wage.find({ firm_id: firmId, salary_month: month })
      .populate('master_roll_id', 'employee_name aadhar bank account_no project site')
      .populate('created_by',     'fullname')
      .populate('updated_by',     'fullname');

    // Sort by employee name after population
    wages.sort((a, b) =>
      (a.master_roll_id?.employee_name ?? '').localeCompare(b.master_roll_id?.employee_name ?? '')
    );

    res.json({ success: true, data: wages, meta: { total: wages.length, month } });
  } catch (error) {
    console.error('Error fetching wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET WAGE JOB STATUS ─────────────────────────────────────────────────── */

export async function getWageJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    const firmId = req.user.firm_id;

    const job = await WageJob.findOne({ _id: jobId, firm_id: firmId }).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({
      success: true,
      data: {
        job_id: job._id,
        status: job.status,
        salary_month: job.salary_month,
        total_wages: job.total_wages,
        processed_wages: job.processed_wages,
        failed_wages: job.failed_wages,
        progress_percentage: job.progress_percentage,
        started_at: job.started_at,
        completed_at: job.completed_at,
        duration_ms: job.duration_ms,
        error_message: job.error_message,
      },
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET WAGE JOB RESULTS ────────────────────────────────────────────────── */

export async function getWageJobResults(req, res) {
  try {
    const { jobId } = req.params;
    const firmId = req.user.firm_id;

    const job = await WageJob.findOne({ _id: jobId, firm_id: firmId }).lean();
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'COMPLETED' && job.status !== 'FAILED') {
      return res.status(400).json({ success: false, message: 'Job is still processing' });
    }

    res.json({
      success: true,
      data: {
        job_id: job._id,
        status: job.status,
        total_wages: job.total_wages,
        processed_wages: job.processed_wages,
        failed_wages: job.failed_wages,
        results: job.results,
        error_message: job.error_message,
      },
    });
  } catch (error) {
    console.error('Error fetching job results:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}