/**
 * Batch Wage Submitter
 * Handles submitting wages in batches of 20 with progress tracking
 */

import { processBatchesSequentially } from './batchProcessor.js';
import { api } from './api.js';

/**
 * Submit wages in batches
 * @param {String} month - Salary month (YYYY-MM)
 * @param {Array} wageRecords - Array of wage objects
 * @param {Object} progressModal - Progress modal instance
 * @returns {Object} Final results
 */
export async function submitWagesInBatches(month, wageRecords, progressModal) {
  const BATCH_SIZE = 20;
  const DELAY_BETWEEN_BATCHES = 800; // ms

  if (!wageRecords || wageRecords.length === 0) {
    throw new Error('No wage records to submit');
  }

  // Show progress modal
  progressModal.show();

  try {
    const results = await processBatchesSequentially(
      wageRecords,
      BATCH_SIZE,
      async (batch, batchNumber) => {
        // Submit this batch to server
        const response = await api.post('/api/wages/create', {
          month,
          wages: batch,
        });

        return response;
      },
      {
        delayBetweenBatches: DELAY_BETWEEN_BATCHES,
        onProgress: (progress) => {
          progressModal.updateProgress(progress);
        },
        onBatchComplete: (batchInfo) => {
          progressModal.addBatchResult(batchInfo.batchNumber, batchInfo.result);
        },
        onError: (errorInfo) => {
          progressModal.setError(
            `Batch ${errorInfo.batchNumber} failed: ${errorInfo.error}`
          );
        },
      }
    );

    // Mark as completed
    progressModal.setCompleted(results);

    return results;

  } catch (error) {
    progressModal.setError(error.message);
    throw error;
  }
}

/**
 * Format wage records for batch submission
 * @param {Array} employees - Employee list
 * @param {Object} wageData - Wage data by employee ID
 * @param {Object} commonPaymentData - Common payment fields
 * @returns {Array} Formatted wage records
 */
export function formatWageRecordsForBatch(employees, wageData, commonPaymentData = {}) {
  return employees
    .map((emp) => {
      const wage = wageData[emp._id];
      if (!wage) return null;

      return {
        master_roll_id: emp._id,
        wage_days: parseInt(wage.wage_days) || 26,
        gross_salary: parseFloat(wage.gross_salary) || 0,
        epf_deduction: parseFloat(wage.epf_deduction) || 0,
        esic_deduction: parseFloat(wage.esic_deduction) || 0,
        other_deduction: parseFloat(wage.other_deduction) || 0,
        other_benefit: parseFloat(wage.other_benefit) || 0,
        advance_deduction: parseFloat(wage.advance_deduction) || 0,
        paid_date: commonPaymentData.paid_date || null,
        cheque_no: commonPaymentData.cheque_no || null,
        bank_account_id: commonPaymentData.bank_account_id || null,
        payment_mode: commonPaymentData.payment_mode || null,
        remarks: commonPaymentData.remarks || null,
      };
    })
    .filter((wage) => wage !== null);
}
