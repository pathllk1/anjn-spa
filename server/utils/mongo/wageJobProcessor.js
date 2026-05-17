/**
 * Wage Job Processor - Handles bulk wage creation with Atomic Iterator pattern
 * 
 * Optimized for Vercel/Serverless:
 * - initiateWageJob: Stages data and returns jobId
 * - processWageJobStep: Processes exactly ONE batch and returns progress
 * - processWageJob: Original long-running loop (for non-serverless environments)
 */

import { Wage, MasterRoll, Advance, WageJob } from '../../models/index.js';
import { postWageLedger } from './wagesLedgerHelper.js';

const DEFAULT_BATCH_SIZE = 5;

/**
 * Initiate a wage job
 * @returns {Promise<ObjectId>} Job ID
 */
export async function initiateWageJob(firmId, userId, salaryMonth, wagesData) {
  const job = await WageJob.create({
    firm_id: firmId,
    user_id: userId,
    salary_month: salaryMonth,
    total_wages: wagesData.length,
    wages_data: wagesData,
    status: 'PENDING',
    current_index: 0,
    processed_wages: 0,
    failed_wages: 0,
    results: []
  });
  return job._id;
}

/**
 * Process a single batch for a job (The Atomic Step)
 * @param {ObjectId} jobId 
 * @param {ObjectId} firmId 
 * @param {number} batchSize 
 * @returns {Promise<Object>} Job status after step
 */
export async function processWageJobStep(jobId, firmId, batchSize = DEFAULT_BATCH_SIZE) {
  const job = await WageJob.findOne({ _id: jobId, firm_id: firmId });
  if (!job) throw new Error('Job not found');
  if (job.status === 'COMPLETED' || job.status === 'FAILED') return job;

  const session = await Wage.startSession();
  const startTime = new Date();

  try {
    if (job.status === 'PENDING') {
      job.status = 'PROCESSING';
      job.started_at = startTime;
      await job.save();
    }

    const startIdx = job.current_index;
    const endIdx = Math.min(startIdx + batchSize, job.total_wages);
    const batch = job.wages_data.slice(startIdx, endIdx);

    const stepResults = [];
    let stepProcessed = 0;
    let stepFailed = 0;

    session.startTransaction();

    for (const wage of batch) {
      try {
        if (!wage.master_roll_id || wage.gross_salary === undefined || !wage.wage_days) {
          stepResults.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Missing fields' });
          stepFailed++;
          continue;
        }

        // Duplicate check
        const existing = await Wage.findOne({
          firm_id: firmId,
          master_roll_id: wage.master_roll_id,
          salary_month: job.salary_month,
        }).session(session).lean();

        if (existing) {
          stepResults.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Already exists' });
          stepFailed++;
          continue;
        }

        // Fetch employee
        const employee = await MasterRoll.findOne({
          _id: wage.master_roll_id,
          firm_id: firmId,
        }).session(session).select('employee_name project site').lean();

        if (!employee) {
          stepResults.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Not found' });
          stepFailed++;
          continue;
        }

        const netSalary = (wage.gross_salary || 0) -
          ((wage.epf_deduction || 0) + (wage.esic_deduction || 0) + (wage.other_deduction || 0) + (wage.advance_deduction || 0)) +
          (wage.other_benefit || 0);

        const [doc] = await Wage.create([{
          firm_id: firmId,
          master_roll_id: wage.master_roll_id,
          p_day_wage: (wage.gross_salary || 0) / (wage.wage_days || 26),
          wage_days: wage.wage_days || 26,
          project: employee.project ?? null,
          site: employee.site ?? null,
          gross_salary: wage.gross_salary,
          epf_deduction: wage.epf_deduction ?? 0,
          esic_deduction: wage.esic_deduction ?? 0,
          other_deduction: wage.other_deduction ?? 0,
          other_benefit: wage.other_benefit ?? 0,
          advance_deduction: wage.advance_deduction ?? 0,
          net_salary: netSalary,
          salary_month: job.salary_month,
          paid_date: wage.paid_date ?? null,
          cheque_no: wage.cheque_no ?? null,
          bank_account_id: wage.bank_account_id ?? null,
          payment_mode: wage.payment_mode ?? null,
          status: 'DRAFT',
          created_by: job.user_id,
          updated_by: job.user_id,
        }], { session });

        const wageDoc = doc;

        if ((wage.advance_deduction || 0) > 0) {
          await Advance.create([{
            firm_id: firmId,
            master_roll_id: wage.master_roll_id,
            type: 'REPAYMENT',
            amount: wage.advance_deduction,
            date: wage.paid_date || new Date().toISOString().split('T')[0],
            payment_mode: 'WAGE_DEDUCTION',
            wage_id: wageDoc._id,
            remarks: `Repayment from wages - ${job.salary_month}`,
            status: 'PENDING',
            created_by: job.user_id,
            updated_by: job.user_id,
          }], { session });
        }

        // Ledger
        const voucherId = await postWageLedger(wageDoc, session, employee.employee_name);
        wageDoc.voucher_group_id = voucherId;
        wageDoc.status = 'POSTED';
        wageDoc.posted_date = new Date();
        wageDoc.posted_by = job.user_id;
        await wageDoc.save({ session });

        stepResults.push({ master_roll_id: wage.master_roll_id, wage_id: wageDoc._id, success: true });
        stepProcessed++;

      } catch (err) {
        stepResults.push({ master_roll_id: wage.master_roll_id, success: false, message: err.message });
        stepFailed++;
      }
    }

    await session.commitTransaction();

    // Update job state
    job.current_index = endIdx;
    job.processed_wages += stepProcessed;
    job.failed_wages += stepFailed;
    job.results.push(...stepResults);
    job.progress_percentage = Math.round((job.current_index / job.total_wages) * 100);

    if (job.current_index >= job.total_wages) {
      job.status = 'COMPLETED';
      job.completed_at = new Date();
      job.duration_ms = (job.completed_at - job.started_at);
    }

    await job.save();
    return job;

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error(`Step failed for job ${jobId}:`, error.message);
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Original processWageJob (kept for compatibility, but refactored to use steps internally)
 */
export async function processWageJob(jobId, firmId, userId, salaryMonth, wagesData) {
  try {
    let job = await WageJob.findById(jobId);
    if (!job) {
       // Auto-initiate if not exists (legacy behavior)
       await initiateWageJob(firmId, userId, salaryMonth, wagesData);
    }

    while (job.status !== 'COMPLETED' && job.status !== 'FAILED') {
      job = await processWageJobStep(jobId, firmId);
    }
    return job;
  } catch (error) {
    await WageJob.findByIdAndUpdate(jobId, { status: 'FAILED', error_message: error.message });
    throw error;
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId) {
  const job = await WageJob.findById(jobId).lean();
  if (!job) throw new Error('Job not found');
  return job;
}

export default {
  initiateWageJob,
  processWageJobStep,
  processWageJob,
  getJobStatus,
};
