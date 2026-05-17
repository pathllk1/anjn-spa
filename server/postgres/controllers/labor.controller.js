import { getSql } from '../config/pg.config.js';
import { accountingService } from '../services/accounting.service.js';
import ExcelJS from 'exceljs';

export const laborController = {
  
  // ── Labor Leaders ────────────────────────────────────────────────────────
  async getLeaders(req, res) {
    const sql = getSql();
    try {
      const { firm_id } = req.query;
      const leaders = await sql`
        SELECT * FROM labor_leaders 
        WHERE firm_id = ${firm_id} 
        ORDER BY name ASC
      `;
      res.json({ success: true, data: leaders });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createLeader(req, res) {
    const sql = getSql();
    if (!sql) {
      return res.status(503).json({ success: false, message: 'Database connection not ready' });
    }

    try {
      const { firm_id, name, phone, bank_name, account_number, ifsc_code } = req.body;
      
      // Robust handling: treat empty strings or undefined as NULL for optional fields
      const b_name = (bank_name && String(bank_name).trim()) || null;
      const a_num  = (account_number && String(account_number).trim()) || null;
      const i_code = (ifsc_code && String(ifsc_code).trim()) || null;

      const [leader] = await sql`
        INSERT INTO labor_leaders (firm_id, name, phone, bank_name, account_number, ifsc_code)
        VALUES (${firm_id}, ${name}, ${phone}, ${b_name}, ${a_num}, ${i_code})
        RETURNING *
      `;
      res.json({ success: true, data: leader });
    } catch (err) {
      console.error('[CREATE_LEADER_ERROR]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateLeader(req, res) {
    const sql = getSql();
    if (!sql) {
      return res.status(503).json({ success: false, message: 'Database connection not ready' });
    }

    try {
      const { id } = req.params;
      const { name, phone, bank_name, account_number, ifsc_code, status } = req.body;

      const b_name = (bank_name !== undefined) ? ((bank_name && String(bank_name).trim()) || null) : undefined;
      const a_num  = (account_number !== undefined) ? ((account_number && String(account_number).trim()) || null) : undefined;
      const i_code = (ifsc_code !== undefined) ? ((ifsc_code && String(ifsc_code).trim()) || null) : undefined;

      const [leader] = await sql`
        UPDATE labor_leaders 
        SET 
          name = ${name || sql`name`},
          phone = ${phone || sql`phone`},
          bank_name = ${b_name !== undefined ? b_name : sql`bank_name`},
          account_number = ${a_num !== undefined ? a_num : sql`account_number`},
          ifsc_code = ${i_code !== undefined ? i_code : sql`ifsc_code`},
          status = ${status || sql`status`},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      if (!leader) {
        return res.status(404).json({ success: false, message: 'Leader not found' });
      }

      res.json({ success: true, data: leader });
    } catch (err) {
      console.error('[UPDATE_LEADER_ERROR]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteLeader(req, res) {
    const sql = getSql();
    if (!sql) {
      return res.status(503).json({ success: false, message: 'Database connection not ready' });
    }

    try {
      const { id } = req.params;

      // Check if leader has associated periods
      const periods = await sql`SELECT id FROM labor_periods WHERE leader_id = ${id} LIMIT 1`;
      if (periods.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot delete leader with active or past work periods. Delete the periods first or deactivate the leader instead.' 
        });
      }

      const result = await sql`DELETE FROM labor_leaders WHERE id = ${id}`;
      
      res.json({ success: true, message: 'Leader deleted successfully' });
    } catch (err) {
      console.error('[DELETE_LEADER_ERROR]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── Labor Periods ────────────────────────────────────────────────────────
  async getPeriods(req, res) {
    const sql = getSql();
    try {
      const { firm_id, leader_id } = req.query;
      const periods = await sql`
        SELECT p.*, l.name as leader_name 
        FROM labor_periods p
        JOIN labor_leaders l ON l.id = p.leader_id
        WHERE p.firm_id = ${firm_id} 
        ${leader_id ? sql`AND p.leader_id = ${leader_id}` : sql``}
        ORDER BY p.start_date DESC
      `;
      res.json({ success: true, data: periods });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getPeriodById(req, res) {
    const sql = getSql();
    try {
      const { id } = req.params;
      const [period] = await sql`
        SELECT p.*, l.name as leader_name 
        FROM labor_periods p
        JOIN labor_leaders l ON l.id = p.leader_id
        WHERE p.id = ${id}
      `;
      if (!period) {
        return res.status(404).json({ success: false, message: `Work period ${id} not found` });
      }
      res.json({ success: true, data: period });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createPeriod(req, res) {
    const sql = getSql();
    try {
      const { firm_id, leader_id, start_date, end_date } = req.body;
      const [period] = await sql`
        INSERT INTO labor_periods (firm_id, leader_id, start_date, end_date)
        VALUES (${firm_id}, ${leader_id}, ${start_date}, ${end_date})
        RETURNING *
      `;
      res.json({ success: true, data: period });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updatePeriod(req, res) {
    const sql = getSql();
    if (!sql) {
      return res.status(503).json({ success: false, message: 'Database not ready' });
    }
    try {
      const { id } = req.params;
      const { leader_id, start_date, end_date } = req.body;

      // Safety check: Only allow editing 'Open' periods
      const [existing] = await sql`SELECT status FROM labor_periods WHERE id = ${id}`;
      if (!existing) {
        console.error(`[LABOR_UPDATE] Period ${id} not found in DB`);
        return res.status(404).json({ success: false, message: `Period with ID ${id} not found in database` });
      }
      if (existing.status !== 'Open') {
        return res.status(400).json({ success: false, message: 'Only Open periods can be edited' });
      }

      const [period] = await sql`
        UPDATE labor_periods
        SET 
          leader_id = ${leader_id || sql`leader_id`},
          start_date = ${start_date || sql`start_date`},
          end_date = ${end_date || sql`end_date`},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      res.json({ success: true, data: period });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deletePeriod(req, res) {
    const sql = getSql();
    if (!sql) {
      return res.status(503).json({ success: false, message: 'Database not ready' });
    }
    try {
      const { id } = req.params;
      
      // Safety check: Only allow deleting 'Open' periods with no payments
      const [period] = await sql`SELECT status FROM labor_periods WHERE id = ${id}`;
      if (!period) {
        return res.status(404).json({ success: false, message: 'Period not found' });
      }
      if (period.status !== 'Open') {
        return res.status(400).json({ success: false, message: 'Only Open periods can be deleted' });
      }

      const advances = await sql`SELECT id FROM labor_advances WHERE period_id = ${id} LIMIT 1`;
      if (advances.length > 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete period with existing advance payments' });
      }

      await sql`DELETE FROM labor_periods WHERE id = ${id}`;
      res.json({ success: true, message: 'Period deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── Period Details (Aggregated) ──────────────────────────────────────────
  async getPeriodDetails(req, res) {
    const sql = getSql();
    try {
      const { id } = req.params;
      
      const [period] = await sql`
        SELECT p.*, l.name as leader_name 
        FROM labor_periods p
        JOIN labor_leaders l ON l.id = p.leader_id
        WHERE p.id = ${id}
      `;

      if (!period) {
        return res.status(404).json({ success: false, message: 'Period not found' });
      }

      const workers = await sql`
        SELECT * FROM labor_workers WHERE period_id = ${id} ORDER BY created_at ASC
      `;

      const attendance = await sql`
        SELECT a.* FROM labor_attendance a
        JOIN labor_workers w ON w.id = a.worker_id
        WHERE w.period_id = ${id}
      `;

      const expenses = await sql`
        SELECT * FROM labor_expenses WHERE period_id = ${id} ORDER BY created_at ASC
      `;

      const advances = await sql`
        SELECT * FROM labor_advances WHERE period_id = ${id} ORDER BY payment_date DESC
      `;

      const settlements = await sql`
        SELECT * FROM labor_settlements WHERE period_id = ${id}
      `;

      res.json({
        success: true,
        data: {
          period,
          workers,
          attendance,
          expenses,
          advances,
          settlements
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async exportToExcel(req, res) {
    const sql = getSql();
    try {
      const { id } = req.params;
      console.log(`[EXCEL_EXPORT] Request received for Period ID: ${id}`);
      
      // 1. Fetch Data (Reusing logic from getPeriodDetails)
      const [period] = await sql`
        SELECT p.*, l.name as leader_name 
        FROM labor_periods p
        JOIN labor_leaders l ON l.id = p.leader_id
        WHERE p.id = ${id}
      `;
      if (!period) {
        return res.status(404).json({ success: false, message: 'Excel Export: Period not found in database' });
      }

      const workers = await sql`SELECT * FROM labor_workers WHERE period_id = ${id} ORDER BY labor_name ASC`;
      const attendance = await sql`
        SELECT a.* FROM labor_attendance a
        JOIN labor_workers w ON w.id = a.worker_id
        WHERE w.period_id = ${id}
      `;
      const expenses = await sql`SELECT * FROM labor_expenses WHERE period_id = ${id} ORDER BY created_at ASC`;
      const advances = await sql`SELECT * FROM labor_advances WHERE period_id = ${id} ORDER BY payment_date DESC`;
      const [settlement] = await sql`SELECT * FROM labor_settlements WHERE period_id = ${id}`;

      // 2. Setup Workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Gemini ERP';
      workbook.lastModifiedBy = 'Gemini ERP';
      workbook.created = new Date();

      // Styles
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo 600
      const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
      const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slate 50
      const borderStyle = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

      // ── SHEET 1: SUMMARY ───────────────────────────────────────────
      const summarySheet = workbook.addWorksheet('Overview', { views: [{ showGridLines: false }] });
      summarySheet.getColumn('B').width = 25;
      summarySheet.getColumn('C').width = 40;

      summarySheet.mergeCells('B2:C2');
      const titleCell = summarySheet.getCell('B2');
      titleCell.value = 'LABOR PERIOD SUMMARY';
      titleCell.font = { size: 20, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center' };

      const summaryRows = [
        ['', 'Leader Name', period.leader_name],
        ['', 'Date Range', `${new Date(period.start_date).toLocaleDateString()} to ${new Date(period.end_date).toLocaleDateString()}`],
        ['', 'Status', period.status],
        ['', 'Batch ID', period.id],
        ['', '', ''],
        ['', 'FINANCIAL SNAPSHOT', ''],
        ['', 'Total Wages', workers.reduce((sum, w) => sum + Number(w.total_wages), 0)],
        ['', 'Misc Expenses', expenses.reduce((sum, e) => sum + Number(e.amount), 0)],
        ['', 'Total Advances', advances.reduce((sum, a) => sum + Number(a.amount), 0)],
        ['', 'Net Payable', settlement ? settlement.net_payable : 0],
      ];

      summarySheet.addRows(summaryRows);
      
      // Styling summary snapshot
      summarySheet.getCell('B8').font = { bold: true, size: 14 };
      summarySheet.getCell('C9').numFmt = '\"₹\"#,##0.00';
      summarySheet.getCell('C10').numFmt = '\"₹\"#,##0.00';
      summarySheet.getCell('C11').numFmt = '\"₹\"#,##0.00';
      summarySheet.getCell('C12').numFmt = '\"₹\"#,##0.00';
      summarySheet.getCell('C12').font = { bold: true, color: { argb: 'FF10B981' }, size: 14 };

      // ── SHEET 2: ATTENDANCE & WAGES ─────────────────────────────
      const attSheet = workbook.addWorksheet('Attendance Grid');
      
      // Calculate dates
      const start = new Date(period.start_date);
      const end = new Date(period.end_date);
      const dateList = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dateList.push(new Date(d));
      }

      // Headers
      const headers = ['Labor Name', 'Daily Wage', ...dateList.map(d => d.getDate()), 'Present', 'Total Wages'];
      const headerRow = attSheet.addRow(headers);
      headerRow.eachCell((cell, colNumber) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center' };
        cell.border = borderStyle;
      });

      attSheet.getColumn(1).width = 30;
      attSheet.getColumn(2).width = 15;
      attSheet.getColumn(headers.length).width = 20;

      // Data Rows
      workers.forEach(w => {
        const rowData = [w.labor_name, Number(w.daily_wage)];
        
        dateList.forEach(d => {
          const dateStr = d.toISOString().split('T')[0];
          const entry = attendance.find(a => a.worker_id === w.id && new Date(a.attendance_date).toISOString().split('T')[0] === dateStr);
          rowData.push(entry ? entry.status : '-');
        });

        rowData.push(w.total_present_days);
        rowData.push(Number(w.total_wages));

        const row = attSheet.addRow(rowData);
        row.getCell(2).numFmt = '\"₹\"#,##0';
        row.getCell(headers.length).numFmt = '\"₹\"#,##0';
        
        // Color code attendance status
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          if (colNumber > 2 && colNumber <= (2 + dateList.length)) {
            if (cell.value === 'P') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Emerald 100
              cell.font = { color: { argb: 'FF059669' }, bold: true };
            } else if (cell.value === 'L') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Red 100
              cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            }
            cell.alignment = { horizontal: 'center' };
          }
        });
      });

      // ── SHEET 3: EXPENSES ────────────────────────────────────────
      const expSheet = workbook.addWorksheet('Miscellaneous Expenses');
      expSheet.addRow(['Description', 'Amount', 'Date Recorded']).font = { bold: true };
      expSheet.getColumn(1).width = 40;
      expSheet.getColumn(2).width = 20;
      expSheet.getColumn(3).width = 25;

      expenses.forEach(e => {
        const row = expSheet.addRow([e.description, Number(e.amount), new Date(e.created_at).toLocaleString()]);
        row.getCell(2).numFmt = '\"₹\"#,##0.00';
      });

      // ── SHEET 4: ADVANCES ────────────────────────────────────────
      const advSheet = workbook.addWorksheet('Advances & Payments');
      advSheet.addRow(['Payment Date', 'Description', 'Amount', 'Type']).font = { bold: true };
      advSheet.getColumn(1).width = 25;
      advSheet.getColumn(2).width = 40;
      advSheet.getColumn(3).width = 20;

      advances.forEach(a => {
        const row = advSheet.addRow([new Date(a.payment_date).toLocaleDateString(), 'Advance Issued', Number(a.amount), 'Advance']);
        row.getCell(3).numFmt = '\"₹\"#,##0.00';
        row.getCell(4).font = { color: { argb: 'FFD97706' }, bold: true }; // Amber 600
      });

      if (settlement) {
        const row = advSheet.addRow([new Date(settlement.payment_date).toLocaleDateString(), 'Final Settlement', Number(settlement.net_payable), 'Settlement']);
        row.getCell(3).numFmt = '\"₹\"#,##0.00';
        row.getCell(4).font = { color: { argb: 'FF059669' }, bold: true }; // Emerald 600
      }

      // 3. Send Response
      const filename = `Labor_Report_${period.leader_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

      await workbook.xlsx.write(res);
      res.end();

    } catch (err) {
      console.error('[EXPORT_EXCEL_ERROR]', err);
      res.status(500).send('Internal Server Error');
    }
  },

  // ── Sync Attendance & Expenses (Dynamic Grid) ────────────────────────────
  async syncPeriodData(req, res) {
    const sql = getSql();
    try {
      const { id } = req.params;
      const { workers, expenses } = req.body;

      await sql.begin(async (sql) => {
        // 1. Sync Workers and their Attendance
        for (const w of workers) {
          let workerId = w.id;
          
          if (!workerId || String(workerId).length < 30) { // New worker
            const [newWorker] = await sql`
              INSERT INTO labor_workers (period_id, labor_name, daily_wage)
              VALUES (${id}, ${w.labor_name}, ${w.daily_wage})
              RETURNING id
            `;
            workerId = newWorker.id;
          } else {
            await sql`
              UPDATE labor_workers 
              SET labor_name = ${w.labor_name}, daily_wage = ${w.daily_wage}
              WHERE id = ${workerId}
            `;
          }

          // Sync Attendance for this worker
          if (w.attendance && Array.isArray(w.attendance)) {
            let presentDays = 0;
            for (const att of w.attendance) {
              await sql`
                INSERT INTO labor_attendance (worker_id, attendance_date, status)
                VALUES (${workerId}, ${att.date}, ${att.status})
                ON CONFLICT (worker_id, attendance_date) 
                DO UPDATE SET status = EXCLUDED.status
              `;
              if (att.status === 'P') presentDays += 1;
            }
            
            // Recalculate totals
            const totalWages = presentDays * w.daily_wage;
            await sql`
              UPDATE labor_workers 
              SET total_present_days = ${presentDays}, total_wages = ${totalWages}
              WHERE id = ${workerId}
            `;
          }
        }

        // 2. Sync Expenses
        // For simplicity, we delete existing and re-insert for the period
        await sql`DELETE FROM labor_expenses WHERE period_id = ${id}`;
        if (expenses && Array.isArray(expenses)) {
          for (const exp of expenses) {
            if (exp.description && exp.amount > 0) {
              await sql`
                INSERT INTO labor_expenses (period_id, description, amount)
                VALUES (${id}, ${exp.description}, ${exp.amount})
              `;
            }
          }
        }
      });

      res.json({ success: true, message: 'Period data synced successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── Payments & Accounting ────────────────────────────────────────────────
  async payAdvance(req, res) {
    const sql = getSql();
    try {
      const { firm_id, period_id, amount, payment_date, bank_account_id, leader_name, created_by } = req.body;

      // 1. Post to MongoDB Ledger
      const voucherGroupId = await accountingService.postLaborAdvance({
        firm_id, amount, payment_date, bank_account_id, leader_name, created_by
      });

      // 2. Save to Postgres
      const [advance] = await sql`
        INSERT INTO labor_advances (firm_id, period_id, amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id)
        VALUES (${firm_id}, ${period_id}, ${amount}, ${payment_date}, ${bank_account_id}, ${voucherGroupId})
        RETURNING *
      `;

      res.json({ success: true, data: advance });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async settlePeriod(req, res) {
    const sql = getSql();
    try {
      const { 
        firm_id, period_id, total_wages, total_expenses, total_advances, 
        net_payable, paid_amount, adjustment_reason, payment_date, 
        bank_account_id, leader_name, created_by 
      } = req.body;

      // 1. Post to MongoDB Ledger
      const voucherGroupId = await accountingService.postLaborSettlement({
        firm_id, total_wages, total_expenses, total_advances, net_payable, 
        paid_amount, adjustment_reason, payment_date, bank_account_id, 
        leader_name, created_by
      });

      // 2. Save to Postgres
      await sql.begin(async (sql) => {
        await sql`
          INSERT INTO labor_settlements (
            period_id, total_wages, total_expenses, total_advances, 
            net_payable, paid_amount, adjustment_reason, payment_date, 
            paid_from_bank_account_id, ledger_voucher_group_id
          ) VALUES (
            ${period_id}, ${total_wages}, ${total_expenses}, ${total_advances}, 
            ${net_payable}, ${paid_amount}, ${adjustment_reason || null}, ${payment_date}, 
            ${bank_account_id}, ${voucherGroupId}
          )
        `;

        await sql`
          UPDATE labor_periods SET status = 'Settled' WHERE id = ${period_id}
        `;
      });

      res.json({ success: true, message: 'Period settled successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
