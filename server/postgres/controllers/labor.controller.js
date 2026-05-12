import { getSql } from '../config/pg.config.js';
import { accountingService } from '../services/accounting.service.js';

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
    try {
      const { firm_id, name, phone, bank_name, account_number, ifsc_code } = req.body;
      const [leader] = await sql`
        INSERT INTO labor_leaders (firm_id, name, phone, bank_name, account_number, ifsc_code)
        VALUES (${firm_id}, ${name}, ${phone}, ${bank_name}, ${account_number}, ${ifsc_code})
        RETURNING *
      `;
      res.json({ success: true, data: leader });
    } catch (err) {
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
        net_payable, payment_date, bank_account_id, leader_name, created_by 
      } = req.body;

      // 1. Post to MongoDB Ledger
      const voucherGroupId = await accountingService.postLaborSettlement({
        firm_id, total_wages, total_expenses, total_advances, net_payable, 
        payment_date, bank_account_id, leader_name, created_by
      });

      // 2. Save to Postgres
      await sql.begin(async (sql) => {
        await sql`
          INSERT INTO labor_settlements (
            period_id, total_wages, total_expenses, total_advances, 
            net_payable, paid_amount, payment_date, 
            paid_from_bank_account_id, ledger_voucher_group_id
          ) VALUES (
            ${period_id}, ${total_wages}, ${total_expenses}, ${total_advances}, 
            ${net_payable}, ${net_payable}, ${payment_date}, 
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
