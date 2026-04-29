/**
 * Wage Slip Controller
 * Generates individual and bulk wage slips as PDF
 * Professional format with color scheme
 */

import { Wage, MasterRoll, Firm } from '../../models/index.js';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import { Readable } from 'stream';

/**
 * Generate individual wage slip PDF
 */
export async function generateIndividualWageSlip(req, res) {
  try {
    const { wageId } = req.params;
    const firmId = req.user.firm_id;

    // Fetch wage with employee details
    const wage = await Wage.findOne({ _id: wageId, firm_id: firmId })
      .populate('master_roll_id', 'employee_name aadhar bank account_no designation')
      .lean();

    if (!wage) {
      return res.status(404).json({ success: false, message: 'Wage record not found' });
    }

    // Fetch firm details
    const firm = await Firm.findById(firmId).lean();

    // Generate PDF
    const pdfBuffer = await generateWageSlipPDF(wage, firm);

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wage-slip-${wage.master_roll_id?.employee_name}-${wage.salary_month}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating wage slip:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Generate bulk wage slips as ZIP
 */
export async function generateBulkWageSlips(req, res) {
  try {
    const { month } = req.query;
    const firmId = req.user.firm_id;

    if (!month) {
      return res.status(400).json({ success: false, message: 'Month is required' });
    }

    // Fetch all wages for the month
    const wages = await Wage.find({ firm_id: firmId, salary_month: month, status: 'POSTED' })
      .populate('master_roll_id', 'employee_name aadhar bank account_no designation')
      .sort({ 'master_roll_id.employee_name': 1 })
      .lean();

    if (wages.length === 0) {
      return res.status(400).json({ success: false, message: 'No wages found for the selected month' });
    }

    // Fetch firm details
    const firm = await Firm.findById(firmId).lean();

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="wage-slips-${month}.zip"`);

    archive.pipe(res);

    // Generate PDF for each wage
    for (const wage of wages) {
      try {
        const pdfBuffer = await generateWageSlipPDF(wage, firm);
        const filename = `wage-slip-${wage.master_roll_id?.employee_name}-${wage.salary_month}.pdf`;
        archive.append(pdfBuffer, { name: filename });
      } catch (error) {
        console.error(`Error generating slip for ${wage.master_roll_id?.employee_name}:`, error);
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error generating bulk wage slips:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/**
 * Generate wage slip PDF document
 */
async function generateWageSlipPDF(wage, firm) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Color scheme
      const colors = {
        primary: '#1F4E78',      // Dark blue
        secondary: '#4472C4',    // Light blue
        accent: '#70AD47',       // Green
        text: '#333333',         // Dark gray
        lightBg: '#E7E6E6',      // Light gray
        border: '#CCCCCC'        // Border gray
      };

      // Header
      drawHeader(doc, firm, colors);

      // Employee Info
      drawEmployeeInfo(doc, wage, colors);

      // Salary Details
      drawSalaryDetails(doc, wage, colors);

      // Footer
      drawFooter(doc, wage, colors);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Draw header section
 */
function drawHeader(doc, firm, colors) {
  // Background
  doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);

  // Firm name
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#FFFFFF').text(firm?.name || 'Company Name', 40, 20);

  // Wage Slip title
  doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.secondary).text('WAGE SLIP', doc.page.width - 150, 30);

  // Reset
  doc.fillColor(colors.text);
}

/**
 * Draw employee information section
 */
function drawEmployeeInfo(doc, wage, colors) {
  const startY = 100;
  const lineHeight = 20;

  // Section title
  doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('EMPLOYEE INFORMATION', 40, startY);

  // Background for info section
  doc.rect(40, startY + 20, doc.page.width - 80, 100).fill(colors.lightBg);

  // Employee details
  const infoY = startY + 30;
  const col1X = 50;
  const col2X = 300;

  doc.fontSize(10).font('Helvetica').fillColor(colors.text);

  doc.text(`Employee Name: ${wage.master_roll_id?.employee_name || 'N/A'}`, col1X, infoY);
  doc.text(`Aadhar: ${wage.master_roll_id?.aadhar || 'N/A'}`, col2X, infoY);

  doc.text(`Bank: ${wage.master_roll_id?.bank || 'N/A'}`, col1X, infoY + lineHeight);
  doc.text(`Account No: ${wage.master_roll_id?.account_no || 'N/A'}`, col2X, infoY + lineHeight);

  doc.text(`Salary Month: ${wage.salary_month}`, col1X, infoY + lineHeight * 2);
  doc.text(`Paid Date: ${wage.paid_date || 'N/A'}`, col2X, infoY + lineHeight * 2);

  doc.text(`Payment Mode: ${wage.payment_mode || 'N/A'}`, col1X, infoY + lineHeight * 3);
  doc.text(`Cheque/Ref No: ${wage.cheque_no || 'N/A'}`, col2X, infoY + lineHeight * 3);
}

/**
 * Draw salary details section
 */
function drawSalaryDetails(doc, wage, colors) {
  const startY = 240;
  const lineHeight = 18;
  const col1X = 50;
  const col2X = 350;

  // Section title
  doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('SALARY DETAILS', col1X, startY);

  // Table header
  const tableY = startY + 25;
  doc.rect(col1X, tableY, doc.page.width - 100, lineHeight).fill(colors.secondary);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Particulars', col1X + 10, tableY + 4);
  doc.text('Amount (₹)', col2X + 50, tableY + 4);

  // Earnings
  let currentY = tableY + lineHeight;
  doc.fontSize(9).font('Helvetica').fillColor(colors.text);

  const earnings = [
    { label: 'Gross Salary', value: wage.gross_salary || 0 },
    { label: 'Other Benefits', value: wage.other_benefit || 0 }
  ];

  earnings.forEach(item => {
    doc.rect(col1X, currentY, doc.page.width - 100, lineHeight).stroke(colors.border);
    doc.text(item.label, col1X + 10, currentY + 4);
    doc.text(`₹ ${item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col2X + 50, currentY + 4);
    currentY += lineHeight;
  });

  // Deductions header
  doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text('DEDUCTIONS', col1X, currentY + 10);
  currentY += 25;

  const deductions = [
    { label: 'EPF Deduction', value: wage.epf_deduction || 0 },
    { label: 'ESIC Deduction', value: wage.esic_deduction || 0 },
    { label: 'Other Deduction', value: wage.other_deduction || 0 },
    { label: 'Advance Deduction', value: wage.advance_deduction || 0 }
  ];

  deductions.forEach(item => {
    doc.rect(col1X, currentY, doc.page.width - 100, lineHeight).stroke(colors.border);
    doc.fontSize(9).font('Helvetica').fillColor(colors.text);
    doc.text(item.label, col1X + 10, currentY + 4);
    doc.text(`₹ ${item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col2X + 50, currentY + 4);
    currentY += lineHeight;
  });

  // Net Salary (highlighted)
  doc.rect(col1X, currentY, doc.page.width - 100, lineHeight).fill(colors.accent);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('NET SALARY', col1X + 10, currentY + 4);
  doc.text(`₹ ${(wage.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col2X + 50, currentY + 4);

  // Summary
  currentY += lineHeight + 20;
  doc.fontSize(9).font('Helvetica').fillColor(colors.text);
  doc.text(`Total Earnings: ₹ ${((wage.gross_salary || 0) + (wage.other_benefit || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col1X, currentY);
  currentY += lineHeight;
  doc.text(`Total Deductions: ₹ ${((wage.epf_deduction || 0) + (wage.esic_deduction || 0) + (wage.other_deduction || 0) + (wage.advance_deduction || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col1X, currentY);
}

/**
 * Draw footer section
 */
function drawFooter(doc, wage, colors) {
  const footerY = doc.page.height - 60;

  // Border line
  doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).stroke(colors.border);

  // Footer text
  doc.fontSize(8).font('Helvetica').fillColor(colors.text);
  doc.text('This is a computer-generated wage slip. No signature is required.', 40, footerY + 10);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 40, footerY + 20);
  doc.text(`Wage ID: ${wage._id}`, 40, footerY + 30);
}
