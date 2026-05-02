/**
 * gstr1Controller.js
 * 
 * Main controller for GSTR1 report generation and export
 */

import { Firm } from '../../../models/index.js';
import {
  getB2BSupplies,
  getB2BReverseCharge,
  getB2CSupplies,
  getB2CLSupplies,
  getB2CSSupplies,
  getExports,
  getNilRatedSupplies,
  getB2CSAmendments,
  getAdvances,
  getHSNSummary,
  getHSNSummaryB2B,
  getHSNSummaryB2C,
  getDocumentSummary,
  getEcommerceSupplies,
  getEcommerceOperatorSupplies,
  getAmendments,
  getExemptedSupplies,
  getGSTR1Summary,
  validateGSTR1Data,
} from './gstr1DataAggregator.js';
import {
  exportGSTR1AsJSON,
  exportGSTR1AsExcel,
  exportGSTR1AsCSV,
} from './gstr1ExportUtils.js';

/**
 * Get GSTR1 summary for a given period
 */
export const getGSTR1SummaryReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate and endDate are required' });
    }

    if (!firmGstin) {
      return res.status(400).json({ success: false, error: 'firmGstin is required' });
    }

    // Validate firm GSTIN belongs to user's firm
    const firm = await Firm.findById(firm_id).lean();
    if (!firm) {
      return res.status(404).json({ success: false, error: 'Firm not found' });
    }

    const summary = await getGSTR1Summary(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Error fetching GSTR1 summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get B2B supplies
 */
export const getB2BSuppliesReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const b2b = await getB2BSupplies(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: b2b.length, data: b2b });
  } catch (err) {
    console.error('Error fetching B2B supplies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get B2C supplies
 */
export const getB2CSuppliesReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const b2c = await getB2CSupplies(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: b2c.length, data: b2c });
  } catch (err) {
    console.error('Error fetching B2C supplies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get B2CL supplies (Large - inter-state > ₹1 lakh)
 */
export const getB2CLSuppliesReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const b2cl = await getB2CLSupplies(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: b2cl.length, data: b2cl });
  } catch (err) {
    console.error('Error fetching B2CL supplies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get B2CS supplies (Small - all other B2C)
 */
export const getB2CSSuppliesReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const b2cs = await getB2CSSupplies(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: b2cs.length, data: b2cs });
  } catch (err) {
    console.error('Error fetching B2CS supplies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get HSN summary
 */
export const getHSNSummaryReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const hsn = await getHSNSummary(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: hsn.length, data: hsn });
  } catch (err) {
    console.error('Error fetching HSN summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get amendments (credit notes, debit notes)
 */
export const getAmendmentsReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const amendments = await getAmendments(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: amendments.length, data: amendments });
  } catch (err) {
    console.error('Error fetching amendments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get B2B Reverse Charge supplies (Table 4B)
 */
export const getB2BReverseChargeReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getB2BReverseCharge(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching B2B reverse charge:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get Exports (Table 6)
 */
export const getExportsReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getExports(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching exports:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get Nil Rated/Exempted supplies (Table 8)
 */
export const getNilRatedReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getNilRatedSupplies(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching nil rated supplies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get B2CS Amendments (Table 10)
 */
export const getB2CSAmendmentsReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getB2CSAmendments(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching B2CS amendments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get Advances (Table 11)
 */
export const getAdvancesReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getAdvances(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching advances:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get HSN Summary B2B (Table 12 - B2B Tab)
 */
export const getHSNSummaryB2BReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getHSNSummaryB2B(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching HSN summary B2B:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get HSN Summary B2C (Table 12 - B2C Tab)
 */
export const getHSNSummaryB2CReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getHSNSummaryB2C(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching HSN summary B2C:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get Document Summary (Table 13)
 */
export const getDocumentSummaryReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getDocumentSummary(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching document summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get E-commerce Supplies (Table 14)
 */
export const getEcommerceSuppliesReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getEcommerceSupplies(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching e-commerce supplies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get E-commerce Operator Supplies (Table 15)
 */
export const getEcommerceOperatorReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const data = await getEcommerceOperatorSupplies(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching e-commerce operator supplies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Validate GSTR1 data
 */
export const validateGSTR1 = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const validation = await validateGSTR1Data(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, data: validation });
  } catch (err) {
    console.error('Error validating GSTR1 data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Export GSTR1 as JSON
 */
export const exportGSTR1JSON = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    // Fetch all tables
    const [
      summary,
      b2b,
      b2bReverseCharge,
      b2cl,
      b2cs,
      exports,
      nilRated,
      amendments,
      advances,
      hsnB2B,
      hsnB2C,
      documentSummary,
    ] = await Promise.all([
      getGSTR1Summary(firm_id, firmGstin, startDate, endDate),
      getB2BSupplies(firm_id, firmGstin, startDate, endDate),
      getB2BReverseCharge(firm_id, firmGstin, startDate, endDate),
      getB2CLSupplies(firm_id, firmGstin, startDate, endDate),
      getB2CSSupplies(firm_id, firmGstin, startDate, endDate),
      getExports(firm_id, firmGstin, startDate, endDate),
      getNilRatedSupplies(firm_id, firmGstin, startDate, endDate),
      getAmendments(firm_id, firmGstin, startDate, endDate),
      getAdvances(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2B(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2C(firm_id, firmGstin, startDate, endDate),
      getDocumentSummary(firm_id, firmGstin, startDate, endDate),
    ]);

    const allTables = {
      table_4a_b2b_supplies: b2b,
      table_4b_b2b_reverse_charge: b2bReverseCharge,
      table_5_b2cl_supplies: b2cl,
      table_6_exports: exports,
      table_7_b2cs_supplies: b2cs,
      table_8_nil_rated: nilRated,
      table_9_amendments: amendments,
      table_11_advances: advances,
      table_12_hsn_b2b: hsnB2B,
      table_12_hsn_b2c: hsnB2C,
      table_13_document_summary: documentSummary,
    };

    const jsonData = exportGSTR1AsJSON(summary, allTables);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_${firmGstin}_${startDate}_${endDate}.json`);
    res.send(JSON.stringify(jsonData, null, 2));
  } catch (err) {
    console.error('Error exporting GSTR1 as JSON:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Export GSTR1 as Excel
 */
export const exportGSTR1Excel = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    // Fetch all tables
    const [
      summary,
      b2b,
      b2bReverseCharge,
      b2cl,
      b2cs,
      exports,
      nilRated,
      amendments,
      advances,
      hsnB2B,
      hsnB2C,
      documentSummary,
      validation,
    ] = await Promise.all([
      getGSTR1Summary(firm_id, firmGstin, startDate, endDate),
      getB2BSupplies(firm_id, firmGstin, startDate, endDate),
      getB2BReverseCharge(firm_id, firmGstin, startDate, endDate),
      getB2CLSupplies(firm_id, firmGstin, startDate, endDate),
      getB2CSSupplies(firm_id, firmGstin, startDate, endDate),
      getExports(firm_id, firmGstin, startDate, endDate),
      getNilRatedSupplies(firm_id, firmGstin, startDate, endDate),
      getAmendments(firm_id, firmGstin, startDate, endDate),
      getAdvances(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2B(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2C(firm_id, firmGstin, startDate, endDate),
      getDocumentSummary(firm_id, firmGstin, startDate, endDate),
      validateGSTR1Data(firm_id, firmGstin, startDate, endDate),
    ]);

    const allTables = {
      table_4a_b2b_supplies: b2b,
      table_4b_b2b_reverse_charge: b2bReverseCharge,
      table_5_b2cl_supplies: b2cl,
      table_6_exports: exports,
      table_7_b2cs_supplies: b2cs,
      table_8_nil_rated: nilRated,
      table_9_amendments: amendments,
      table_11_advances: advances,
      table_12_hsn_b2b: hsnB2B,
      table_12_hsn_b2c: hsnB2C,
      table_13_document_summary: documentSummary,
      validation,
    };

    const buffer = await exportGSTR1AsExcel(summary, allTables);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_${firmGstin}_${startDate}_${endDate}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting GSTR1 as Excel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Export GSTR1 as CSV
 */
export const exportGSTR1CSV = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    // Fetch all tables
    const [
      summary,
      b2b,
      b2cl,
      b2cs,
      hsnB2B,
      hsnB2C,
      documentSummary,
    ] = await Promise.all([
      getGSTR1Summary(firm_id, firmGstin, startDate, endDate),
      getB2BSupplies(firm_id, firmGstin, startDate, endDate),
      getB2CLSupplies(firm_id, firmGstin, startDate, endDate),
      getB2CSSupplies(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2B(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2C(firm_id, firmGstin, startDate, endDate),
      getDocumentSummary(firm_id, firmGstin, startDate, endDate),
    ]);

    const allTables = {
      table_4a_b2b_supplies: b2b,
      table_5_b2cl_supplies: b2cl,
      table_7_b2cs_supplies: b2cs,
      table_12_hsn_b2b: hsnB2B,
      table_12_hsn_b2c: hsnB2C,
      table_13_document_summary: documentSummary,
    };

    const csv = exportGSTR1AsCSV(summary, allTables);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_${firmGstin}_${startDate}_${endDate}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting GSTR1 as CSV:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get complete GSTR1 report (all 15 tables)
 */
export const getCompleteGSTR1Report = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    // Fetch all tables in parallel for performance
    const [
      summary,
      b2b,
      b2bReverseCharge,
      b2cl,
      b2cs,
      exports,
      nilRated,
      amendments,
      b2csAmendments,
      advances,
      hsnB2B,
      hsnB2C,
      documentSummary,
      ecommerceSupplies,
      ecommerceOperator,
      exempted,
      validation,
    ] = await Promise.all([
      getGSTR1Summary(firm_id, firmGstin, startDate, endDate),
      getB2BSupplies(firm_id, firmGstin, startDate, endDate),
      getB2BReverseCharge(firm_id, firmGstin, startDate, endDate),
      getB2CLSupplies(firm_id, firmGstin, startDate, endDate),
      getB2CSSupplies(firm_id, firmGstin, startDate, endDate),
      getExports(firm_id, firmGstin, startDate, endDate),
      getNilRatedSupplies(firm_id, firmGstin, startDate, endDate),
      getAmendments(firm_id, firmGstin, startDate, endDate),
      getB2CSAmendments(firm_id, firmGstin, startDate, endDate),
      getAdvances(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2B(firm_id, firmGstin, startDate, endDate),
      getHSNSummaryB2C(firm_id, firmGstin, startDate, endDate),
      getDocumentSummary(firm_id, firmGstin, startDate, endDate),
      getEcommerceSupplies(firm_id, firmGstin, startDate, endDate),
      getEcommerceOperatorSupplies(firm_id, firmGstin, startDate, endDate),
      getExemptedSupplies(firm_id, firmGstin, startDate, endDate),
      validateGSTR1Data(firm_id, firmGstin, startDate, endDate),
    ]);

    res.json({
      success: true,
      data: {
        summary,
        table_4a_b2b_supplies: b2b,
        table_4b_b2b_reverse_charge: b2bReverseCharge,
        table_5_b2cl_supplies: b2cl,
        table_6_exports: exports,
        table_7_b2cs_supplies: b2cs,
        table_8_nil_rated: nilRated,
        table_9_amendments: amendments,
        table_10_b2cs_amendments: b2csAmendments,
        table_11_advances: advances,
        table_12_hsn_b2b: hsnB2B,
        table_12_hsn_b2c: hsnB2C,
        table_13_document_summary: documentSummary,
        table_14_ecommerce_supplies: ecommerceSupplies,
        table_15_ecommerce_operator: ecommerceOperator,
        exempted_supplies: exempted,
        validation,
      },
    });
  } catch (err) {
    console.error('Error fetching complete GSTR1 report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
