/**
 * Wage Export Reports Controller
 * Generates enterprise-grade Excel reports for bank and EPF/ESIC submissions
 * Handles special formatting for bank account numbers and large numbers
 */

import { Wage, MasterRoll, BankAccount } from '../../models/index.js';
import ExcelJS from 'exceljs';

/**
 * Generate Bank Report (for bank submission)
 * Returns Excel file directly to client
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
      .populate('master_roll_id', 'employee_name aadhar account_no bank ifsc branch')
      .sort({ 'master_roll_id.employee_name': 1 })
      .lean();

    if (wages.length === 0) {
      return res.status(400).json({ success: false, message: 'No wages found for the selected criteria' });
    }

    // Get Debit Account (Firm's Bank Account)
    let debitAccountNo = '';
    if (wages[0].bank_account_id) {
      const firmBank = await BankAccount.findById(wages[0].bank_account_id).lean();
      if (firmBank) {
        debitAccountNo = firmBank.account_number;
      }
    }

    const chequeDate = wages[0].paid_date || new Date().toISOString().split('T')[0];
    const displayChequeNo = chequeNo && chequeNo !== 'all' ? chequeNo : (wages[0].cheque_no || '');

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bank Report');

    // 1. Add Header Rows (Cheque No and Date)
    worksheet.addRow(['CHEQUE NUMBER', displayChequeNo]);
    worksheet.addRow(['CHEQUE DATE', chequeDate]);

    // 2. Add Main Headers
    const mainHeaders = [
      'PAYSYS ID(RTGS/NEFT)',
      'DEBIT ACCOUNT',
      'TRAN AMOUNT',
      'BENEFICIARY ACCOUNT',
      'BENEFICIARY ACCOUNT TYPE',
      'BENEFICIARY NAME',
      'BENEFICIARY ADD1',
      'BENEFICIARY ADD2',
      'BENEFICIARY IFSC',
      'SENDER TO RECEIVER INFO'
    ];
    const headerRow = worksheet.addRow(mainHeaders);
    headerRow.font = { bold: true };

    // 3. Add Data Rows
    let totalAmount = 0;
    wages.forEach((wage) => {
      const netSalary = wage.net_salary || 0;
      totalAmount += netSalary;

      const row = worksheet.addRow([
        'NEFT',
        debitAccountNo,
        netSalary,
        wage.master_roll_id?.account_no || '',
        '10',
        wage.master_roll_id?.employee_name || 'N/A',
        wage.master_roll_id?.bank || '',
        wage.master_roll_id?.branch || '',
        wage.master_roll_id?.ifsc || '',
        displayChequeNo
      ]);

      // Formatting
      row.getCell(2).numFmt = '@'; // Debit Account as Text
      row.getCell(3).numFmt = '#,##0.00'; // Amount
      row.getCell(4).numFmt = '@'; // Beneficiary Account as Text
      row.getCell(5).numFmt = '@'; // Account Type as Text
      row.getCell(9).numFmt = '@'; // IFSC as Text
      row.getCell(10).numFmt = '@'; // Info as Text
    });

    // 4. Add Grand Total Row
    const totalsRow = worksheet.addRow(['', '', totalAmount]);
    totalsRow.font = { bold: true };
    totalsRow.getCell(3).numFmt = '#,##0.00';

    // Set Column Widths
    worksheet.columns.forEach((column, i) => {
      column.width = [15, 20, 15, 20, 20, 25, 25, 25, 15, 20][i];
    });

    // Finalize response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=bank-report-${month}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating bank report:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Generate EPF/ESIC Report (for statutory filing)
 */
export async function generateEPFESICReport(req, res) {
  try {
    const { month } = req.query;
    const firmId = req.user.firm_id;

    if (!month) {
      return res.status(400).json({ success: false, message: 'Month is required' });
    }

    // Fetch wages
    const wages = await Wage.find({ firm_id: firmId, salary_month: month, status: 'POSTED' })
      .populate('master_roll_id', 'employee_name aadhar account_no')
      .sort({ 'master_roll_id.employee_name': 1 })
      .lean();

    if (wages.length === 0) {
      return res.status(400).json({ success: false, message: 'No wages found for the selected month' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('EPF-ESIC Report');

    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Aadhar', key: 'aadhar', width: 15 },
      { header: 'Account Number', key: 'acc', width: 20 },
      { header: 'Gross Salary', key: 'gross', width: 15 },
      { header: 'EPF (12%)', key: 'epf', width: 18 },
      { header: 'ESIC (0.75%)', key: 'esic', width: 18 },
      { header: 'Total Statutory', key: 'stat', width: 18 },
      { header: 'Net Salary', key: 'net', width: 15 },
      { header: 'Paid Date', key: 'date', width: 12 },
    ];

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' }
    };

    wages.forEach((wage, index) => {
      const row = worksheet.addRow({
        sno: index + 1,
        name: wage.master_roll_id?.employee_name || 'N/A',
        aadhar: wage.master_roll_id?.aadhar || '',
        acc: wage.master_roll_id?.account_no || '',
        gross: wage.gross_salary || 0,
        epf: wage.epf_deduction || 0,
        esic: wage.esic_deduction || 0,
        stat: (wage.epf_deduction || 0) + (wage.esic_deduction || 0),
        net: wage.net_salary || 0,
        date: wage.paid_date || '',
      });

      row.getCell('acc').numFmt = '@';
      ['gross', 'epf', 'esic', 'stat', 'net'].forEach(key => {
        row.getCell(key).numFmt = '₹#,##0.00';
      });
    });

    const totalsRow = worksheet.addRow({
      name: 'TOTAL',
      gross: wages.reduce((sum, w) => sum + (w.gross_salary || 0), 0),
      epf: wages.reduce((sum, w) => sum + (w.epf_deduction || 0), 0),
      esic: wages.reduce((sum, w) => sum + (w.esic_deduction || 0), 0),
      stat: wages.reduce((sum, w) => sum + (w.epf_deduction || 0) + (w.esic_deduction || 0), 0),
      net: wages.reduce((sum, w) => sum + (w.net_salary || 0), 0),
    });
    totalsRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=epf-esic-report-${month}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating EPF/ESIC report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
