/**
 * Wage Export Reports Controller
 * Generates enterprise-grade Excel reports for bank and EPF/ESIC submissions
 * Handles special formatting for bank account numbers and large numbers
 */

import { Wage, MasterRoll, BankAccount } from '../../models/index.js';
import { formatDate } from '../../utils/dateFormatter.js';
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

    const chequeDate = formatDate(wages[0].paid_date || new Date());
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

    // Apply Borders to all cells with data
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Set Column Widths
    worksheet.columns.forEach((column, i) => {
      column.width = [15, 20, 15, 20, 20, 25, 25, 25, 15, 20][i];
    });

    // Generate Excel buffer before setting response headers
    const buffer = await workbook.xlsx.writeBuffer();

    // Only now set response headers and send
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=bank-report-${month}.xlsx`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

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
      .populate('master_roll_id', 'employee_name aadhar account_no project site date_of_joining date_of_exit')
      .sort({ 'master_roll_id.employee_name': 1 })
      .lean();

    if (wages.length === 0) {
      return res.status(400).json({ success: false, message: 'No wages found for the selected month' });
    }

    // Calculate Previous Month for Exit Date logic
    const [year, m] = month.split('-').map(Number);
    const prevDate = new Date(year, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('EPF-ESIC Report');

    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Project', key: 'project', width: 20 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Date of Joining', key: 'doj', width: 15 },
      { header: 'Date of Exit', key: 'doe', width: 15 },
      { header: 'Aadhar', key: 'aadhar', width: 15 },
      { header: 'Account Number', key: 'acc', width: 20 },
      { header: 'Gross Salary', key: 'gross', width: 15 },
      { header: 'EPF (12%)', key: 'epf', width: 18 },
      { header: 'ESIC (0.75%)', key: 'esic', width: 18 },
      { header: 'Emp. Statutory', key: 'stat', width: 18 },
      { header: 'Employer EPF (12%)', key: 'employer_epf', width: 18 },
      { header: 'Employer ESIC (3.25%)', key: 'employer_esic', width: 20 },
      { header: 'Total Employer', key: 'total_employer', width: 18 },
      { header: 'Total Contribution', key: 'grand_total', width: 18 },
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
      const epf = wage.epf_deduction || 0;
      const esic = wage.esic_deduction || 0;
      const gross = wage.gross_salary || 0;
      const mr = wage.master_roll_id;

      // Conditional Date Display Logic
      const joiningDisplay = (mr?.date_of_joining && mr.date_of_joining.startsWith(month)) ? mr.date_of_joining : '';
      const exitDisplay = (mr?.date_of_exit && mr.date_of_exit.startsWith(prevMonth)) ? mr.date_of_exit : '';
      
      // Calculate Employer Part
      // Employer EPF matches employee EPF (usually capped at 1800)
      const employerEpf = epf; 
      // Employer ESIC is 3.25% of gross
      const employerEsic = Math.ceil(gross * 0.0325);
      const totalEmployer = employerEpf + employerEsic;
      const grandTotal = (epf + esic) + totalEmployer;

      const row = worksheet.addRow({
        sno: index + 1,
        name: mr?.employee_name || 'N/A',
        project: mr?.project || '',
        site: mr?.site || '',
        doj: joiningDisplay,
        doe: exitDisplay,
        aadhar: mr?.aadhar || '',
        acc: mr?.account_no || '',
        gross: gross,
        epf: epf,
        esic: esic,
        stat: epf + esic,
        employer_epf: employerEpf,
        employer_esic: employerEsic,
        total_employer: totalEmployer,
        grand_total: grandTotal,
        net: wage.net_salary || 0,
        date: formatDate(wage.paid_date),
      });

      row.getCell('acc').numFmt = '@';
      ['gross', 'epf', 'esic', 'stat', 'employer_epf', 'employer_esic', 'total_employer', 'grand_total', 'net'].forEach(key => {
        row.getCell(key).numFmt = '₹#,##0.00';
      });
    });

    const totalsRow = worksheet.addRow({
      name: 'TOTAL',
      gross: wages.reduce((sum, w) => sum + (w.gross_salary || 0), 0),
      epf: wages.reduce((sum, w) => sum + (w.epf_deduction || 0), 0),
      esic: wages.reduce((sum, w) => sum + (w.esic_deduction || 0), 0),
      stat: wages.reduce((sum, w) => sum + (w.epf_deduction || 0) + (w.esic_deduction || 0), 0),
      employer_epf: wages.reduce((sum, w) => sum + (w.epf_deduction || 0), 0),
      employer_esic: wages.reduce((sum, w) => sum + Math.ceil((w.gross_salary || 0) * 0.0325), 0),
      total_employer: wages.reduce((sum, w) => sum + (w.epf_deduction || 0) + Math.ceil((w.gross_salary || 0) * 0.0325), 0),
      grand_total: wages.reduce((sum, w) => {
        const epf = w.epf_deduction || 0;
        const esic = w.esic_deduction || 0;
        const empEpf = epf;
        const empEsic = Math.ceil((w.gross_salary || 0) * 0.0325);
        return sum + epf + esic + empEpf + empEsic;
      }, 0),
      net: wages.reduce((sum, w) => sum + (w.net_salary || 0), 0),
    });
    totalsRow.font = { bold: true };

    // Apply Borders to all cells with data
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Generate Excel buffer before setting response headers
    const buffer = await workbook.xlsx.writeBuffer();

    // Only now set response headers and send
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=epf-esic-report-${month}.xlsx`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (error) {
    console.error('Error generating EPF/ESIC report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
