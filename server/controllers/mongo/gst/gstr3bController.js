/**
 * gstr3bController.js
 * 
 * Controller for GSTR-3B report generation
 */

import { Firm } from '../../../models/index.js';
import { getGSTR3BSummary } from './gstr3bDataAggregator.js';
import { generateGSTR3BPDF } from '../../../utils/gstPdfGenerator.js';

/**
 * Get GSTR-3B summary for a given period
 */
export const getGSTR3BReport = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    // Validate firm exists
    const firm = await Firm.findById(firm_id).lean();
    if (!firm) {
      return res.status(404).json({ success: false, error: 'Firm not found' });
    }

    const report = await getGSTR3BSummary(firm_id, firmGstin, startDate, endDate);

    res.json({ success: true, data: report });
  } catch (err) {
    console.error('Error fetching GSTR-3B report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Export GSTR-3B as PDF
 */
export const exportGSTR3BPDF = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { startDate, endDate, firmGstin } = req.query;

    if (!startDate || !endDate || !firmGstin) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and firmGstin are required' });
    }

    const firm = await Firm.findById(firm_id).lean();
    if (!firm) return res.status(404).json({ success: false, error: 'Firm not found' });

    const report = await getGSTR3BSummary(firm_id, firmGstin, startDate, endDate);
    const buffer = await generateGSTR3BPDF(report, firm);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR3B_${firmGstin}_${startDate}.pdf`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting GSTR-3B as PDF:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
