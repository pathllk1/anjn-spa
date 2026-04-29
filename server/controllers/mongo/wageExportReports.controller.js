/**
 * Wage Export Reports Controller
 * Generates enterprise-grade Excel reports for bank and EPF/ESIC submissions
 * Handles special formatting for bank account numbers and large numbers
 */

import { Wage, MasterRoll } from '../../models/index.js';

/**
 * Generate Bank Report (for bank submission)
 * Filtered by cheque/reference number
 * Handles bank account numbers with leading zeros and 16+ digits
 */
export async function generateBankReport(req, res) {
  try {
    const { month, chequeNo } = req.query;
    const firmId = req.user.firm_id;

    if (!month) {
      return res.status(400).json({ success: false, message: 'Month is required' });
    }

    // Fetch wages for the month
    let query = { firm_id: firmId, salary_month: month, status: 'POSTED' };
    
    if (chequeNo && chequeNo !== 'all') {
      query.cheque_no = chequeNo;
    }

    const wages = await Wage.find(query)
      .populate('master_roll_id', 'employee_name aadhar account_no bank')
      .sort({ 'master_roll_id.employee_name': 1 })
      .lean();

    if (wages.length === 0) {
      return res.status(400).json({ success: false, message: 'No wages found for the selected criteria' });
    }

    // Prepare data for Excel
    const reportData = wages.map((wage, index) => ({
      'S.No': index + 1,
      'Employee Name': wage.master_roll_id?.employee_name || 'N/A',
      'Aadhar': wage.master_roll_id?.aadhar || '',
      'Bank Name': wage.master_roll_id?.bank || '',
      'Account Number': wage.master_roll_id?.account_no || '', // Will be formatted as text
      'Payment Mode': wage.payment_mode || '',
      'Cheque/Ref No': wage.cheque_no || '',
      'Paid Date': wage.paid_date || '',
      'Gross Salary': wage.gross_salary || 0,
      'EPF Deduction': wage.epf_deduction || 0,
      'ESIC Deduction': wage.esic_deduction || 0,
      'Other Deduction': wage.other_deduction || 0,
      'Advance Deduction': wage.advance_deduction || 0,
      'Net Salary': wage.net_salary || 0,
    }));

    // Calculate totals
    const totals = {
      'S.No': '',
      'Employee Name': 'TOTAL',
      'Aadhar': '',
      'Bank Name': '',
      'Account Number': '',
      'Payment Mode': '',
      'Cheque/Ref No': '',
      'Paid Date': '',
      'Gross Salary': wages.reduce((sum, w) => sum + (w.gross_salary || 0), 0),
      'EPF Deduction': wages.reduce((sum, w) => sum + (w.epf_deduction || 0), 0),
      'ESIC Deduction': wages.reduce((sum, w) => sum + (w.esic_deduction || 0), 0),
      'Other Deduction': wages.reduce((sum, w) => sum + (w.other_deduction || 0), 0),
      'Advance Deduction': wages.reduce((sum, w) => sum + (w.advance_deduction || 0), 0),
      'Net Salary': wages.reduce((sum, w) => sum + (w.net_salary || 0), 0),
    };

    reportData.push(totals);

    // Return data with formatting instructions
    res.json({
      success: true,
      data: reportData,
      meta: {
        reportType: 'BANK_REPORT',
        month,
        chequeNo: chequeNo || 'all',
        totalRecords: wages.length,
        generatedAt: new Date().toISOString(),
        // Formatting instructions for client
        formatting: {
          'Account Number': {
            type: 'text', // Force as text to preserve leading zeros and handle 16+ digits
            width: 20
          },
          'Gross Salary': { type: 'currency', width: 15 },
          'EPF Deduction': { type: 'currency', width: 15 },
          'ESIC Deduction': { type: 'currency', width: 15 },
          'Other Deduction': { type: 'currency', width: 15 },
          'Advance Deduction': { type: 'currency', width: 15 },
          'Net Salary': { type: 'currency', width: 15 },
          'Paid Date': { type: 'date', width: 12 },
        }
      }
    });
  } catch (error) {
    console.error('Error generating bank report:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Generate EPF/ESIC Report (for statutory filing)
 * Enterprise-grade format for EPF/ESIC returns
 */
export async function generateEPFESICReport(req, res) {
  try {
    const { month } = req.query;
    const firmId = req.user.firm_id;

    if (!month) {
      return res.status(400).json({ success: false, message: 'Month is required' });
    }

    // Fetch wages for the month
    const wages = await Wage.find({ firm_id: firmId, salary_month: month, status: 'POSTED' })
      .populate('master_roll_id', 'employee_name aadhar account_no')
      .sort({ 'master_roll_id.employee_name': 1 })
      .lean();

    if (wages.length === 0) {
      return res.status(400).json({ success: false, message: 'No wages found for the selected month' });
    }

    // Prepare EPF/ESIC data
    const reportData = wages.map((wage, index) => ({
      'S.No': index + 1,
      'Employee Name': wage.master_roll_id?.employee_name || 'N/A',
      'Aadhar': wage.master_roll_id?.aadhar || '',
      'Account Number': wage.master_roll_id?.account_no || '',
      'Gross Salary': wage.gross_salary || 0,
      'EPF Contribution (12%)': wage.epf_deduction || 0,
      'ESIC Contribution (0.75%)': wage.esic_deduction || 0,
      'Total Statutory Deduction': (wage.epf_deduction || 0) + (wage.esic_deduction || 0),
      'Net Salary': wage.net_salary || 0,
      'Paid Date': wage.paid_date || '',
    }));

    // Calculate totals
    const totals = {
      'S.No': '',
      'Employee Name': 'TOTAL',
      'Aadhar': '',
      'Account Number': '',
      'Gross Salary': wages.reduce((sum, w) => sum + (w.gross_salary || 0), 0),
      'EPF Contribution (12%)': wages.reduce((sum, w) => sum + (w.epf_deduction || 0), 0),
      'ESIC Contribution (0.75%)': wages.reduce((sum, w) => sum + (w.esic_deduction || 0), 0),
      'Total Statutory Deduction': wages.reduce((sum, w) => sum + ((w.epf_deduction || 0) + (w.esic_deduction || 0)), 0),
      'Net Salary': wages.reduce((sum, w) => sum + (w.net_salary || 0), 0),
      'Paid Date': '',
    };

    reportData.push(totals);

    // Return data with formatting instructions
    res.json({
      success: true,
      data: reportData,
      meta: {
        reportType: 'EPF_ESIC_REPORT',
        month,
        totalRecords: wages.length,
        generatedAt: new Date().toISOString(),
        // Formatting instructions for client
        formatting: {
          'Account Number': {
            type: 'text', // Force as text to preserve leading zeros and handle 16+ digits
            width: 20
          },
          'Gross Salary': { type: 'currency', width: 15 },
          'EPF Contribution (12%)': { type: 'currency', width: 18 },
          'ESIC Contribution (0.75%)': { type: 'currency', width: 18 },
          'Total Statutory Deduction': { type: 'currency', width: 18 },
          'Net Salary': { type: 'currency', width: 15 },
          'Paid Date': { type: 'date', width: 12 },
        }
      }
    });
  } catch (error) {
    console.error('Error generating EPF/ESIC report:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}
