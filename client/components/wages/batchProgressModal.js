/**
 * Batch Progress Modal
 * Shows real-time progress of batch wage creation
 */

export function createBatchProgressModal() {
  let isVisible = false;
  let currentProgress = {
    currentBatch: 0,
    totalBatches: 0,
    itemsProcessed: 0,
    totalItems: 0,
    percentComplete: 0,
  };
  let batchResults = [];
  let isCompleted = false;
  let hasError = false;
  let errorMessage = '';

  function show() {
    isVisible = true;
    isCompleted = false;
    hasError = false;
    errorMessage = '';
    batchResults = [];
    render();
  }

  function hide() {
    isVisible = false;
    render();
  }

  function updateProgress(progress) {
    currentProgress = progress;
    render();
  }

  function addBatchResult(batchNumber, result) {
    batchResults.push({
      batchNumber,
      result,
      timestamp: new Date().toLocaleTimeString(),
    });
    render();
  }

  function setCompleted(finalResults) {
    isCompleted = true;
    render();
  }

  function setError(error) {
    hasError = true;
    errorMessage = error;
    render();
  }

  function render() {
    const modal = document.getElementById('batch-progress-modal');
    if (!modal) return;

    if (!isVisible) {
      modal.style.display = 'none';
      return;
    }

    modal.style.display = 'flex';

    const progressPercentage = currentProgress.percentComplete || 0;
    const statusText = isCompleted
      ? '✅ Completed'
      : hasError
      ? '❌ Error'
      : '⏳ Processing...';

    const statusColor = isCompleted
      ? 'text-green-600'
      : hasError
      ? 'text-red-600'
      : 'text-blue-600';

    const content = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-800">Batch Processing</h2>
            <span class="text-sm font-semibold ${statusColor}">${statusText}</span>
          </div>

          <!-- Progress Info -->
          <div class="mb-6 space-y-2">
            <div class="flex justify-between text-sm text-gray-600">
              <span>Batch ${currentProgress.currentBatch}/${currentProgress.totalBatches}</span>
              <span>${currentProgress.itemsProcessed}/${currentProgress.totalItems} items</span>
            </div>
            
            <!-- Progress Bar -->
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                class="bg-blue-600 h-full transition-all duration-300 ease-out"
                style="width: ${progressPercentage}%"
              ></div>
            </div>
            
            <div class="text-center text-sm font-semibold text-gray-700">
              ${progressPercentage}%
            </div>
          </div>

          <!-- Error Message -->
          ${
            hasError
              ? `
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-700">${errorMessage}</p>
            </div>
          `
              : ''
          }

          <!-- Batch Results Log -->
          <div class="mb-6 max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4">
            <div class="text-xs font-semibold text-gray-600 mb-3">Recent Batches:</div>
            ${
              batchResults.length > 0
                ? batchResults
                    .slice(-5)
                    .map(
                      (br) => `
                  <div class="text-xs text-gray-600 mb-2 pb-2 border-b border-gray-200">
                    <div class="font-semibold">Batch ${br.batchNumber} - ${br.timestamp}</div>
                    <div class="text-gray-500">
                      ✅ ${br.result.meta?.success || 0} | ❌ ${br.result.meta?.failed || 0}
                    </div>
                  </div>
                `
                    )
                    .join('')
                : '<div class="text-xs text-gray-400">Waiting for batches...</div>'
            }
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3">
            ${
              isCompleted || hasError
                ? `
              <button
                id="close-batch-modal-btn"
                class="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Close
              </button>
            `
                : `
              <button
                id="cancel-batch-btn"
                class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            `
            }
          </div>
        </div>
      </div>
    `;

    modal.innerHTML = content;

    // Attach event listeners
    const closeBtn = document.getElementById('close-batch-modal-btn');
    const cancelBtn = document.getElementById('cancel-batch-btn');

    if (closeBtn) {
      closeBtn.addEventListener('click', hide);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        // Emit cancel event that can be handled by caller
        window.dispatchEvent(new CustomEvent('batch-processing-cancelled'));
        hide();
      });
    }
  }

  // Initialize modal in DOM if not exists
  function ensureModalExists() {
    if (!document.getElementById('batch-progress-modal')) {
      const modal = document.createElement('div');
      modal.id = 'batch-progress-modal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }
  }

  ensureModalExists();

  return {
    show,
    hide,
    updateProgress,
    addBatchResult,
    setCompleted,
    setError,
    render,
  };
}
