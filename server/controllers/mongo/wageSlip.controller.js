/**
 * Wage Slip Controller
 * Generates individual and bulk wage slips as PDF using pdfmake
 * Professional format with proper Unicode support for rupee symbol
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Wage, MasterRoll, Firm } from '../../models/index.js';
import PrinterModule from 'pdfmake/js/Printer.js';
import archiver from 'archiver';

const PdfPrinter = PrinterModule.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to resolve font paths properly on different platforms
const getFontPath = (fileName) => {
  return path.join(process.cwd(), 'client', 'public', 'fonts', fileName);
};

// Font definitions - DejaVuSans supports Unicode including rupee symbol
const fonts = {
  DejaVuSans: {
    normal: getFontPath('DejaVuSans.ttf'),
    bold: getFontPath('DejaVuSans-Bold.ttf'),
    italics: getFontPath('DejaVuSans-Oblique.ttf'),
    bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf')
  }
};

const printer = new PdfPrinter(fonts);

/**
 * Helper function to format currency with proper rupee symbol
 * Uses Unicode \u20B9 (₹) which is properly supported by DejaVuSans
 */
function formatCurrency(amount) {
  return '\u20B9\u00A0' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}

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
 * Generate wage slip PDF document using pdfmake
 */
async function generateWageSlipPDF(wage, firm) {
  return new Promise(async (resolve, reject) => {
    try {
      const docDefinition = buildWageSlipDocument(wage, firm);
      const pdfDoc = await printer.createPdfKitDocument(docDefinition);

      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Build pdfmake document definition for wage slip
 */
function buildWageSlipDocument(wage, firm) {
  const employeeName = wage.master_roll_id?.employee_name || 'N/A';
  const aadhar = wage.master_roll_id?.aadhar || 'N/A';
  const bank = wage.master_roll_id?.bank || 'N/A';
  const accountNo = wage.master_roll_id?.account_no || 'N/A';
  const salaryMonth = wage.salary_month || 'N/A';
  const paidDate = wage.paid_date || 'N/A';
  const paymentMode = wage.payment_mode || 'N/A';
  const chequeNo = wage.cheque_no || 'N/A';

  const grossSalary = wage.gross_salary || 0;
  const otherBenefit = wage.other_benefit || 0;
  const epfDeduction = wage.epf_deduction || 0;
  const esicDeduction = wage.esic_deduction || 0;
  const otherDeduction = wage.other_deduction || 0;
  const advanceDeduction = wage.advance_deduction || 0;
  const netSalary = wage.net_salary || 0;

  const totalEarnings = grossSalary + otherBenefit;
  const totalDeductions = epfDeduction + esicDeduction + otherDeduction + advanceDeduction;

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'DejaVuSans',
      fontSize: 10
    },
    content: [
      // Header
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: firm?.name || 'Company Name', style: 'headerTitle' },
              { text: 'WAGE SLIP', style: 'headerSubtitle' }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20]
      },

      // Employee Information Section
      {
        text: 'EMPLOYEE INFORMATION',
        style: 'sectionTitle',
        margin: [0, 0, 0, 10]
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: `Employee Name: ${employeeName}`, fontSize: 10 },
              { text: `Aadhar: ${aadhar}`, fontSize: 10 }
            ],
            [
              { text: `Bank: ${bank}`, fontSize: 10 },
              { text: `Account No: ${accountNo}`, fontSize: 10 }
            ],
            [
              { text: `Salary Month: ${salaryMonth}`, fontSize: 10 },
              { text: `Paid Date: ${paidDate}`, fontSize: 10 }
            ],
            [
              { text: `Payment Mode: ${paymentMode}`, fontSize: 10 },
              { text: `Cheque/Ref No: ${chequeNo}`, fontSize: 10 }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#CCCCCC',
          vLineColor: () => '#CCCCCC',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6
        },
        margin: [0, 0, 0, 20]
      },

      // Salary Details Section
      {
        text: 'SALARY DETAILS',
        style: 'sectionTitle',
        margin: [0, 0, 0, 10]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto'],
          body: [
            // Header
            [
              { text: 'Particulars', style: 'tableHeader', fillColor: '#4472C4', color: '#FFFFFF' },
              { text: 'Amount', style: 'tableHeader', fillColor: '#4472C4', color: '#FFFFFF', alignment: 'right' }
            ],
            // Earnings
            [
              { text: 'Gross Salary', fontSize: 9 },
              { text: formatCurrency(grossSalary), fontSize: 9, alignment: 'right' }
            ],
            [
              { text: 'Other Benefits', fontSize: 9 },
              { text: formatCurrency(otherBenefit), fontSize: 9, alignment: 'right' }
            ],
            // Deductions Header
            [
              { text: 'DEDUCTIONS', colSpan: 2, style: 'deductionsHeader', margin: [0, 10, 0, 5] },
              {}
            ],
            // Deductions
            [
              { text: 'EPF Deduction', fontSize: 9 },
              { text: formatCurrency(epfDeduction), fontSize: 9, alignment: 'right' }
            ],
            [
              { text: 'ESIC Deduction', fontSize: 9 },
              { text: formatCurrency(esicDeduction), fontSize: 9, alignment: 'right' }
            ],
            [
              { text: 'Other Deduction', fontSize: 9 },
              { text: formatCurrency(otherDeduction), fontSize: 9, alignment: 'right' }
            ],
            [
              { text: 'Advance Deduction', fontSize: 9 },
              { text: formatCurrency(advanceDeduction), fontSize: 9, alignment: 'right' }
            ],
            // Net Salary
            [
              { text: 'NET SALARY', style: 'netSalary', fillColor: '#70AD47', color: '#FFFFFF' },
              { text: formatCurrency(netSalary), style: 'netSalary', fillColor: '#70AD47', color: '#FFFFFF', alignment: 'right' }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CCCCCC',
          vLineColor: () => '#CCCCCC',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 5,
          paddingBottom: () => 5
        },
        margin: [0, 0, 0, 20]
      },

      // Summary
      {
        columns: [
          { text: `Total Earnings: ${formatCurrency(totalEarnings)}`, fontSize: 9, bold: true },
          { text: `Total Deductions: ${formatCurrency(totalDeductions)}`, fontSize: 9, bold: true, alignment: 'right' }
        ],
        margin: [0, 0, 0, 30]
      },

      // Footer
      {
        text: 'This is a computer-generated wage slip. No signature is required.',
        fontSize: 8,
        alignment: 'center',
        italics: true,
        margin: [0, 0, 0, 5]
      },
      {
        columns: [
          { text: `Generated on: ${new Date().toLocaleDateString('en-IN')}`, fontSize: 8 },
          { text: `Wage ID: ${wage._id}`, fontSize: 8, alignment: 'right' }
        ]
      }
    ],
    styles: {
      headerTitle: {
        fontSize: 18,
        bold: true,
        color: '#1F4E78'
      },
      headerSubtitle: {
        fontSize: 12,
        bold: true,
        color: '#4472C4'
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        color: '#1F4E78'
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        alignment: 'left'
      },
      deductionsHeader: {
        fontSize: 10,
        bold: true,
        color: '#1F4E78'
      },
      netSalary: {
        fontSize: 10,
        bold: true,
        alignment: 'left'
      }
    }
  };
}
