/**
 * GST PDF Generator Utility
 * Generates statutory GST reports (GSTR-1, GSTR-3B) using pdfmake
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PrinterModule from 'pdfmake/js/Printer.js';

const PdfPrinter = PrinterModule.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to resolve font paths properly
const getFontPath = (fileName) => {
  return path.join(process.cwd(), 'client', 'public', 'fonts', fileName);
};

// Define fonts (using DejaVuSans for Rupee symbol support)
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
 * Format currency in Indian numbering system with Rupee symbol
 */
function formatCurrency(val) {
  if (typeof val !== 'number') return '\u20B9 0.00';
  return '\u20B9 ' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate GSTR-3B PDF Report
 */
export async function generateGSTR3BPDF(report, firm) {
  const { period_start, period_end, firm_gstin, table_3_1, table_4, table_5 } = report;
  
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [30, 40, 30, 40],
    defaultStyle: {
      font: 'DejaVuSans',
      fontSize: 8.5
    },
    content: [
      // Statutory Header
      { text: 'FORM GSTR-3B', style: 'formTitle' },
      { text: '[See rule 61(5)]', style: 'ruleRef' },
      { text: 'Self-Asst. Summary Return', style: 'subTitle' },
      
      // Taxpayer Info
      {
        table: {
          widths: ['auto', '*', 'auto', '*'],
          body: [
            [
              { text: '1. GSTIN', style: 'infoLabel' }, { text: firm_gstin, style: 'infoValue' },
              { text: '2. Legal Name', style: 'infoLabel' }, { text: firm.name, style: 'infoValue' }
            ],
            [
              { text: 'Year', style: 'infoLabel' }, { text: period_start.split('-')[0], style: 'infoValue' },
              { text: 'Month', style: 'infoLabel' }, { text: period_start.split('-')[1], style: 'infoValue' }
            ]
          ]
        },
        margin: [0, 10, 0, 15]
      },

      // Table 3.1
      { text: '3.1 Details of Outward Supplies and inward supplies liable to reverse charge', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Nature of Supplies', style: 'tableHeader' },
              { text: 'Total Taxable Value', style: 'tableHeader', alignment: 'right' },
              { text: 'IGST', style: 'tableHeader', alignment: 'right' },
              { text: 'CGST', style: 'tableHeader', alignment: 'right' },
              { text: 'SGST/UTGST', style: 'tableHeader', alignment: 'right' },
              { text: 'Cess', style: 'tableHeader', alignment: 'right' }
            ],
            [
              '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
              { text: formatCurrency(table_3_1.a.taxable_value), alignment: 'right' },
              { text: formatCurrency(table_3_1.a.igst), alignment: 'right' },
              { text: formatCurrency(table_3_1.a.cgst), alignment: 'right' },
              { text: formatCurrency(table_3_1.a.sgst), alignment: 'right' },
              { text: formatCurrency(table_3_1.a.cess), alignment: 'right' }
            ],
            [
              '(b) Outward taxable supplies (zero rated)',
              { text: formatCurrency(table_3_1.b.taxable_value), alignment: 'right' },
              { text: formatCurrency(table_3_1.b.igst), alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: formatCurrency(table_3_1.b.cess), alignment: 'right' }
            ],
            [
              '(c) Other outward supplies (Nil rated, exempted)',
              { text: formatCurrency(table_3_1.c.taxable_value), alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' }
            ],
            [
              '(d) Inward supplies (liable to reverse charge)',
              { text: formatCurrency(table_3_1.d.taxable_value), alignment: 'right' },
              { text: formatCurrency(table_3_1.d.igst), alignment: 'right' },
              { text: formatCurrency(table_3_1.d.cgst), alignment: 'right' },
              { text: formatCurrency(table_3_1.d.sgst), alignment: 'right' },
              { text: formatCurrency(table_3_1.d.cess), alignment: 'right' }
            ],
            [
              '(e) Non-GST outward supplies',
              { text: formatCurrency(table_3_1.e.taxable_value), alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' }
            ]
          ]
        },
        margin: [0, 5, 0, 15]
      },

      // Table 4
      { text: '4. Eligible ITC', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Details', style: 'tableHeader' },
              { text: 'IGST', style: 'tableHeader', alignment: 'right' },
              { text: 'CGST', style: 'tableHeader', alignment: 'right' },
              { text: 'SGST/UTGST', style: 'tableHeader', alignment: 'right' },
              { text: 'Cess', style: 'tableHeader', alignment: 'right' }
            ],
            [{ text: '(A) ITC Available (whether in full or part)', style: 'tableSubHeader', colSpan: 5 }, {}, {}, {}, {}],
            [
              '(1) Import of goods',
              { text: formatCurrency(table_4.a[1].igst), alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: formatCurrency(table_4.a[1].cess), alignment: 'right' }
            ],
            [
              '(2) Import of services',
              { text: formatCurrency(table_4.a[2].igst), alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: '0.00', alignment: 'right' },
              { text: formatCurrency(table_4.a[2].cess), alignment: 'right' }
            ],
            [
              '(3) Inward supplies liable to reverse charge (other than 1 & 2 above)',
              { text: formatCurrency(table_4.a[3].igst), alignment: 'right' },
              { text: formatCurrency(table_4.a[3].cgst), alignment: 'right' },
              { text: formatCurrency(table_4.a[3].sgst), alignment: 'right' },
              { text: formatCurrency(table_4.a[3].cess), alignment: 'right' }
            ],
            [
              '(4) Inward supplies from ISD',
              { text: formatCurrency(table_4.a[4].igst), alignment: 'right' },
              { text: formatCurrency(table_4.a[4].cgst), alignment: 'right' },
              { text: formatCurrency(table_4.a[4].sgst), alignment: 'right' },
              { text: formatCurrency(table_4.a[4].cess), alignment: 'right' }
            ],
            [
              '(5) All other ITC',
              { text: formatCurrency(table_4.a[5].igst), alignment: 'right' },
              { text: formatCurrency(table_4.a[5].cgst), alignment: 'right' },
              { text: formatCurrency(table_4.a[5].sgst), alignment: 'right' },
              { text: formatCurrency(table_4.a[5].cess), alignment: 'right' }
            ],
            [{ text: '(B) ITC Reversed', style: 'tableSubHeader', colSpan: 5 }, {}, {}, {}, {}],
            [
              '(1) As per rules 42 & 43 of CGST Rules',
              { text: formatCurrency(table_4.b[1].igst), alignment: 'right' },
              { text: formatCurrency(table_4.b[1].cgst), alignment: 'right' },
              { text: formatCurrency(table_4.b[1].sgst), alignment: 'right' },
              { text: formatCurrency(table_4.b[1].cess), alignment: 'right' }
            ],
            [
              '(2) Others',
              { text: formatCurrency(table_4.b[2].igst), alignment: 'right' },
              { text: formatCurrency(table_4.b[2].cgst), alignment: 'right' },
              { text: formatCurrency(table_4.b[2].sgst), alignment: 'right' },
              { text: formatCurrency(table_4.b[2].cess), alignment: 'right' }
            ]
          ]
        },
        margin: [0, 5, 0, 15]
      },

      // Table 5
      { text: '5. Values of exempt, nil-rated and non-GST inward supplies', style: 'sectionHeader' },
      {
        table: {
          widths: ['*', 'auto', 'auto'],
          body: [
            [
              { text: 'Nature of Supplies', style: 'tableHeader' },
              { text: 'Inter-State Supplies', style: 'tableHeader', alignment: 'right' },
              { text: 'Intra-State Supplies', style: 'tableHeader', alignment: 'right' }
            ],
            [
              'From a supplier under composition scheme, Exempt and Nil rated supply',
              { text: formatCurrency(table_5.inter), alignment: 'right' },
              { text: formatCurrency(table_5.intra), alignment: 'right' }
            ]
          ]
        }
      },

      // Verification
      {
        text: '\n\nVerification:',
        style: 'sectionHeader'
      },
      {
        text: 'I hereby solemnly affirm and declare that the information given hereinabove is true and correct to the best of my knowledge and belief and nothing has been concealed therefrom.\n\n',
        fontSize: 8
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            stack: [
              { text: '__________________________', alignment: 'center' },
              { text: 'Signature of Authorized Signatory', alignment: 'center', fontSize: 9, bold: true },
              { text: firm.name, alignment: 'center', fontSize: 8 }
            ]
          }
        ]
      }
    ],
    styles: {
      formTitle: { fontSize: 12, bold: true, alignment: 'center' },
      ruleRef: { fontSize: 7, italics: true, alignment: 'center' },
      subTitle: { fontSize: 10, bold: true, alignment: 'center', margin: [0, 2, 0, 10] },
      sectionHeader: { fontSize: 9, bold: true, margin: [0, 10, 0, 5], fillColor: '#f3f4f6' },
      infoLabel: { fontSize: 8, bold: true, fillColor: '#eeeeee' },
      infoValue: { fontSize: 8.5 },
      tableHeader: { fontSize: 8, bold: true, fillColor: '#eeeeee', margin: [2, 4, 2, 4] },
      tableSubHeader: { fontSize: 8, bold: true, fillColor: '#f9fafb' }
    }
  };

  return await createPDF(docDefinition);
}

