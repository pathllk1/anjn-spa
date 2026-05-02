import ExcelJS from 'exceljs';
import { Firm } from '../../models/index.js';

/**
 * Export wages to a highly formatted Excel file based on provided UI data
 * POST /api/wages/export
 */
export async function exportWagesToExcel(req, res) {
  try {
    const { month, data: rawData } = req.body;
    const firmId = req.user.firm_id;

    if (!month || !rawData || !Array.isArray(rawData)) {
      return res.status(400).json({ success: false, message: 'Month and data array are required' });
    }

    // Fetch firm details for branding
    const firm = await Firm.findById(firmId).lean();

    // 1. Create Workbook & Worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payroll Statement');

    // 2. Define Columns
    worksheet.columns = [
      { header: 'S.NO', key: 'sno', width: 6 },
      { header: 'EMPLOYEE NAME', key: 'name', width: 30 },
      { header: 'PROJECT', key: 'project', width: 20 },
      { header: 'SITE', key: 'site', width: 20 },
      { header: 'DATE OF JOINING', key: 'doj', width: 15 },
      { header: 'DATE OF EXIT', key: 'doe', width: 15 },
      { header: 'BANK ACCOUNT', key: 'bank', width: 35 },
      { header: 'RATE', key: 'rate', width: 12 },
      { header: 'DAYS', key: 'days', width: 10 },
      { header: 'GROSS SALARY', key: 'gross', width: 15 },
      { header: 'EPF (12%)', key: 'epf', width: 12 },
      { header: 'ESIC (0.75%)', key: 'esic', width: 12 },
      { header: 'OTHER DED', key: 'other_ded', width: 12 },
      { header: 'OTHER BEN', key: 'other_ben', width: 12 },
      { header: 'ADVANCE', key: 'adv', width: 12 },
      { header: 'NET SALARY', key: 'net', width: 15 },
    ];

    // Horizontal Gradient (Green -> Purple -> Red)
    const tripleGradient = {
      type: 'gradient',
      gradient: 'angle',
      angle: 0, // Left to Right
      stops: [
        { position: 0, color: { argb: 'FF10B981' } },   // Green
        { position: 0.5, color: { argb: 'FF8B5CF6' } }, // Purple
        { position: 1, color: { argb: 'FFEF4444' } }    // Red
      ]
    };

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }, // Neutral Dark Header
      alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      border: {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      }
    };

    const borderStyle = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };

    // 3. Add Company Header
    worksheet.insertRow(1, [(firm?.name || 'Payroll Statement').toUpperCase()]);
    worksheet.mergeCells('A1:P1');
    const titleCell = worksheet.getCell('A1');
    titleCell.height = 35;
    titleCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = tripleGradient;

    worksheet.insertRow(2, [`PAYROLL STATEMENT FOR ${month}`]);
    worksheet.mergeCells('A2:P2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.height = 25;
    subtitleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    subtitleCell.fill = tripleGradient;
    
    worksheet.insertRow(3, []); // Gap

    // 4. Set Table Headers (Row 4)
    const tableHeaderRow = worksheet.getRow(4);
    tableHeaderRow.height = 25;
    tableHeaderRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 5. Add Data Rows
    let currentRowIndex = 5;

    // Calculate Previous Month for Exit Date logic
    const [year, m] = month.split('-').map(Number);
    const prevDate = new Date(year, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    rawData.forEach((item, index) => {
      // Conditional Date Display Logic
      const joiningDisplay = (item.date_of_joining && item.date_of_joining.startsWith(month)) ? item.date_of_joining : '';
      const exitDisplay = (item.date_of_exit && item.date_of_exit.startsWith(prevMonth)) ? item.date_of_exit : '';

      const row = worksheet.addRow({
        sno: index + 1,
        name: item.employee_name,
        project: item.project || '',
        site: item.site || '',
        doj: joiningDisplay,
        doe: exitDisplay,
        bank: `${item.bank} (A/C ${item.account_no})`,
        rate: item.p_day_wage,
        days: item.wage_days,
        gross: { formula: `H${currentRowIndex}*I${currentRowIndex}`, result: item.gross_salary },
        epf: item.epf_deduction,
        esic: item.esic_deduction,
        other_ded: item.other_deduction,
        other_ben: item.other_benefit,
        adv: item.advance_deduction,
        net: { 
          formula: `J${currentRowIndex}-(K${currentRowIndex}+L${currentRowIndex}+M${currentRowIndex}+O${currentRowIndex})+N${currentRowIndex}`, 
          result: item.net_salary 
        }
      });

      // Alternating row background
      const rowFill = (index % 2 === 1) ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : null;

      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle' };
        if (rowFill) cell.fill = rowFill;

        if (colNumber >= 8) {
          cell.numFmt = '#,##0.00';
          cell.alignment.horizontal = 'right';
        }
      });

      // Highlight Special Columns
      const dojCell = row.getCell('doj');
      if (joiningDisplay) {
        dojCell.font = { color: { argb: 'FF0369A1' }, bold: true }; // Blue-700
      }

      const doeCell = row.getCell('doe');
      if (exitDisplay) {
        doeCell.font = { color: { argb: 'FFBE123C' }, bold: true }; // Rose-700
      }

      const netCell = row.getCell('net');
      netCell.font = { bold: true, color: { argb: 'FF047857' } }; // Emerald-700
      netCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };

      currentRowIndex++;
    });

    // 6. Totals Row
    const totalRow = worksheet.addRow({
      name: 'TOTALS',
      gross: { formula: `SUM(J5:J${currentRowIndex - 1})` },
      epf: { formula: `SUM(K5:K${currentRowIndex - 1})` },
      esic: { formula: `SUM(L5:L${currentRowIndex - 1})` },
      other_ded: { formula: `SUM(M5:M${currentRowIndex - 1})` },
      other_ben: { formula: `SUM(N5:N${currentRowIndex - 1})` },
      adv: { formula: `SUM(O5:O${currentRowIndex - 1})` },
      net: { formula: `SUM(P5:P${currentRowIndex - 1})` }
    });

    totalRow.height = 25;
    totalRow.font = { bold: true };
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = borderStyle;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slate-100
      if (colNumber >= 10) {
        cell.numFmt = '#,##0.00';
      }
    });

    // 7. Send response
    // Generate Excel buffer before setting response headers
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Wages_${month}.xlsx`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (error) {
    console.error('Excel Export Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel report' });
  }
}
