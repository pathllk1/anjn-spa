/**
 * Wage Job Processor - Handles bulk wage creation asynchronously
 * 
 * Processes wages in batches to avoid timeout and memory issues
 * Updates job status in real-time for client polling
 */

import { Wage, MasterRoll, Advance, WageJob } from '../../models/index.js';
import { postWageLedger } from './wagesLedgerHelper.js';

const BATCH_SIZE = 10; // Process 10 wages per batch

/**
 * Process wage job asynchronously
 * @param {ObjectId} jobId - Job ID
 * @param {ObjectId} firmId - Firm ID
 * @param {ObjectId} userId - User ID
 * @param {String} salaryMonth - Salary month (YYYY-MM)
 * @param {Array} wagesData - Array of wage data
 */
export async function processWageJob(jobId, firmId, userId, salaryMonth, wagesData) {
  const session = await Wage.startSession();
  
  try {
    // Update job status to PROCESSING
    await WageJob.findByIdAndUpdate(jobId, {
      status: 'PROCESSING',
      started_at: new Date(),
      total_wages: wagesData.length,
    });

    const results = [];
    let processedCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let i = 0; i < wagesData.length; i += BATCH_SIZE) {
      const batch = wagesData.slice(i, i + BATCH_SIZE);
      
      // Start new session for each batch
      session.startTransaction();

      try {
        for (const wage of batch) {
          try {
            if (!wage.master_roll_id || wage.gross_salary === undefined || !wage.wage_days) {
              results.push({
                master_roll_id: wage.master_roll_id,
                success: false,
                message: 'Missing required fields',
              });
              failedCount++;
              continue;
            }

            // Check for duplicate
            const existing = await Wage.findOne({
              firm_id: firmId,
              master_roll_id: wage.master_roll_id,
              salary_month: salaryMonth,
            }).session(session).lean();

            if (existing) {
              results.push({
                master_roll_id: wage.master_roll_id,
                success: false,
                message: 'Wage already exists for this employee in this month',
              });
              failedCount++;
              continue;
            }

            // Verify employee
            const employee = await MasterRoll.findOne({
              _id: wage.master_roll_id,
              firm_id: firmId,
            }).session(session).select('project site').lean();

            if (!employee) {
              results.push({
                master_roll_id: wage.master_roll_id,
                success: false,
                message: 'Employee not found',
              });
              failedCount++;
              continue;
            }

            // Calculate net salary
            const netSalary = wage.gross_salary -
              ((wage.epf_deduction || 0) +
               (wage.esic_deduction || 0) +
               (wage.other_deduction || 0) +
               (wage.advance_deduction || 0)) +
              (wage.other_benefit || 0);

            // Create wage
            const doc = await Wage.create([{
              firm_id: firmId,
              master_roll_id: wage.master_roll_id,
              p_day_wage: wage.gross_salary / wage.wage_days,
              wage_days: wage.wage_days,
              project: employee.project ?? null,
              site: employee.site ?? null,
              gross_salary: wage.gross_salary,
              epf_deduction: wage.epf_deduction ?? 0,
              esic_deduction: wage.esic_deduction ?? 0,
              other_deduction: wage.other_deduction ?? 0,
              other_benefit: wage.other_benefit ?? 0,
              advance_deduction: wage.advance_deduction ?? 0,
              net_salary: netSalary,
              salary_month: salaryMonth,
              paid_date: wage.paid_date ?? null,
              cheque_no: wage.cheque_no ?? null,
              bank_account_id: wage.bank_account_id ?? null,
              payment_mode: wage.payment_mode ?? null,
              status: 'DRAFT',
              created_by: userId,
              updated_by: userId,
            }], { session });

            const wageDoc = doc[0];

            // Record advance repayment
            if ((wage.advance_deduction || 0) > 0) {
              await Advance.create([{
                firm_id: firmId,
                master_roll_id: wage.master_roll_id,
                type: 'REPAYMENT',
                amount: wage.advance_deduction,
                date: wage.paid_date || new Date().toISOString().split('T')[0],
                payment_mode: 'WAGE_DEDUCTION',
                wage_id: wageDoc._id,
                remarks: `Repayment from wages - ${salaryMonth}`,
                status: 'PENDING',
                created_by: userId,
                updated_by: userId,
              }], { session });
            }

            // Post ledger entries
            try {
              const voucherId = await postWageLedger(wageDoc, session);
              wageDoc.voucher_group_id = voucherId;
              wageDoc.status = 'POSTED';
              wageDoc.posted_date = new Date();
              wageDoc.posted_by = userId;
              await wageDoc.save({ session });

              results.push({
                master_roll_id: wage.master_roll_id,
                wage_id: wageDoc._id,
                voucher_id: voucherId,
                success: true,
              });
              processedCount++;
            } catch (ledgerError) {
              throw new Error(`Ledger posting failed: ${ledgerError.message}`);
            }

          } catch (error) {
            results.push({
              master_roll_id: wage.master_roll_id,
              success: false,
              message: error.message,
            });
            failedCount++;
          }
        }

        // Commit batch
        await session.commitTransaction();

      } catch (batchError) {
        await session.abortTransaction();
        console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, batchError.message);
      }

      // Update progress
      const progressPercentage = Math.round(((i + BATCH_SIZE) / wagesData.length) * 100);
      await WageJob.findByIdAndUpdate(jobId, {
        processed_wages: Math.min(processedCount + failedCount, wagesData.length),
        failed_wages: failedCount,
        progress_percentage: Math.min(progressPercentage, 100),
      });

      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} completed: ${processedCount + failedCount}/${wagesData.length}`);
    }

    // Mark job as completed
    await WageJob.findByIdAndUpdate(jobId, {
      status: 'COMPLETED',
      completed_at: new Date(),
      processed_wages: processedCount,
      failed_wages: failedCount,
      progress_percentage: 100,
      results: results,
      duration_ms: new Date() - new Date(await WageJob.findById(jobId).select('createdAt')).createdAt,
    });

    console.log(`✅ Job ${jobId} completed: ${processedCount} processed, ${failedCount} failed`);

  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error.message);
    await WageJob.findByIdAndUpdate(jobId, {
      status: 'FAILED',
      completed_at: new Date(),
      error_message: error.message,
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId) {
  const job = await WageJob.findById(jobId).lean();
  if (!job) {
    throw new Error('Job not found');
  }
  return job;
}

export default {
  processWageJob,
  getJobStatus,
};
