/**
 * Wage Report Exporter (Revised)
 * Triggers server-side Excel generation and downloads the file
 */

import { api } from './api.js';

/**
 * Helper to trigger file download from a URL using authenticated fetch
 */
async function downloadFile(url, defaultFilename) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    credentials: 'same-origin' // Ensure cookies are sent
  });

  if (!response.ok) {
    // Check content-type to determine how to parse error
    const contentType = response.headers.get('Content-Type') || '';
    let errorMessage = 'Failed to download report';

    if (contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // If JSON parsing fails, use default error message
      }
    } else {
      // For non-JSON responses with error status, log and use generic message
      console.warn('Server returned error response with content-type:', contentType);
    }

    throw new Error(errorMessage);
  }

  // Get filename from header if available
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = defaultFilename;
  if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
    filename = contentDisposition.split('filename=')[1].split(';')[0].replace(/"/g, '');
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Export Bank Report to Excel (Server-side)
 */
export async function exportBankReport(month, chequeNo = 'all') {
  try {
    if (!month) {
      throw new Error('Month is required');
    }
    
    const url = `/api/wages/reports/bank?month=${month}&chequeNo=${chequeNo}`;
    await downloadFile(url, `bank-report-${month}.xlsx`);

    return { success: true, message: 'Bank report download started' };
  } catch (error) {
    console.error('Error exporting bank report:', error);
    throw error;
  }
}

/**
 * Export EPF/ESIC Report to Excel (Server-side)
 */
export async function exportEPFESICReport(month) {
  try {
    if (!month) {
      throw new Error('Month is required');
    }

    const url = `/api/wages/reports/epf-esic?month=${month}`;
    await downloadFile(url, `epf-esic-report-${month}.xlsx`);

    return { success: true, message: 'EPF/ESIC report download started' };
  } catch (error) {
    console.error('Error exporting EPF/ESIC report:', error);
    throw error;
  }
}