/**
 * Generate GSTR-1 PDF Report
 */
export async function generateGSTR1PDF(report, firm) {
  const { summary, tables } = report;
  
  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'DejaVuSans'
    },
    content: [
      { text: 'FORM GSTR-1', style: 'formTitle' },
      { text: 'Details of Outward Supplies of Goods or Services', style: 'subTitle' },
      
      // Header
      {
        table: {
          widths: ['auto', '*', 'auto', '*'],
          body: [
            [
              { text: 'GSTIN', style: 'infoLabel' }, { text: summary.firm_gstin, style: 'infoValue' },
              { text: 'Legal Name', style: 'infoLabel' }, { text: firm.name, style: 'infoValue' }
            ],
            [
              { text: 'From', style: 'infoLabel' }, { text: summary.period_start, style: 'infoValue' },
              { text: 'To', style: 'infoLabel' }, { text: summary.period_end, style: 'infoValue' }
            ]
          ]
        },
        margin: [0, 10, 0, 15]
      },

      // Summary
      { text: 'Summary of Outward Supplies', style: 'sectionHeader' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Total Invoices', summary.total_invoices],
            ['Total Taxable Value', { text: formatCurrency(summary.total_taxable_value), bold: true }],
            ['Total CGST', formatCurrency(summary.total_cgst)],
            ['Total SGST', formatCurrency(summary.total_sgst)],
            ['Total IGST', formatCurrency(summary.total_igst)],
            ['Total GST', { text: formatCurrency(summary.total_gst), bold: true }],
            ['Total Invoice Value', { text: formatCurrency(summary.total_invoice_value), bold: true }]
          ]
        },
        margin: [0, 5, 0, 15]
      },

      // Table 4A - B2B
      { text: 'Table 4A: B2B Supplies', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', '*', '*', '*'],
          body: [
            [
              { text: 'Invoice No', style: 'tableHeader' },
              { text: 'Invoice Date', style: 'tableHeader' },
              { text: 'Customer GSTIN', style: 'tableHeader' },
              { text: 'Taxable Value', style: 'tableHeader', alignment: 'right' },
              { text: 'Total GST', style: 'tableHeader', alignment: 'right' },
              { text: 'Invoice Total', style: 'tableHeader', alignment: 'right' }
            ],
            ...((tables.table_4a_b2b_supplies || []).slice(0, 30).map(row => [
              row.invoice_no,
              row.invoice_date,
              row.customer_gstin,
              { text: formatCurrency(row.taxable_value), alignment: 'right' },
              { text: formatCurrency((row.cgst || 0) + (row.sgst || 0) + (row.igst || 0)), alignment: 'right' },
              { text: formatCurrency(row.invoice_value), alignment: 'right' }
            ]))
          ]
        }
      },
      (tables.table_4a_b2b_supplies?.length > 30) ? { text: `... and ${tables.table_4a_b2b_supplies.length - 30} more rows (refer to Excel for complete list)`, fontSize: 8, margin: [0, 2, 0, 0] } : {},

      // HSN Summary
      { text: '\nTable 12: HSN-wise Summary', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'HSN', style: 'tableHeader' },
              { text: 'Description', style: 'tableHeader' },
              { text: 'UQC', style: 'tableHeader' },
              { text: 'Quantity', style: 'tableHeader', alignment: 'right' },
              { text: 'Taxable Value', style: 'tableHeader', alignment: 'right' },
              { text: 'Integrated Tax', style: 'tableHeader', alignment: 'right' }
            ],
            ...((tables.table_12_hsn_b2b || []).slice(0, 15).map(row => [
              row.hsn,
              row.description,
              row.uqc || 'PCS',
              { text: row.total_quantity, alignment: 'right' },
              { text: formatCurrency(row.taxable_value), alignment: 'right' },
              { text: formatCurrency(row.integrated_tax), alignment: 'right' }
            ]))
          ]
        }
      }
    ],
    styles: {
      formTitle: { fontSize: 16, bold: true, alignment: 'center' },
      subTitle: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 2, 0, 15] },
      sectionHeader: { fontSize: 11, bold: true, margin: [0, 12, 0, 6], fillColor: '#f3f4f6' },
      infoLabel: { fontSize: 10, bold: true, fillColor: '#eeeeee' },
      infoValue: { fontSize: 10 },
      tableHeader: { fontSize: 9, bold: true, fillColor: '#eeeeee', margin: [4, 4, 4, 4] }
    }
  };

  return await createPDF(docDefinition);
}

/**
 * Common PDF creation logic
 */
async function createPDF(docDefinition) {
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
