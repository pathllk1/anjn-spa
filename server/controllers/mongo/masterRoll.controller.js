import { MasterRoll, Firm } from '../../models/index.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';

/* ── REQUIRED FIELDS ────────────────────────────────────────────────────── */

const REQUIRED_FIELDS = [
  'employee_name', 'father_husband_name', 'date_of_birth',
  'aadhar', 'phone_no', 'address', 'bank', 'account_no',
  'ifsc', 'date_of_joining',
];

/* ── CREATE ─────────────────────────────────────────────────────────────── */

export const createMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id, fullname, username } = req.user;

    for (const field of REQUIRED_FIELDS) {
      if (!req.body[field]) {
        return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
      }
    }

    const doc = await MasterRoll.create({
      firm_id,
      ...req.body,
      status:     req.body.status ?? 'Active',
      created_by: user_id,
      updated_by: user_id,
    });

    res.status(201).json({
      success:    true,
      id:         doc._id,
      message:    'Employee added to master roll',
      created_by: { id: user_id, name: fullname, username },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Employee with this Aadhar already exists in your firm' });
    }
    res.status(400).json({ success: false, error: err.message });
  }
};

/* ── READ ALL ────────────────────────────────────────────────────────────── */

export const getAllMasterRolls = async (req, res) => {
  try {
    const { firm_id, role } = req.user;
    const { activeOnly, all_firms } = req.query;

    const filter = (role === 'admin' && all_firms === 'true') ? {} : { firm_id };

    if (activeOnly === 'true') {
      filter.status = 'Active';
    }

    const rows = await MasterRoll.find(filter)
      .populate('firm_id',    'name code')
      .populate('created_by', 'fullname username')
      .populate('updated_by', 'fullname username')
      .sort({ createdAt: -1 })
      .lean();

    // Transform _id to id for frontend compatibility
    const transformedRows = rows.map(row => ({
      ...row,
      id: row._id.toString(),
      _id: row._id.toString()  // Keep _id for MongoDB operations
    }));

    res.json({ success: true, count: transformedRows.length, data: transformedRows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── READ ONE ────────────────────────────────────────────────────────────── */

export const getMasterRollById = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const row = await MasterRoll.findOne({ _id: req.params.id, firm_id })
      .populate('firm_id',    'name code')
      .populate('created_by', 'fullname username')
      .populate('updated_by', 'fullname username')
      .lean();

    if (!row) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    // Transform _id to id for frontend compatibility
    const transformedRow = {
      ...row,
      id: row._id.toString(),
      _id: row._id.toString()
    };

    res.json({ success: true, data: transformedRow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── UPDATE ─────────────────────────────────────────────────────────────── */

export const updateMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id, role } = req.user;
    const { id } = req.params;

    const filter = role === 'super_admin' ? { _id: id } : { _id: id, firm_id };
    const existing = await MasterRoll.findOne(filter);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    // Apply partial update — only overwrite fields present in the request body
    const UPDATABLE = [
      'employee_name', 'father_husband_name', 'date_of_birth', 'aadhar', 'pan',
      'phone_no', 'address', 'bank', 'account_no', 'ifsc', 'branch', 'uan',
      'esic_no', 's_kalyan_no', 'category', 'p_day_wage', 'project', 'site',
      'date_of_joining', 'date_of_exit', 'doe_rem', 'status',
    ];

    for (const field of UPDATABLE) {
      if (req.body[field] !== undefined) existing[field] = req.body[field];
    }
    existing.updated_by = user_id;

    await existing.save();

    console.log(`[UPDATE] Employee ${id} updated successfully`);
    res.json({ success: true, message: 'Employee updated successfully', updated_by: user_id });
  } catch (err) {
    console.error('[UPDATE] Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

/* ── DELETE ─────────────────────────────────────────────────────────────── */

export const deleteMasterRoll = async (req, res) => {
  try {
    const { firm_id, role } = req.user;
    const { id } = req.params;

    const filter = role === 'super_admin' ? { _id: id } : { _id: id, firm_id };
    const deleted = await MasterRoll.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── SEARCH ─────────────────────────────────────────────────────────────── */

export const searchMasterRolls = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { q, limit = 50, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const regex = new RegExp(q, 'i');

    const rows = await MasterRoll.find({
      firm_id,
      $or: [
        { employee_name: regex },
        { aadhar:        regex },
        { phone_no:      regex },
        { project:       regex },
        { site:          regex },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── STATISTICS ─────────────────────────────────────────────────────────── */

export const getMasterRollStats = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const [result] = await MasterRoll.aggregate([
     { $match: { firm_id: new mongoose.Types.ObjectId(firm_id) } },
      {
        $group: {
          _id:              null,
          total_employees:  { $sum: 1 },
          active_employees: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          exited_employees: { $sum: { $cond: [{ $ifNull: ['$date_of_exit', false] }, 1, 0] } },
          total_projects:   { $addToSet: '$project' },
          total_sites:      { $addToSet: '$site' },
        },
      },
      {
        $project: {
          _id:              0,
          total_employees:  1,
          active_employees: 1,
          exited_employees: 1,
          total_projects:   { $size: '$total_projects' },
          total_sites:      { $size: '$total_sites' },
        },
      },
    ]);

    res.json({ success: true, data: result ?? { total_employees: 0, active_employees: 0, exited_employees: 0, total_projects: 0, total_sites: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── ACTIVITY LOG ────────────────────────────────────────────────────────── */

export const getActivityLog = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const doc = await MasterRoll.findOne({ _id: req.params.id, firm_id })
      .populate('created_by', 'fullname username role')
      .populate('updated_by', 'fullname username role')
      .lean();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    const activities = [
      {
        action:    'created',
        timestamp: doc.createdAt,
        user_name: doc.created_by?.fullname ?? null,
        username:  doc.created_by?.username ?? null,
        user_role: doc.created_by?.role     ?? null,
      },
    ];

    // Only add an 'updated' entry if the document was actually modified after creation
    if (doc.updatedAt && doc.updatedAt.getTime() !== doc.createdAt.getTime()) {
      activities.push({
        action:    'updated',
        timestamp: doc.updatedAt,
        user_name: doc.updated_by?.fullname ?? null,
        username:  doc.updated_by?.username ?? null,
        user_role: doc.updated_by?.role     ?? null,
      });
    }

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, count: activities.length, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── BULK IMPORT ─────────────────────────────────────────────────────────── */

export const bulkImportMasterRolls = async (req, res) => {
  try {
    const { firm_id, role, id: user_id } = req.user;
    const { employees } = req.body;

    if (role === 'user') {
      return res.status(403).json({ success: false, error: 'Only managers and admins can bulk import' });
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid employees array' });
    }

    const settled = await Promise.allSettled(
      employees.map((emp, i) =>
        MasterRoll.create({ firm_id, ...emp, created_by: user_id, updated_by: user_id })
          .then(doc => ({ index: i, id: doc._id, name: emp.employee_name }))
      )
    );

    const success = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed  = settled
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ index: i, name: employees[i]?.employee_name, error: r.reason.message }));

    res.status(201).json({ success: true, imported: success.length, failed: failed.length, details: { success, failed } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── BULK CREATE (raw array body) ────────────────────────────────────────── */

export const bulkCreateMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id } = req.user;
    const rows = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    let successCount = 0;
    const errors = [];

    for (const item of rows) {
      if (!item.employee_name || !item.aadhar) {
        errors.push('Skipped row: Missing Name or Aadhar');
        continue;
      }

      try {
        await MasterRoll.create({
          firm_id,
          employee_name:       item.employee_name,
          father_husband_name: item.father_husband_name ?? '',
          date_of_birth:       item.date_of_birth       ?? '',
          aadhar:              String(item.aadhar),
          pan:                 item.pan                 ?? null,
          phone_no:            String(item.phone_no ?? ''),
          address:             item.address             ?? '',
          bank:                item.bank                ?? '',
          account_no:          String(item.account_no ?? ''),
          ifsc:                item.ifsc                ?? '',
          branch:              item.branch              ?? null,
          uan:                 item.uan                 ?? null,
          esic_no:             item.esic_no             ?? null,
          s_kalyan_no:         item.s_kalyan_no         ?? null,
          category:            item.category            ?? 'UNSKILLED',
          p_day_wage:          item.p_day_wage          ?? 0,
          project:             item.project             ?? null,
          site:                item.site                ?? null,
          date_of_joining:     item.date_of_joining     ?? new Date().toISOString().split('T')[0],
          date_of_exit:        item.date_of_exit        ?? null,
          doe_rem:             item.doe_rem             ?? null,
          status:              item.status              ?? 'Active',
          created_by:          user_id,
          updated_by:          user_id,
        });
        successCount++;
      } catch (err) {
        if (err.code === 11000) {
          errors.push(`Duplicate Aadhar: ${item.aadhar} (${item.employee_name})`);
        } else {
          errors.push(`Error for ${item.employee_name}: ${err.message}`);
        }
      }
    }

    res.json({
      success:  true,
      message:  `Processed ${rows.length} rows.`,
      imported: successCount,
      failed:   errors.length,
      errors,
    });
  } catch (err) {
    console.error('Bulk create error:', err);
    res.status(500).json({ success: false, error: 'Bulk upload failed on server.' });
  }
};

/* ── BULK DELETE ─────────────────────────────────────────────────────────── */

export const bulkDeleteMasterRolls = async (req, res) => {
  try {
    const { firm_id, role, id: user_id, fullname, username } = req.user;
    const { ids } = req.body;

    if (role === 'user') {
      return res.status(403).json({ success: false, error: 'Only managers and admins can bulk delete employees' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No employee IDs provided' });
    }

    let successCount = 0;
    const failedIds = [];

    for (const id of ids) {
      try {
        const deleted = await MasterRoll.findOneAndDelete({ _id: id, firm_id });
        if (deleted) {
          successCount++;
        } else {
          failedIds.push({ id, reason: 'Not found or access denied' });
        }
      } catch (err) {
        failedIds.push({ id, reason: err.message });
      }
    }

    res.json({
      success:    true,
      message:    `Deleted ${successCount} out of ${ids.length} employees`,
      deleted:    successCount,
      failed:     failedIds.length,
      failedIds,
      deleted_by: { id: user_id, name: fullname, username, role },
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, error: 'Bulk delete failed on server' });
  }
};

/* ── BULK UPDATE ─────────────────────────────────────────────────────────── */

export const bulkUpdateMasterRolls = async (req, res) => {
  try {
    const { firm_id, id: user_id } = req.user;
    const { updates } = req.body; // Expecting array of { id, data }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    const UPDATABLE = [
      'employee_name', 'father_husband_name', 'date_of_birth', 'aadhar', 'pan',
      'phone_no', 'address', 'bank', 'account_no', 'ifsc', 'branch', 'uan',
      'esic_no', 's_kalyan_no', 'category', 'p_day_wage', 'project', 'site',
      'date_of_joining', 'date_of_exit', 'doe_rem', 'status',
    ];

    let successCount = 0;
    const errors = [];

    for (const update of updates) {
      const { id, data } = update;
      if (!id || !data) continue;

      try {
        const doc = await MasterRoll.findOne({ _id: id, firm_id });
        if (!doc) {
          errors.push(`Employee ${id} not found`);
          continue;
        }

        for (const field of UPDATABLE) {
          if (data[field] !== undefined) doc[field] = data[field];
        }
        doc.updated_by = user_id;
        await doc.save();
        successCount++;
      } catch (err) {
        errors.push(`Error updating ${id}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Updated ${successCount} employees`,
      updated: successCount,
      failed: errors.length,
      errors
    });
  } catch (err) {
    console.error('Bulk update error:', err);
    res.status(500).json({ success: false, error: 'Bulk update failed on server' });
  }
};

/* ── EXPORT ──────────────────────────────────────────────────────────────── */

export const exportMasterRolls = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const rows = await MasterRoll.find({ firm_id }).sort({ createdAt: -1 }).lean();
    const format = req.query.format ?? 'json';
    const selectedIds = req.query.selectedIds ? req.query.selectedIds.split(',') : null;

    // Filter to selected rows if provided
    let dataToExport = rows;
    if (selectedIds && selectedIds.length > 0) {
      dataToExport = rows.filter(row => selectedIds.includes(row._id.toString()));
    }

    if (dataToExport.length === 0) {
      return res.status(404).json({ success: false, message: 'No data to export' });
    }

    // Column definitions matching client-side
    const columns = [
      { key: 'employee_name', label: 'Employee Name' },
      { key: 'status', label: 'Status' },
      { key: 'father_husband_name', label: 'Father/Husband' },
      { key: 'aadhar', label: 'Aadhar' },
      { key: 'pan', label: 'PAN' },
      { key: 'phone_no', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'bank', label: 'Bank' },
      { key: 'account_no', label: 'Account No' },
      { key: 'ifsc', label: 'IFSC' },
      { key: 'uan', label: 'UAN' },
      { key: 'esic_no', label: 'ESIC No' },
      { key: 's_kalyan_no', label: 'S Kalyan No' },
      { key: 'category', label: 'Category' },
      { key: 'p_day_wage', label: 'Daily Wage' },
      { key: 'project', label: 'Project' },
      { key: 'site', label: 'Site' },
      { key: 'date_of_birth', label: 'DOB' },
      { key: 'date_of_joining', label: 'Joining Date' },
      { key: 'date_of_exit', label: 'Exit Date' },
      { key: 'doe_rem', label: 'Remarks' }
    ];

    if (format === 'csv') {
      const headers = columns.map(col => col.label).join(',');
      const csvRows = dataToExport.map(row =>
        columns.map(col => {
          const val = row[col.key] ?? '';
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=master_rolls.csv');
      return res.send([headers, ...csvRows].join('\n'));
    }

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Master Roll');

      // Add header row with Sl No column first
      const headerLabels = ['Sl No', ...columns.map(col => col.label)];
      ws.addRow(headerLabels);
      const headerRow = ws.getRow(1);

      // Style header row: bold, blue background, white text, centered, borders
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; // Dark blue
      headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: false };

      // Add borders to header
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      // Add data rows with alternating colors and borders
      dataToExport.forEach((row, idx) => {
        const rowData = [idx + 1, ...columns.map(col => row[col.key] ?? '')]; // Add serial number
        const excelRow = ws.addRow(rowData);

        // Alternating row colors (white and light blue)
        const bgColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFE7F0F7'; // Light blue for alternating rows
        excelRow.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
          };

          // Status column (column 3: Sl No=1, Status=2, so index 2) - add color formatting
          if (colNum === 3) { // Status is the 3rd column (after Sl No and Employee Name)
            const status = cell.value;
            if (status === 'Active') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Light green
              cell.font = { color: { argb: 'FF006100' } }; // Dark green text
            } else if (status === 'Inactive') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Light red
              cell.font = { color: { argb: 'FF9C0006' } }; // Dark red text
            } else if (status && status.toLowerCase() === 'left') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } }; // Light yellow/orange
              cell.font = { color: { argb: 'FF9C6500' } }; // Dark orange text
            }
          }

          // Determine which columns need wrapping (Address, Remarks)
          const wrapColumns = ['Address', 'Remarks', 'Father/Husband'];
          const columnLabel = headerLabels[colNum - 1];
          const shouldWrap = wrapColumns.includes(columnLabel);

          // All cells aligned to top for consistency
          cell.alignment = {
            horizontal: 'left',
            vertical: 'top',
            wrapText: shouldWrap
          };
        });
      });

      // Set column widths - Sl No first, then others
      const columnWidths = [
        8,  // Sl No
        20, // Employee Name
        12, // Status
        20, // Father/Husband
        15, // Aadhar
        12, // PAN
        15, // Phone
        30, // Address (wider for wrapping)
        15, // Bank
        18, // Account No
        15, // IFSC (increased width)
        12, // UAN
        12, // ESIC No
        15, // S Kalyan No
        15, // Category
        12, // Daily Wage
        15, // Project
        15, // Site
        12, // DOB
        15, // Joining Date
        12, // Exit Date
        25  // Remarks (wider for wrapping)
      ];
      ws.columns.forEach((col, idx) => {
        col.width = columnWidths[idx] || 15;
      });

      // Set row height for header
      headerRow.height = 25;

      // Freeze header row
      ws.views = [{ state: 'frozen', ySplit: 1 }];

      // Generate buffer and send
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=master_rolls.xlsx');
      return res.send(buffer);
    }

    res.json({ success: true, count: dataToExport.length, data: dataToExport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── EXPORT I-CARDS ─────────────────────────────────────────────────────── */

export const exportICards = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { project, site, category, format } = req.query;

    /* ── Filter employees ─────────────────────────────────────────────── */
    const filter = { firm_id, status: 'Active' };
    if (project)  filter.project  = project;
    if (site)     filter.site     = site;
    if (category) filter.category = category;

    const employees = await MasterRoll.find(filter).sort({ employee_name: 1 }).lean();
    const firm      = await Firm.findById(firm_id).lean();
    const firmName  = firm?.name ?? 'Your Company';

    if (!employees.length) {
      return res.status(404).json({ success: false, error: 'No employees found for the given filters' });
    }

    /* ════════════════════════════════════════════════════════════════════
       XLSX  —  Card layout using merged cells, 2 cards per row
    ════════════════════════════════════════════════════════════════════ */
    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      wb.creator = firmName;
      wb.created = new Date();

      const ws = wb.addWorksheet('I-Cards', {
        pageSetup: {
          paperSize:   9,     // A4
          orientation: 'landscape',
          fitToPage:   true,
          fitToWidth:  1,
          fitToHeight: 0,
          margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 },
        },
        views: [{ showGridLines: false }],
      });

      /* ── Palette ────────────────────────────────────────────────────── */
      const C = {
        RED:       'FFDC2626',
        RED_L:     'FFFEF2F2',
        RED_M:     'FFFECACA',
        WHITE:     'FFFFFFFF',
        DARK:      'FF111827',
        GRAY:      'FF6B7280',
        GRAY_L:    'FFF9FAFB',
        AMBER:     'FFFEF3C7',
        AMBER_D:   'FF92400E',
      };

      /* ── Card geometry ──────────────────────────────────────────────── */
      // 10 data columns × 22 rows per card; 2 cards per pair, separated by 1 gap col
      const CARD_COLS = 10;
      const CARD_ROWS = 22;
      const GAP_ROWS  = 1;

      // Cols 1-10: Card 1 | Col 11: gap | Cols 12-21: Card 2
      const widths = [7, 7, 7, 5, 8, 5, 7, 7, 7, 7, 2, 7, 7, 7, 5, 8, 5, 7, 7, 7, 7];
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      const setRowHeights = (sr) => {
        const h = [
          22,  // 0  firm header
          12,  // 1  IDENTITY CARD subtitle
          11,  // 2  card no bar
          3,   // 3  spacer
          14,  // 4  name
          12,  // 5  father
          12,  // 6  category
          12,  // 7  phone
          12,  // 8  project
          12,  // 9  site
          12,  // 10 doj
          12,  // 11 photo lower filler
          3,   // 12 spacer
          13,  // 13 address line 1
          13,  // 14 address line 2
          12,  // 15 aadhar
          12,  // 16 uan / esic
          3,   // 17 spacer
          18,  // 18 sig boxes
          10,  // 19 sig labels
          10,  // 20 footer
          0,   // 21 (padding row, 0-height)
        ];
        h.forEach((v, i) => { ws.getRow(sr + i).height = v; });
      };

      /* ── Helper: merge-and-style ────────────────────────────────────── */
      const mc = (r1, c1, r2, c2, opts = {}) => {
        ws.mergeCells(r1, c1, r2, c2);
        const cell = ws.getCell(r1, c1);
        if (opts.value  !== undefined) cell.value = opts.value;
        if (opts.fill)   cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
        if (opts.font)   cell.font      = { name: 'Arial', ...opts.font };
        if (opts.align)  cell.alignment = { wrapText: true, ...opts.align };
        if (opts.border) cell.border    = opts.border;
        return cell;
      };

      const thick = (argb) => ({ top: { style: 'medium', color: { argb } }, left: { style: 'medium', color: { argb } }, bottom: { style: 'medium', color: { argb } }, right: { style: 'medium', color: { argb } } });
      const thin  = (argb) => ({ top: { style: 'thin',   color: { argb } }, left: { style: 'thin',   color: { argb } }, bottom: { style: 'thin',   color: { argb } }, right: { style: 'thin',   color: { argb } } });

      /* ── Draw one card ──────────────────────────────────────────────── */
      const drawCard = (emp, sr, sc) => {
        const ec = sc + CARD_COLS - 1;
        const iNo = emp._id.toString().slice(-8).toUpperCase();
        setRowHeights(sr);

        // Row 0: firm header
        mc(sr+0, sc, sr+0, ec, { value: firmName.toUpperCase(), fill: C.RED, border: thick(C.RED),
          font:  { bold: true, color: { argb: C.WHITE }, size: 12 },
          align: { horizontal: 'center', vertical: 'middle', wrapText: false } });

        // Row 1: IDENTITY CARD
        mc(sr+1, sc, sr+1, ec, { value: 'IDENTITY CARD', fill: C.RED_L, border: thick(C.RED),
          font:  { bold: true, color: { argb: C.RED }, size: 7.5 },
          align: { horizontal: 'center', vertical: 'middle', wrapText: false } });

        // Row 2: card no
        mc(sr+2, sc, sr+2, ec, { value: `CARD NO: ${iNo}`, fill: C.RED_M, border: thick(C.RED),
          font:  { bold: true, color: { argb: C.RED }, size: 7 },
          align: { horizontal: 'right', vertical: 'middle', wrapText: false } });

        // Row 3: spacer
        mc(sr+3, sc, sr+3, ec, { fill: C.RED_L, border: thin(C.RED) });

        // Photo placeholder rows 4-11, cols sc to sc+2
        mc(sr+4, sc, sr+11, sc+2, { value: '[ PHOTO ]', fill: C.GRAY_L, border: thin('FFD1D5DB'),
          font:  { italic: true, color: { argb: C.GRAY }, size: 8 },
          align: { horizontal: 'center', vertical: 'middle', wrapText: false } });

        // Fields rows 4-10
        const fields = [
          { label: 'Name',     value: emp.employee_name,        bold: true,  size: 10 },
          { label: "Father's", value: emp.father_husband_name,  bold: false, size: 9  },
          { label: 'Category', value: emp.category || 'N/A',    bold: false, size: 9  },
          { label: 'Phone',    value: emp.phone_no || 'N/A',    bold: false, size: 9  },
          { label: 'Project',  value: emp.project || 'N/A',     bold: false, size: 9  },
          { label: 'Site',     value: emp.site || 'N/A',        bold: false, size: 9  },
          { label: 'D.O.J.',   value: emp.date_of_joining || 'N/A', bold: false, size: 9 },
        ];
        fields.forEach(({ label, value, bold, size }, idx) => {
          const r = sr + 4 + idx;
          mc(r, sc+3, r, sc+4, { value: label, fill: C.RED_L, border: thin(C.RED),
            font:  { bold: true, color: { argb: C.RED }, size: 7 },
            align: { horizontal: 'left', vertical: 'middle', wrapText: false } });
          mc(r, sc+5, r, ec, { value: value || '—', fill: C.WHITE, border: thin(C.RED),
            font:  { bold, color: { argb: C.DARK }, size },
            align: { horizontal: 'left', vertical: 'middle', wrapText: false } });
        });

        // Row 11: filler right of photo
        mc(sr+11, sc+3, sr+11, ec, { fill: C.WHITE, border: thin(C.RED) });

        // Row 12: spacer
        mc(sr+12, sc, sr+12, ec, { fill: C.WHITE, border: thin(C.RED) });

        // Rows 13-14: Address (2 rows, wrap)
        mc(sr+13, sc, sr+14, ec, {
          value: `Address: ${emp.address || 'N/A'}`, fill: C.RED_L, border: thick(C.RED),
          font:  { color: { argb: C.DARK }, size: 8 },
          align: { horizontal: 'left', vertical: 'middle', wrapText: true } });

        // Row 15: Aadhar
        mc(sr+15, sc, sr+15, ec, {
          value: `Aadhar No: ${emp.aadhar || '—'}`, fill: C.AMBER, border: thin(C.RED),
          font:  { bold: true, color: { argb: C.AMBER_D }, size: 8 },
          align: { horizontal: 'center', vertical: 'middle', wrapText: false } });

        // Row 16: UAN / ESIC  ← split line for visibility
        mc(sr+16, sc, sr+16, ec, {
          value: `UAN: ${emp.uan || '—'}        ESIC No: ${emp.esic_no || '—'}`,
          fill: C.AMBER, border: thin(C.RED),
          font:  { bold: true, color: { argb: C.AMBER_D }, size: 8 },
          align: { horizontal: 'center', vertical: 'middle', wrapText: false } });

        // Row 17: spacer
        mc(sr+17, sc, sr+17, ec, { fill: C.WHITE, border: thin(C.RED) });

        // Rows 18-19: 3 signature sections
        const sigs = [
          { c1: sc,   c2: sc+2,  label: 'Employee Signature'  },
          { c1: sc+3, c2: sc+6,  label: 'Authorized Signatory' },
          { c1: sc+7, c2: ec,    label: 'Official Seal'       },
        ];
        sigs.forEach(({ c1, c2, label }) => {
          mc(sr+18, c1, sr+18, c2, { fill: C.WHITE, border: thin(C.RED) });
          mc(sr+19, c1, sr+19, c2, { value: label, fill: C.GRAY_L, border: thin(C.RED),
            font:  { color: { argb: C.GRAY }, size: 6.5 },
            align: { horizontal: 'center', vertical: 'middle', wrapText: false } });
        });

        // Row 20: footer strip
        mc(sr+20, sc, sr+20, ec, {
          value: 'If found, please return to the issuing authority.', fill: C.RED, border: thick(C.RED),
          font:  { italic: true, color: { argb: C.WHITE }, size: 6.5 },
          align: { horizontal: 'center', vertical: 'middle', wrapText: false } });
      };

      /* ── Lay out all cards (2 per row) ──────────────────────────────── */
      const TOTAL_CARD_ROWS = CARD_ROWS + GAP_ROWS;
      const CARD2_COL = 1 + CARD_COLS + 1 + 1; // col 12 (after gap col 11)

      employees.forEach((emp, i) => {
        const pairRow  = Math.floor(i / 2);
        const isRight  = (i % 2 === 1);
        const startRow = 1 + pairRow * TOTAL_CARD_ROWS;
        const startCol = isRight ? CARD2_COL : 1;
        drawCard(emp, startRow, startCol);
      });

      const fname = `ICards_${project || 'All'}_${site || 'AllSites'}_${Date.now()}.xlsx`;
      
      // Generate Excel buffer before setting response headers
      const buffer = await wb.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
      return;
    }

    /* ════════════════════════════════════════════════════════════════════
       PDF  —  6 cards per A4 page (2 cols × 3 rows)
    ════════════════════════════════════════════════════════════════════ */
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 14, bufferPages: true });

    const fname = `ICards_${project || 'All'}_${site || 'AllSites'}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    pdfDoc.pipe(res);

    /* ── Page / card geometry ─────────────────────────────────────────── */
    const PW       = 595.28;
    const PH       = 841.89;
    const PAGE_M   = 14;
    const COL_GAP  = 8;
    const ROW_GAP  = 8;
    const COLS     = 2;
    const ROWS     = 3;
    const CARDS_PP = COLS * ROWS;                                                    // 6
    const CARD_W   = (PW - 2 * PAGE_M - (COLS - 1) * COL_GAP) / COLS;              // ≈ 276.64
    const CARD_H   = (PH - 2 * PAGE_M - (ROWS - 1) * ROW_GAP) / ROWS;              // ≈ 265.96

    /* ── Palette ──────────────────────────────────────────────────────── */
    const RED    = '#DC2626';
    const RED_L  = '#FEF2F2';
    const RED_M  = '#FECACA';
    const WHITE  = '#FFFFFF';
    const DARK   = '#111827';
    const GRAY   = '#6B7280';
    const GRAY_L = '#F3F4F6';
    const AMBER  = '#FEF3C7';
    const AMB_D  = '#92400E';

    /* ── Sub-zone heights (all must sum to exactly CARD_H) ───────────── */
    //
    //  ┌───────────────────────────────────┐  ← cy
    //  │  Header (firm name)          22pt │
    //  │  Subtitle                    11pt │
    //  │  Card-no bar                 10pt │
    //  │  Separator gap                4pt │
    //  ├──────────┬────────────────────────┤  ← bodyY  (47pt from cy)
    //  │ Photo    │ Fields × 7             │  ← flexible: CARD_H - 47 - bottomH
    //  │ QR code  │                        │
    //  ├──────────┴────────────────────────┤
    //  │  Address band                22pt │
    //  │  Aadhar strip                11pt │
    //  │  UAN / ESIC strip            11pt │
    //  │  Sig boxes                   22pt │
    //  │  Sig labels                   9pt │
    //  │  Footer strip                10pt │
    //  └───────────────────────────────────┘  ← cy + CARD_H
    //
    const HDR_H    = 22;
    const SUB_H    = 11;
    const CNUM_H   = 10;
    const SEP_H    =  4;
    const BODY_TOP = HDR_H + SUB_H + CNUM_H + SEP_H;   // 47

    const ADDR_H   = 22;
    const AADH_H   = 11;   // Aadhar strip
    const UANE_H   = 11;   // UAN / ESIC strip  ← separate row, always visible
    const SIG_H    = 22;
    const SIGL_H   =  9;
    const FOOT_H   = 10;
    const BOT_H    = ADDR_H + AADH_H + UANE_H + SIG_H + SIGL_H + FOOT_H;  // 85

    // Body area (photo + fields)
    const BODY_H   = CARD_H - BODY_TOP - BOT_H;          // ≈ 133.96
    const PHOTO_W  = 50;
    const PHOTO_H  = Math.floor(BODY_H * 0.49);          // ~65
    const QR_W     = 50;
    const QR_H     = Math.floor(BODY_H * 0.47);          // ~63
    const LEFT_W   = PHOTO_W + 5;                        // 55
    const FX_OFF   = LEFT_W + 4;                         // field text x-offset from cx
    const FIELD_W  = CARD_W - FX_OFF - 4;
    const FIELD_N  = 7;
    const FIELD_H  = Math.floor(BODY_H / FIELD_N);       // ~19 per row

    /* ── Draw one card ────────────────────────────────────────────────── */
    const drawCard = async (emp, cx, cy) => {
      const iNo  = emp._id.toString().slice(-8).toUpperCase();

      /* Card outer border */
      pdfDoc.rect(cx, cy, CARD_W, CARD_H)
            .lineWidth(1.2).strokeColor(RED).stroke();

      /* Header band */
      pdfDoc.rect(cx, cy, CARD_W, HDR_H).fillColor(RED).fill();
      pdfDoc.fillColor(WHITE).fontSize(10).font('Helvetica-Bold')
            .text(firmName.toUpperCase(), cx + 4, cy + 6,
              { width: CARD_W - 8, align: 'center', lineBreak: false });

      /* Subtitle + card-no */
      pdfDoc.rect(cx, cy + HDR_H, CARD_W, SUB_H).fillColor(RED_L).fill();
      pdfDoc.fillColor(RED).fontSize(7).font('Helvetica-Bold')
            .text('IDENTITY CARD', cx + 4, cy + HDR_H + 2,
              { width: CARD_W / 2, align: 'center', lineBreak: false });
      pdfDoc.fillColor(GRAY).fontSize(6).font('Helvetica')
            .text(`#${iNo}`, cx + CARD_W / 2, cy + HDR_H + 2,
              { width: CARD_W / 2 - 4, align: 'right', lineBreak: false });

      /* Card-no bar */
      pdfDoc.rect(cx, cy + HDR_H + SUB_H, CARD_W, CNUM_H).fillColor(RED_M).fill();
      pdfDoc.fillColor(RED).fontSize(5.5).font('Helvetica-Bold')
            .text(
              `${firmName.toUpperCase()}  •  EMPLOYEE IDENTITY CARD  •  CARD NO: ${iNo}`,
              cx + 4, cy + HDR_H + SUB_H + 2,
              { width: CARD_W - 8, align: 'center', lineBreak: false });

      /* Separator */
      pdfDoc.moveTo(cx + 4, cy + BODY_TOP - 1)
            .lineTo(cx + CARD_W - 4, cy + BODY_TOP - 1)
            .lineWidth(0.4).strokeColor(RED_M).stroke();

      const bodyY = cy + BODY_TOP;

      /* Photo box */
      pdfDoc.rect(cx + 4, bodyY + 2, PHOTO_W, PHOTO_H)
            .fillColor(GRAY_L).fill()
            .strokeColor('#D1D5DB').lineWidth(0.5).stroke();
      pdfDoc.fillColor(GRAY).fontSize(7).font('Helvetica')
            .text('PHOTO', cx + 4, bodyY + 2 + PHOTO_H / 2 - 4,
              { width: PHOTO_W, align: 'center', lineBreak: false });

      /* QR code
       * FIX: plain human-readable text — renders cleanly in any QR reader
       */
      const qrText = [
        `${firmName.toUpperCase()}`,
        `Card No : ${iNo}`,
        `Name    : ${emp.employee_name}`,
        `Category: ${emp.category || 'N/A'}`,
        `Project : ${emp.project || 'N/A'}`,
        `Site    : ${emp.site || 'N/A'}`,
        `D.O.J.  : ${emp.date_of_joining || 'N/A'}`,
        `Aadhar  : ${emp.aadhar || 'N/A'}`,
      ].join('\n');

      const qrBuf = await QRCode.toBuffer(qrText, {
        margin: 0, scale: 3, errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      const qrY = bodyY + 2 + PHOTO_H + 3;
      pdfDoc.image(qrBuf, cx + 4, qrY, { width: QR_W, height: QR_H });
      pdfDoc.fillColor(GRAY).fontSize(5).font('Helvetica')
            .text('Scan to verify', cx + 4, qrY + QR_H + 1,
              { width: QR_W, align: 'center', lineBreak: false });

      /* Employee fields (right of photo) */
      const fX = cx + FX_OFF;
      const fields = [
        { label: 'NAME',     value: emp.employee_name,           bold: true,  sz: 9.5 },
        { label: "FATHER'S", value: emp.father_husband_name,     bold: false, sz: 8   },
        { label: 'CATEGORY', value: emp.category || 'N/A',       bold: false, sz: 8   },
        { label: 'PHONE',    value: emp.phone_no || 'N/A',       bold: false, sz: 8   },
        { label: 'PROJECT',  value: emp.project || 'N/A',        bold: false, sz: 8   },
        { label: 'SITE',     value: emp.site || 'N/A',           bold: false, sz: 8   },
        { label: 'D.O.J.',   value: emp.date_of_joining || 'N/A', bold: false, sz: 8  },
      ];

      fields.forEach(({ label, value, bold, sz }, idx) => {
        const rY = bodyY + 2 + idx * FIELD_H;
        if (idx % 2 === 0) {
          pdfDoc.rect(fX, rY, FIELD_W, FIELD_H - 1).fillColor(RED_L).fill();
        }
        pdfDoc.fillColor(RED).fontSize(5.5).font('Helvetica-Bold')
              .text(label, fX + 2, rY + 2,
                { width: 38, lineBreak: false });
        pdfDoc.fillColor(bold ? DARK : '#374151')
              .fontSize(sz).font(bold ? 'Helvetica-Bold' : 'Helvetica')
              .text(value || '—', fX + 42, rY + 2,
                { width: FIELD_W - 44, lineBreak: false, ellipsis: true });
      });

      /* ── Bottom section ───────────────────────────────────────────────
       * FIX: bottomY is computed from CARD bottom minus the exact sum
       *      of all bottom-section heights — no extra offset that causes overflow.
       * ────────────────────────────────────────────────────────────────── */
      const botY  = cy + CARD_H - BOT_H;   // exact start of bottom section

      // Address band
      pdfDoc.rect(cx, botY, CARD_W, ADDR_H).fillColor(RED_L).fill();
      pdfDoc.fillColor(RED).fontSize(6).font('Helvetica-Bold')
            .text('ADDRESS:', cx + 4, botY + 3, { lineBreak: false });
      pdfDoc.fillColor(DARK).fontSize(7).font('Helvetica')
            .text(emp.address || 'N/A', cx + 44, botY + 3,
              { width: CARD_W - 48, height: ADDR_H - 5, lineBreak: true, ellipsis: true });

      // Aadhar strip  ← own row, clearly visible
      const aadY = botY + ADDR_H;
      pdfDoc.rect(cx, aadY, CARD_W, AADH_H).fillColor(AMBER).fill();
      pdfDoc.fillColor(AMB_D).fontSize(6.5).font('Helvetica-Bold')
            .text(`Aadhar No: ${emp.aadhar || '—'}`,
              cx + 4, aadY + 2,
              { width: CARD_W - 8, align: 'center', lineBreak: false });

      // UAN / ESIC strip  ← FIX: separate row so neither gets clipped
      const uanY = aadY + AADH_H;
      pdfDoc.rect(cx, uanY, CARD_W, UANE_H).fillColor('#FEF9C3').fill();
      pdfDoc.fillColor(AMB_D).fontSize(6.5).font('Helvetica-Bold')
            .text(
              `UAN: ${emp.uan || '—'}      ESIC No: ${emp.esic_no || '—'}`,
              cx + 4, uanY + 2,
              { width: CARD_W - 8, align: 'center', lineBreak: false });

      // Signature boxes (3 equal sections)
      const sigY  = uanY + UANE_H;
      const sigW  = (CARD_W - 10) / 3;
      const lbls  = ['EMPLOYEE SIGN', 'AUTHORIZED SIGN', 'OFFICIAL SEAL'];
      lbls.forEach((lbl, k) => {
        const sx = cx + 3 + k * (sigW + 2);
        // Box
        pdfDoc.rect(sx, sigY, sigW, SIG_H)
              .lineWidth(0.5).strokeColor(RED).stroke();
        // Label strip below box
        pdfDoc.rect(sx, sigY + SIG_H, sigW, SIGL_H)
              .fillColor(GRAY_L).fill()
              .strokeColor('#D1D5DB').lineWidth(0.3).stroke();
        pdfDoc.fillColor(GRAY).fontSize(5.5).font('Helvetica')
              .text(lbl, sx, sigY + SIG_H + 2,
                { width: sigW, align: 'center', lineBreak: false });
      });

      // Footer strip (flush to card bottom)
      const footY = sigY + SIG_H + SIGL_H;
      pdfDoc.rect(cx, footY, CARD_W, FOOT_H).fillColor(RED).fill();
      pdfDoc.fillColor(WHITE).fontSize(5.5).font('Helvetica-Oblique')
            .text('If found, please return to the issuing authority.',
              cx + 4, footY + 2,
              { width: CARD_W - 8, align: 'center', lineBreak: false });

      /*
       * FIX: Reset PDFKit cursor after each card.
       * PDFKit's internal y-cursor advances with every text() call.
       * For cards in row 3 (near page bottom ~y=830), the cursor ends
       * beyond PH, causing PDFKit to auto-add a page before the next
       * card renders — even when explicit coordinates are supplied.
       * Resetting x/y to PAGE_M (top-left safe zone) prevents this.
       */
      pdfDoc.x = PAGE_M;
      pdfDoc.y = PAGE_M;
    };

    /* ── Render loop ──────────────────────────────────────────────────── */
    for (let i = 0; i < employees.length; i++) {
      if (i > 0 && i % CARDS_PP === 0) {
        pdfDoc.addPage();
        // Also reset cursor on new page
        pdfDoc.x = PAGE_M;
        pdfDoc.y = PAGE_M;
      }

      const pos = i % CARDS_PP;
      const col = pos % COLS;
      const row = Math.floor(pos / COLS);
      const cx  = PAGE_M + col * (CARD_W + COL_GAP);
      const cy  = PAGE_M + row * (CARD_H + ROW_GAP);

      await drawCard(employees[i], cx, cy);
    }

    pdfDoc.end();

  } catch (err) {
    console.error('[ICARD EXPORT] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── IFSC LOOKUP (no DB dependency) ─────────────────────────────────────── */

export const lookupIFSC = async (req, res) => {
  try {
    const { ifsc } = req.params;

    if (!ifsc || typeof ifsc !== 'string' || ifsc.length !== 11) {
      return res.status(400).json({ success: false, error: 'Invalid IFSC code. Must be exactly 11 characters.' });
    }

    const normalizedIFSC = ifsc.toUpperCase();
    const response = await fetch(`https://ifsc.razorpay.com/${normalizedIFSC}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'MasterRoll-System/1.0' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ success: false, error: `IFSC "${normalizedIFSC}" not found. Please check the code.` });
      }
      return res.status(response.status).json({ success: false, error: `IFSC lookup failed (HTTP ${response.status}).` });
    }

    const data = await response.json();

    if (!data.BANK) {
      return res.status(502).json({ success: false, error: 'Invalid response from IFSC service.' });
    }

    res.json({
      success: true,
      data: {
        ifsc: normalizedIFSC,
        bank: data.BANK, branch: data.BRANCH, address: data.ADDRESS,
        city: data.CITY,  state:  data.STATE,  district: data.DISTRICT,
        bankcode: data.BANKCODE, micr: data.MICR,
      },
    });
  } catch (error) {
    console.error('[IFSC LOOKUP] Error:', error);
    res.status(500).json({ success: false, error: 'Unable to reach IFSC lookup service.' });
  }
};

/* ── APPOINTMENT LETTER GENERATION ──────────────────────────────────────── */

/**
 * Normalize a raw category/designation string from the database to a
 * professional title, regardless of casing or delimiter used at storage time.
 *
 * Covers the full spectrum of construction/contract labour designations:
 *   unskilled, skilled, semi skilled, semi-skilled, helper, technician …
 *
 * @param {string|null} raw  - value from employee.category
 * @returns {string}         - properly capitalised professional designation
 */
function normalizeDesignation(raw) {
  if (!raw || typeof raw !== 'string') return 'General Worker';

  /* Collapse all separators (hyphen / underscore / multiple spaces) → single space,
     then lowercase for lookup */
  const key = raw.trim().toLowerCase().replace(/[-_\s]+/g, ' ');

  const MAP = {
    /* Labour categories */
    'unskilled':         'Unskilled Worker',
    'unskilled worker':  'Unskilled Worker',
    'unskilled labour':  'Unskilled Worker',
    'unskilled laborer': 'Unskilled Worker',
    'skilled':           'Skilled Worker',
    'skilled worker':    'Skilled Worker',
    'skilled labour':    'Skilled Worker',
    'semi skilled':      'Semi-Skilled Worker',
    'semi-skilled':      'Semi-Skilled Worker',
    'semi skilled worker': 'Semi-Skilled Worker',
    'worker':            'General Worker',
    'general worker':    'General Worker',
    'labour':            'General Labour',
    'laborer':           'General Labour',
    'labourer':          'General Labour',
    'general labour':    'General Labour',
    /* Trade designations */
    'helper':            'Helper',
    'technician':        'Technician',
    'electrician':       'Electrician',
    'plumber':           'Plumber',
    'carpenter':         'Carpenter',
    'mason':             'Mason',
    'bar bender':        'Bar Bender',
    'bar bender helper': 'Bar Bender Helper',
    'welder':            'Welder',
    'fitter':            'Fitter',
    'painter':           'Painter',
    'operator':          'Machine Operator',
    'machine operator':  'Machine Operator',
    'excavator operator':'Excavator Operator',
    'crane operator':    'Crane Operator',
    'forklift operator': 'Forklift Operator',
    'supervisor':        'Supervisor',
    'site supervisor':   'Site Supervisor',
    'foreman':           'Foreman',
    'driver':            'Driver',
    'hv driver':         'Heavy Vehicle Driver',
    'heavy vehicle driver': 'Heavy Vehicle Driver',
    'security':          'Security Guard',
    'security guard':    'Security Guard',
    'watchman':          'Watchman',
    'cleaner':           'Cleaner / Housekeeping',
    'housekeeping':      'Cleaner / Housekeeping',
    'cook':              'Cook',
    'store keeper':      'Store Keeper',
    'storekeeper':       'Store Keeper',
    'data entry':        'Data Entry Operator',
    'data entry operator': 'Data Entry Operator',
    'accountant':        'Accountant',
    'engineer':          'Engineer',
    'site engineer':     'Site Engineer',
    'project manager':   'Project Manager',
    'manager':           'Manager',
  };

  if (MAP[key]) return MAP[key];

  /* Fallback: title-case the raw value so it at least looks professional */
  return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Generate an Appointment Letter (.docx) for an employee.
 *
 * Design goals:
 *  • Fits on ONE A4 page (top/bottom space reserved for pre-printed letterhead).
 *  • 10 pt body, compact line spacing, narrow L/R margins.
 *  • Statutory + bank data presented inline to save vertical space.
 *  • Police verification clause states the CORRECT obligation:
 *      – Submit at the time of joining; certificate must not be older than
 *        six (6) months from its date of issue.
 */
export const generateAppointmentLetter = async (req, res) => {
  try {
    const { id }      = req.params;
    const { firm_id } = req.user;

    /* ── Fetch & authorise ─────────────────────────────────────────── */
    const employee = await MasterRoll.findById(id).lean();

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (employee.firm_id.toString() !== firm_id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    /* ── Load docx ─────────────────────────────────────────────────── */
    let docx;
    try {
      docx = await import('docx');
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Document generation library not installed. Run: npm install docx',
      });
    }

    const {
      Document, Packer, Paragraph, TextRun,
      AlignmentType, convertInchesToTwip, UnderlineType,
    } = docx;

    /* ── Helpers ───────────────────────────────────────────────────── */
    const FONT = 'Times New Roman';
    const SZ   = 22;           /* half-points → 11 pt */
    const SZ_SM = 20;          /* 10 pt for statutory detail lines */

    function fmt(dateStr) {
      if (!dateStr) return '—';
      try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
      } catch { return String(dateStr); }
    }

    /**
     * Shorthand paragraph factory.
     * @param {Array}  runs    - array of TextRun instances
     * @param {object} [opts]  - extra Paragraph options
     */
    function para(runs, opts = {}) {
      return new Paragraph({
        children: runs,
        alignment: AlignmentType.JUSTIFIED,
        ...opts,
      });
    }

    /** Inline label + value TextRun pair */
    function field(label, value) {
      return [
        new TextRun({ text: label, bold: true, font: FONT, size: SZ_SM }),
        new TextRun({ text: String(value || '—'), font: FONT, size: SZ_SM }),
      ];
    }

    /* ── Prepare data ──────────────────────────────────────────────── */
    const employeeName  = employee.employee_name        || 'Employee Name';
    const fatherName    = employee.father_husband_name  || '—';
    const address       = employee.address              || '—';
    const designation   = normalizeDesignation(employee.category);
    const dailyWage     = employee.p_day_wage           ?? '—';
    const project       = employee.project              || '—';
    const site          = employee.site                 || project;
    const doj           = fmt(employee.date_of_joining);
    const aadhar        = employee.aadhar               || '—';
    const pan           = employee.pan                  || 'Not Available';
    const bank          = employee.bank                 || '—';
    const accountNo     = employee.account_no           || '—';
    const ifsc          = employee.ifsc                 || '—';
    const esicNo        = employee.esic_no              || 'Not Enrolled';
    const uanNo         = employee.uan                  || 'Not Enrolled';
    const sKalyanNo     = employee.s_kalyan_no          || null;
    const today         = fmt(new Date());

    /* Generate a reference number: APPT/<year>/<padded numeric part of _id> */
    const refNo = `APPT/${new Date().getFullYear()}/${String(employee._id).slice(-6).toUpperCase()}`;

    /* ── Build document ────────────────────────────────────────────── */
    const SP = (after, before = 0) => ({ spacing: { before, after } });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            /* Top/bottom kept large for pre-printed company letterhead.
               Left/right narrowed to maximise usable width. */
            margins: {
              top:    convertInchesToTwip(1.20),
              bottom: convertInchesToTwip(1.10),
              left:   convertInchesToTwip(0.20),
              right:  convertInchesToTwip(0.20),
            },
          },
        },

        children: [

          /* ── Ref & Date (same line, right-aligned date) ─────────── */
          para([
            new TextRun({ text: `Ref. No.: ${refNo}`, font: FONT, size: SZ }),
            new TextRun({ text: `\t\tDate: ${today}`, font: FONT, size: SZ }),
          ], { ...SP(80) }),

          /* ── Address block ──────────────────────────────────────── */
          para([new TextRun({ text: `To,`, font: FONT, size: SZ })],
               { ...SP(40) }),
          para([new TextRun({ text: employeeName, bold: true, font: FONT, size: SZ })],
               { ...SP(40) }),
          para([new TextRun({ text: `S/O: ${fatherName}`, font: FONT, size: SZ })],
               { ...SP(40) }),
          para([new TextRun({ text: address, font: FONT, size: SZ })],
               { ...SP(100) }),

          /* ── Subject ────────────────────────────────────────────── */
          para([
            new TextRun({ text: 'Sub: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: 'Appointment Letter', bold: true, underline: { type: UnderlineType.SINGLE }, font: FONT, size: SZ }),
          ], { ...SP(80) }),

          /* ── Salutation ─────────────────────────────────────────── */
          para([new TextRun({ text: `Dear ${employeeName},`, font: FONT, size: SZ })],
               { ...SP(80) }),

          /* ── Opening ────────────────────────────────────────────── */
          para([new TextRun({
            text: `We are pleased to appoint you as ${designation} with our organisation, with effect from ${doj}. `
                + `This appointment is offered on the terms and conditions set out below.`,
            font: FONT, size: SZ,
          })], { ...SP(80), indent: { firstLine: 0 } }),

          /* ── Terms of Employment ────────────────────────────────── */
          para([new TextRun({ text: 'Terms of Employment', bold: true, font: FONT, size: SZ })],
               { ...SP(60), before: 80 }),

          para([
            new TextRun({ text: 'Designation: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: `${designation}`, font: FONT, size: SZ }),
            new TextRun({ text: '    Project / Site: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: `${project} / ${site}`, font: FONT, size: SZ }),
          ], { ...SP(50), indent: { left: 200 } }),

          para([
            new TextRun({ text: 'Date of Joining: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: doj, font: FONT, size: SZ }),
            new TextRun({ text: '    Daily Wage: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: `₹${dailyWage} per day`, font: FONT, size: SZ }),
          ], { ...SP(50), indent: { left: 200 } }),

          para([
            new TextRun({
              text: 'Your employment is governed by the applicable provisions of the Contract Labour (Regulation & Abolition) Act, 1970, '
                  + 'the Building & Other Construction Workers Act, 1996, and all other relevant labour legislation.',
              font: FONT, size: SZ_SM,
            }),
          ], { ...SP(80), indent: { left: 200 } }),

          /* ── Statutory & Bank Details (compact two-column style) ── */
          para([new TextRun({ text: 'Statutory & Bank Details', bold: true, font: FONT, size: SZ })],
               { ...SP(50), before: 80 }),

          para([
            ...field('Aadhar: ', aadhar),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('PAN: ', pan),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            ...field('UAN: ', uanNo),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('ESIC No.: ', esicNo),
            ...(sKalyanNo ? [
              new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
              ...field('S. Kalyan No.: ', sKalyanNo),
            ] : []),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            ...field('Bank: ', bank),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('A/C No.: ', accountNo),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('IFSC: ', ifsc),
          ], { ...SP(80), indent: { left: 200 } }),

          /* ── Police Verification ────────────────────────────────── */
          /* CORRECT LOGIC:
               • Employee must submit a Police Clearance Certificate (PCC)
                 AT THE TIME OF JOINING — not after some grace period.
               • The PCC submitted must have been issued within the
                 preceding six (6) months from the date of joining.
               • A certificate older than six months is NOT acceptable.         */
          para([new TextRun({ text: 'Police Verification', bold: true, font: FONT, size: SZ })],
               { ...SP(50), before: 80 }),

          para([new TextRun({
            text: 'Submission of a valid Police Clearance Certificate (PCC) is mandatory at the time of joining. '
                + 'The certificate must have been issued within six (6) months preceding your date of joining; '
                + 'any certificate older than six months will not be accepted. '
                + 'Failure to produce a valid PCC on or before the date of joining may result in deferral or cancellation of this appointment.',
            font: FONT, size: SZ_SM,
          })], { ...SP(80), indent: { left: 200 } }),

          /* ── General Conditions ─────────────────────────────────── */
          para([new TextRun({ text: 'General Conditions', bold: true, font: FONT, size: SZ })],
               { ...SP(50), before: 80 }),

          para([
            new TextRun({ text: '(a) ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: 'You shall comply with all company rules, site regulations, and applicable labour laws throughout your tenure.', font: FONT, size: SZ_SM }),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            new TextRun({ text: '(b) ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: 'Either party may terminate this appointment by giving notice as prescribed under the applicable labour law or by payment in lieu thereof.', font: FONT, size: SZ_SM }),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            new TextRun({ text: '(c) ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: 'All personal data furnished by you shall be maintained in strict confidence and used solely for employment and statutory compliance purposes.', font: FONT, size: SZ_SM }),
          ], { ...SP(80), indent: { left: 200 } }),

          /* ── Closing ────────────────────────────────────────────── */
          para([new TextRun({
            text: 'Kindly sign and return the duplicate copy of this letter as acknowledgement of your acceptance of the above terms.',
            font: FONT, size: SZ,
          })], { ...SP(80) }),

          para([new TextRun({ text: 'Yours faithfully,', font: FONT, size: SZ })],
               { ...SP(40) }),

          para([new TextRun({ text: '\n\n', font: FONT, size: SZ })], { ...SP(40) }),

          para([new TextRun({ text: '________________________________', font: FONT, size: SZ })],
               { ...SP(40) }),

          para([new TextRun({ text: 'Authorised Signatory', bold: true, font: FONT, size: SZ })],
               { ...SP(20) }),
          para([new TextRun({ text: '(For and on behalf of the Company)', font: FONT, size: SZ_SM })],
               { ...SP(80) }),

          /* ── Employee Acceptance ────────────────────────────────── */
          para([new TextRun({
            text: '─────────────────────── EMPLOYEE ACCEPTANCE ───────────────────────',
            font: FONT, size: SZ_SM,
          })], { alignment: AlignmentType.CENTER, ...SP(60) }),

          para([new TextRun({
            text: 'I hereby accept the appointment on the terms and conditions stated above and confirm that I have submitted / will submit '
                + 'a Police Clearance Certificate issued within the preceding six (6) months on or before my date of joining.',
            font: FONT, size: SZ_SM,
          })], { ...SP(60) }),

          para([
            new TextRun({ text: 'Signature: _________________________    ', font: FONT, size: SZ_SM }),
            new TextRun({ text: 'Date: _____________________', font: FONT, size: SZ_SM }),
          ], { ...SP(40) }),

          para([
            new TextRun({ text: 'Name: ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: employeeName, font: FONT, size: SZ_SM }),
            new TextRun({ text: '    Aadhar No.: ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: aadhar, font: FONT, size: SZ_SM }),
          ], { ...SP(0) }),

        ],
      }],
    });

    /* ── Pack & send ───────────────────────────────────────────────── */
    const buffer   = await Packer.toBuffer(doc);
    const safeName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Appointment_Letter_${safeName}_${Date.now()}.docx`;

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('[APPOINTMENT LETTER] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate appointment letter: ' + error.message,
    });
  }
};

/* ── TEMPLATE GENERATION (EXCELJS) ─────────────────────────────────────── */

export const generateMasterRollTemplate = async (req, res) => {
  try {
    let ExcelJS;
    try {
      ExcelJS = await import('exceljs');
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Excel generation library not installed. Run: npm install exceljs',
      });
    }

    const { Workbook } = ExcelJS.default;

    // Field definitions: name, header, isRequired
    const FIELDS = [
      { name: 'employee_name', header: 'Employee Name', isRequired: true },
      { name: 'father_husband_name', header: 'Father/Husband Name', isRequired: true },
      { name: 'date_of_birth', header: 'Date of Birth', isRequired: true },
      { name: 'aadhar', header: 'Aadhar', isRequired: true },
      { name: 'phone_no', header: 'Phone No', isRequired: true },
      { name: 'address', header: 'Address', isRequired: true },
      { name: 'bank', header: 'Bank', isRequired: true },
      { name: 'account_no', header: 'Account No', isRequired: true },
      { name: 'ifsc', header: 'IFSC', isRequired: true },
      { name: 'date_of_joining', header: 'Date of Joining', isRequired: true },
      { name: 'status', header: 'Status', isRequired: true },
      { name: 'pan', header: 'PAN', isRequired: false },
      { name: 'branch', header: 'Branch', isRequired: false },
      { name: 'uan', header: 'UAN', isRequired: false },
      { name: 'esic_no', header: 'ESIC No', isRequired: false },
      { name: 's_kalyan_no', header: 'S. Kalyan No', isRequired: false },
      { name: 'category', header: 'Category', isRequired: false },
      { name: 'p_day_wage', header: 'Daily Wage', isRequired: false },
      { name: 'project', header: 'Project', isRequired: false },
      { name: 'site', header: 'Site', isRequired: false },
      { name: 'date_of_exit', header: 'Date of Exit', isRequired: false },
      { name: 'doe_rem', header: 'Remarks', isRequired: false },
    ];

    // Demo data
    const DEMO_ROW = {
      employee_name: 'Rajesh Kumar Singh',
      father_husband_name: 'Vikram Singh',
      date_of_birth: '1990-05-15',
      aadhar: '123456789012',
      phone_no: '9876543210',
      address: '123 Main Street, Delhi, 110001',
      bank: 'HDFC Bank',
      account_no: '10019875432109',
      ifsc: 'HDFC0000001',
      date_of_joining: '2024-01-15',
      status: 'Active',
      pan: 'ABCDE1234F',
      branch: 'Delhi Main',
      uan: '100050001234',
      esic_no: '12345678901234',
      s_kalyan_no: 'KL123456',
      category: 'Skilled',
      p_day_wage: '500',
      project: 'Project A',
      site: 'Site 1',
      date_of_exit: '',
      doe_rem: 'Sample employee record for reference',
    };

    const wb = new Workbook();
    const ws = wb.addWorksheet('Template');

    // Create header row
    FIELDS.forEach((field, index) => {
      const cell = ws.getCell(1, index + 1);
      cell.value = field.header;
      
      // Professional styling
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
      
      // Color based on required/optional
      if (field.isRequired) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF4444' } }; // Red
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4488FF' } }; // Blue
      }
      
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Add demo row
    FIELDS.forEach((field, index) => {
      const cell = ws.getCell(2, index + 1);
      cell.value = DEMO_ROW[field.name] || '';
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'center' };
    });

    // Set column widths
    FIELDS.forEach((field, index) => {
      const col = ws.getColumn(index + 1);
      col.width = field.header.length > 15 ? field.header.length + 2 : 15;
    });

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Generate buffer and send
    const buffer = await wb.xlsx.writeBuffer();
    const filename = `MasterRoll_Template_${Date.now()}.xlsx`;

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('[TEMPLATE GENERATION] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template: ' + error.message,
    });
  }
};