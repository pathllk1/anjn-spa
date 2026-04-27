/**
 * Batch Processor Utility
 * Handles splitting large arrays into batches and processing sequentially
 * with progress tracking and error handling
 */

/**
 * Process array in batches with delay between batches
 * @param {Array} items - Items to process
 * @param {Number} batchSize - Number of items per batch (default: 20)
 * @param {Function} processBatch - Async function to process each batch
 * @param {Object} options - Configuration options
 * @returns {Object} Results with success/failure counts and details
 */
export async function processBatchesSequentially(items, batchSize = 20, processBatch, options = {}) {
  const {
    delayBetweenBatches = 800,  // ms delay between batches
    onProgress = null,           // Callback: (current, total, batchNumber)
    onBatchComplete = null,      // Callback: (batchNumber, results)
    onError = null,              // Callback: (error, batchNumber)
  } = options;

  const totalBatches = Math.ceil(items.length / batchSize);
  const results = {
    success: true,
    totalItems: items.length,
    totalBatches,
    processedBatches: 0,
    successCount: 0,
    failureCount: 0,
    batchResults: [],
    errors: [],
  };

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const startIdx = batchNum * batchSize;
    const endIdx = Math.min(startIdx + batchSize, items.length);
    const batch = items.slice(startIdx, endIdx);

    // Call progress callback
    if (onProgress) {
      onProgress({
        currentBatch: batchNum + 1,
        totalBatches,
        itemsProcessed: startIdx,
        totalItems: items.length,
        percentComplete: Math.round(((batchNum) / totalBatches) * 100),
      });
    }

    try {
      // Process batch
      const batchResult = await processBatch(batch, batchNum + 1);

      // Track results
      results.processedBatches++;
      results.batchResults.push({
        batchNumber: batchNum + 1,
        itemsInBatch: batch.length,
        result: batchResult,
      });

      // Count successes/failures
      if (batchResult.results) {
        const successCount = batchResult.results.filter(r => r.success).length;
        const failureCount = batchResult.results.filter(r => !r.success).length;
        results.successCount += successCount;
        results.failureCount += failureCount;
      }

      // Call batch complete callback
      if (onBatchComplete) {
        onBatchComplete({
          batchNumber: batchNum + 1,
          itemsInBatch: batch.length,
          result: batchResult,
        });
      }

      // Delay before next batch (except for last batch)
      if (batchNum < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }

    } catch (error) {
      results.success = false;
      results.errors.push({
        batchNumber: batchNum + 1,
        error: error.message,
      });

      // Call error callback
      if (onError) {
        onError({
          batchNumber: batchNum + 1,
          error: error.message,
          itemsInBatch: batch.length,
        });
      }

      // Continue to next batch or stop?
      // For now, continue processing remaining batches
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      currentBatch: totalBatches,
      totalBatches,
      itemsProcessed: items.length,
      totalItems: items.length,
      percentComplete: 100,
    });
  }

  return results;
}

/**
 * Split array into chunks of specified size
 * @param {Array} array - Array to split
 * @param {Number} chunkSize - Size of each chunk
 * @returns {Array} Array of chunks
 */
export function splitIntoChunks(array, chunkSize = 20) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Format batch progress for display
 * @param {Object} progress - Progress object from onProgress callback
 * @returns {String} Formatted progress string
 */
export function formatBatchProgress(progress) {
  const { currentBatch, totalBatches, itemsProcessed, totalItems, percentComplete } = progress;
  return `Batch ${currentBatch}/${totalBatches} (${itemsProcessed}/${totalItems} items) - ${percentComplete}%`;
}
