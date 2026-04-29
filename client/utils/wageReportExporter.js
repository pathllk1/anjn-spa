/**
 * Wage Report Exporter
 * Handles Excel export with proper formatting for bank account numbers and large numbers
 */

import { api } from './api.js';

/**
 * Export Bank Report to Excel
 * Handles bank account numbers with leading zeros and 16+ digits
 */
export async function exportBankReport(month, chequeNo = 'all') {
  try {
    if (!month) {
      throw new Error('Month is required');
    }

    // Fetch report data from server
    const response = await api.get(`/api/wages/reports/bank?month=${month}&chequeNo=${chequeNo}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to generate bank report');
    }

    const { data, meta } = response;

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: 1 });

    // Apply formatting
    applyBankReportFormatting(ws, data, meta);

    XLSX.utils.book_append_sheet(wb, ws, 'Bank Report');
    
    // Generate filename
    const filename = `bank-report-${month}-${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);

    return { success: true, message: `Bank report exported: ${filename}` };
  } catch (error) {
    console.error('Error exporting bank report:', error);
    throw error;
  }
}

/**
 * Export EPF/ESIC Report to Excel
 * Enterprise-grade format for statutory filing
 */
export async function exportEPFESICReport(month) {
  try {
    if (!month) {
      throw new Error('Month is required');
    }

    // Fetch report data from server
    const response = await api.get(`/api/wages/reports/epf-esic?month=${month}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to generate EPF/ESIC report');
    }

    const { data, meta } = response;

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: 1 });

    // Apply formatting
    applyEPFESICReportFormatting(ws, data, meta);

    XLSX.utils.book_append_sheet(wb, ws, 'EPF/ESIC Report');
    
    // Generate filename
    const filename = `epf-esic-report-${month}-${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);

    return { success: true, message: `EPF/ESIC report exported: ${filename}` };
  } catch (error) {
    console.error('Error exporting EPF/ESIC report:', error);
    throw error;
  }
}

/**
 * Apply formatting to Bank Report
 * Handles bank account numbers as text to preserve leading zeros and 16+ digits
 */
function applyBankReportFormatting(ws, data, meta) {
  if (!ws || !data || data.length === 0) return;

  // Get column headers
  const headers = Object.keys(data[0]);
  const accountNoColIndex = headers.indexOf('Account Number');

  // Apply formatting to each row
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const excelRowIndex = rowIndex + 2; // +1 for header, +1 for 1-based indexing

    // Format Account Number as text (to preserve leading zeros and handle 16+ digits)
    if (accountNoColIndex >= 0) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: accountNoColIndex });
      if (!ws[cellRef]) ws[cellRef] = {};
      
      // Force text format
      ws[cellRef].t = 's'; // 's' = string/text
      ws[cellRef].z = '@'; // '@' = text format code
    }

    // Format currency columns
    const currencyColumns = [
      'Gross Salary',
      'EPF Deduction',
      'ESIC Deduction',
      'Other Deduction',
      'Advance Deduction',
      'Net Salary'
    ];

    currencyColumns.forEach(colName => {
      const colIndex = headers.indexOf(colName);
      if (colIndex >= 0) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].z = '₹#,##0.00'; // Currency format
      }
    });

    // Format date column
    const dateColIndex = headers.indexOf('Paid Date');
    if (dateColIndex >= 0) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: dateColIndex });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].z = 'yyyy-mm-dd'; // Date format
    }
  }

  // Set column widths
  const columnWidths = headers.map(header => {
    switch (header) {
      case 'Account Number': return { wch: 20 };
      case 'Employee Name': return { wch: 25 };
      case 'Bank Name': return { wch: 20 };
      case 'Cheque/Ref No': return { wch: 15 };
      case 'Gross Salary':
      case 'EPF Deduction':
      case 'ESIC Deduction':
      case 'Other Deduction':
      case 'Advance Deduction':
      case 'Net Salary': return { wch: 15 };
      default: return { wch: 12 };
    }
  });
  ws['!cols'] = columnWidths;

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Add borders and styling to header row
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '366092' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }
}

/**
 * Apply formatting to EPF/ESIC Report
 * Enterprise-grade format for statutory filing
 */
function applyEPFESICReportFormatting(ws, data, meta) {
  if (!ws || !data || data.length === 0) return;

  // Get column headers
  const headers = Object.keys(data[0]);
  const accountNoColIndex = headers.indexOf('Account Number');

  // Apply formatting to each row
  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    // Format Account Number as text
    if (accountNoColIndex >= 0) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: accountNoColIndex });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].t = 's'; // 's' = string/text
      ws[cellRef].z = '@'; // '@' = text format code
    }

    // Format currency columns
    const currencyColumns = [
      'Gross Salary',
      'EPF Contribution (12%)',
      'ESIC Contribution (0.75%)',
      'Total Statutory Deduction',
      'Net Salary'
    ];

    currencyColumns.forEach(colName => {
      const colIndex = headers.indexOf(colName);
      if (colIndex >= 0) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
        if (!ws[cellRef]) ws[cellRef] = {};
        ws[cellRef].z = '₹#,##0.00'; // Currency format
      }
    });

    // Format date column
    const dateColIndex = headers.indexOf('Paid Date');
    if (dateColIndex >= 0) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: dateColIndex });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].z = 'yyyy-mm-dd'; // Date format
    }
  }

  // Set column widths
  const columnWidths = headers.map(header => {
    switch (header) {
      case 'Account Number': return { wch: 20 };
      case 'Employee Name': return { wch: 25 };
      case 'EPF Contribution (12%)':
      case 'ESIC Contribution (0.75%)':
      case 'Total Statutory Deduction': return { wch: 20 };
      case 'Gross Salary':
      case 'Net Salary': return { wch: 15 };
      default: return { wch: 12 };
    }
  });
  ws['!cols'] = columnWidths;

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Add borders and styling to header row
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F4E78' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }
}
