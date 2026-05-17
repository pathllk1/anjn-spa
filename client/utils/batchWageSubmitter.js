/**
 * Batch Wage Submitter
 * Optimized for Vercel/Serverless using Atomic Iterator pattern
 */

import { api } from './api.js';

/**
 * Submit wages using the Atomic Job pattern
 * @param {String} month - Salary month (YYYY-MM)
 * @param {Array} wageRecords - Array of wage objects
 * @param {Object} progressModal - Progress modal instance
 * @returns {Object} Final results
 */
export async function submitWagesInBatches(month, wageRecords, progressModal) {
  const BATCH_SIZE = 5; // Safe size for Vercel serverless functions

  if (!wageRecords || wageRecords.length === 0) {
    throw new Error('No wage records to submit');
  }

  // Show progress modal
  progressModal.show();
  progressModal.updateProgress(0);

  try {
    // 1. INITIATE JOB
    progressModal.addBatchResult('INIT', { success: true, message: 'Initiating job...' });
    const initRes = await api.post('/api/wages/job/initiate', {
      month,
      wages: wageRecords,
    });

    if (!initRes.success) {
      throw new Error(initRes.message || 'Failed to initiate wage job');
    }

    const jobId = initRes.job_id;
    let isCompleted = false;
    let jobStatus = null;

    // 2. ITERATE STEPS
    while (!isCompleted) {
      const stepRes = await api.post(`/api/wages/job/${jobId}/step?batchSize=${BATCH_SIZE}`);
      
      if (!stepRes.success) {
        throw new Error(stepRes.message || 'Error during processing step');
      }

      jobStatus = stepRes.job;
      progressModal.updateProgress(jobStatus.progress);
      progressModal.addBatchResult(`STEP`, { 
        success: true, 
        message: `Processed ${jobStatus.processed}/${jobStatus.total} (${jobStatus.failed} failed)` 
      });

      if (jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED') {
        isCompleted = true;
      }
    }

    // 3. FETCH FINAL RESULTS
    const finalRes = await api.get(`/api/wages/job/${jobId}/results`);
    
    // Transform to expected result format for progressModal.setCompleted
    const results = {
      success: finalRes.success,
      successCount: finalRes.data?.processed_wages || 0,
      failureCount: finalRes.data?.failed_wages || 0,
      results: finalRes.data?.results || [],
      errors: finalRes.data?.status === 'FAILED' ? [{ error: finalRes.data.error_message }] : []
    };

    progressModal.setCompleted(results);
    return results;

  } catch (error) {
    console.error('Wage Job Error:', error);
    progressModal.setError(error.message);
    throw error;
  }
}
