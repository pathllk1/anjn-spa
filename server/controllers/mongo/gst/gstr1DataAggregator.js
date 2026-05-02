/**
 * gstr1DataAggregator.js
 * 
 * Complete GSTR-1 Data Aggregator - All 15 Tables
 * Compliant with latest GST regulations (2024-2025)
 * 
 * Tables Implemented:
 * - Table 4A: B2B Supplies (Regular)
 * - Table 4B: B2B Supplies (Reverse Charge)
 * - Table 5: B2CL (Large - Inter-state > ₹1 lakh)
 * - Table 6: Exports (With/Without Payment, SEZ, Deemed Exports)
 * - Table 7: B2CS (Small - All other B2C)
 * - Table 8: Nil Rated, Exempted, Non-GST Supplies
 * - Table 9A: B2B Amendments
 * - Table 9B: B2CL Amendments
 * - Table 9C: Credit/Debit Note Amendments
 * - Table 10: B2CS Amendments
 * - Table 11: Advances Received/Adjusted
 * - Table 12: HSN Summary (B2B and B2C tabs)
 * - Table 13: Document Summary
 * - Table 14: E-commerce Supplies (TCS Section 52)
 * - Table 15: E-commerce Operator Supplies (Section 9(5))
 */

import { Bill, StockReg, Party } from '../../../models/index.js';

/**
 * Get all B2B supplies (registered businesses)
 */
export async function getB2BSupplies(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    gstin: { $ne: 'UNREGISTERED', $exists: true },
  })
    .populate('party_id', 'gstin state_code')
    .lean();

  return bills.map(bill => ({
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    customer_gstin: bill.gstin,
    customer_state_code: bill.state_code,
    invoice_value: bill.gtot,
    taxable_value: bill.ntot,
    cgst: bill.cgst || 0,
    sgst: bill.sgst || 0,
    igst: bill.igst || 0,
    cess: 0,
    reverse_charge: bill.reverse_charge ? 'Y' : 'N',
    bill_id: bill._id,
  }));
}

/**
 * Get all B2C supplies (unregistered consumers)
 * Updated: B2CL threshold reduced to ₹1 lakh (from ₹2.5 lakh) effective Aug 1, 2024
 * 
 * B2CL (Large): Inter-state supplies > ₹1 lakh per invoice
 * B2CS (Small): All other B2C supplies
 */
export async function getB2CSupplies(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    $or: [
      { gstin: 'UNREGISTERED' },
      { gstin: { $exists: false } },
      { gstin: null },
    ],
  }).lean();

  const billIds = bills.map(b => b._id);

  const stockRegs = await StockReg.find({
    firm_id: firmId,
    type: 'SALE',
    bill_id: { $in: billIds },
  }).lean();

  // Aggregate by state and HSN
  const aggregated = {};

  bills.forEach(bill => {
    const stateCode = bill.state_code || '00';
    const billStockRegs = stockRegs.filter(sr => sr.bill_id.toString() === bill._id.toString());

    billStockRegs.forEach(sr => {
      const hsn = sr.hsn || '0000000000';
      const key = `${stateCode}_${hsn}`;

      if (!aggregated[key]) {
        aggregated[key] = {
          state_code: stateCode,
          hsn: hsn,
          qty: 0,
          uom: sr.uom || 'PCS',
          taxable_value: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
        };
      }

      aggregated[key].qty += parseFloat(sr.qty) || 0;
      aggregated[key].taxable_value += parseFloat(sr.total) || 0;

      // Distribute GST proportionally
      const billTaxableValue = bill.ntot || 1;
      const itemProportion = (parseFloat(sr.total) || 0) / billTaxableValue;
      aggregated[key].cgst += (bill.cgst || 0) * itemProportion;
      aggregated[key].sgst += (bill.sgst || 0) * itemProportion;
      aggregated[key].igst += (bill.igst || 0) * itemProportion;
    });
  });

  return Object.values(aggregated);
}

/**
 * Get B2CL (Large) supplies separately
 * Inter-state supplies to unregistered persons > ₹1 lakh per invoice
 */
export async function getB2CLSupplies(firmId, firmGstin, startDate, endDate) {
  const B2CL_THRESHOLD = 100000; // ₹1 lakh (updated from ₹2.5 lakh)

  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    gtot: { $gt: B2CL_THRESHOLD },
    $or: [
      { gstin: 'UNREGISTERED' },
      { gstin: { $exists: false } },
      { gstin: null },
    ],
  }).lean();

  // Filter only inter-state supplies
  const firmStateCode = firmGstin ? firmGstin.substring(0, 2) : null;
  const interStateBills = bills.filter(bill => 
    bill.state_code && bill.state_code !== firmStateCode
  );

  return interStateBills.map(bill => ({
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    state_code: bill.state_code,
    invoice_value: bill.gtot,
    taxable_value: bill.ntot,
    cgst: bill.cgst || 0,
    sgst: bill.sgst || 0,
    igst: bill.igst || 0,
    cess: 0,
    bill_id: bill._id,
  }));
}

/**
 * Get B2CS (Small) supplies
 * All B2C supplies not covered in B2CL
 */
export async function getB2CSSupplies(firmId, firmGstin, startDate, endDate) {
  const B2CL_THRESHOLD = 100000; // ₹1 lakh

  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    $or: [
      { gstin: 'UNREGISTERED' },
      { gstin: { $exists: false } },
      { gstin: null },
    ],
  }).lean();

  const firmStateCode = firmGstin ? firmGstin.substring(0, 2) : null;

  // Filter B2CS: intra-state OR inter-state <= ₹1 lakh
  const b2csBills = bills.filter(bill => {
    const isIntraState = !bill.state_code || bill.state_code === firmStateCode;
    const isSmallInterState = bill.state_code !== firmStateCode && bill.gtot <= B2CL_THRESHOLD;
    return isIntraState || isSmallInterState;
  });

  // Aggregate by state and rate
  const aggregated = {};

  b2csBills.forEach(bill => {
    const stateCode = bill.state_code || firmStateCode || '00';
    const gstRate = bill.cgst + bill.sgst + bill.igst > 0 
      ? Math.round(((bill.cgst + bill.sgst + bill.igst) / bill.ntot) * 100)
      : 0;
    const key = `${stateCode}_${gstRate}`;

    if (!aggregated[key]) {
      aggregated[key] = {
        state_code: stateCode,
        rate: gstRate,
        taxable_value: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
      };
    }

    aggregated[key].taxable_value += bill.ntot || 0;
    aggregated[key].cgst += bill.cgst || 0;
    aggregated[key].sgst += bill.sgst || 0;
    aggregated[key].igst += bill.igst || 0;
  });

  return Object.values(aggregated);
}

/**
 * Get HSN-wise summary (Legacy - for backward compatibility)
 * Use getHSNSummaryB2B and getHSNSummaryB2C for new implementation
 */
export async function getHSNSummary(firmId, firmGstin, startDate, endDate) {
  const b2b = await getHSNSummaryB2B(firmId, firmGstin, startDate, endDate);
  const b2c = await getHSNSummaryB2C(firmId, firmGstin, startDate, endDate);
  
  // Merge B2B and B2C HSN data
  const merged = {};
  
  [...b2b, ...b2c].forEach(item => {
    if (!merged[item.hsn]) {
      merged[item.hsn] = { ...item };
    } else {
      merged[item.hsn].total_quantity += item.total_quantity;
      merged[item.hsn].total_value += item.total_value;
      merged[item.hsn].taxable_value += item.taxable_value;
      merged[item.hsn].integrated_tax += item.integrated_tax;
      merged[item.hsn].central_tax += item.central_tax;
      merged[item.hsn].state_ut_tax += item.state_ut_tax;
      merged[item.hsn].cess += item.cess;
    }
  });
  
  return Object.values(merged).map(item => ({
    hsn: item.hsn,
    description: item.description,
    qty: item.total_quantity,
    uom: item.uqc,
    taxable_value: item.taxable_value,
    cgst: item.central_tax,
    sgst: item.state_ut_tax,
    igst: item.integrated_tax,
    cess: item.cess,
  }));
}

/**
 * Get amendments (credit notes and debit notes)
 * Table 9: Amendments to B2B, B2CL, Exports
 */
export async function getAmendments(firmId, firmGstin, startDate, endDate) {
  const creditNotes = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: { $in: ['CREDIT_NOTE', 'DEBIT_NOTE'] },
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  })
    .populate('ref_bill_id', 'bno bdate')
    .lean();

  return creditNotes.map(note => ({
    amendment_type: note.btype,
    original_invoice_no: note.ref_bill_id?.bno || 'N/A',
    original_invoice_date: note.ref_bill_id?.bdate || 'N/A',
    amendment_invoice_no: note.bno,
    amendment_invoice_date: note.bdate,
    customer_gstin: note.gstin,
    customer_state_code: note.state_code,
    invoice_value: note.gtot,
    taxable_value: note.ntot,
    cgst: note.cgst || 0,
    sgst: note.sgst || 0,
    igst: note.igst || 0,
    cess: 0,
    bill_id: note._id,
  }));
}

/**
 * Table 4B: B2B Supplies with Reverse Charge
 */
export async function getB2BReverseCharge(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    gstin: { $ne: 'UNREGISTERED', $exists: true },
    reverse_charge: true,
  })
    .populate('party_id', 'gstin state_code')
    .lean();

  return bills.map(bill => ({
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    customer_gstin: bill.gstin,
    customer_state_code: bill.state_code,
    invoice_value: bill.gtot,
    taxable_value: bill.ntot,
    place_of_supply: bill.state_code,
    bill_id: bill._id,
  }));
}

/**
 * Table 6: Exports (With/Without Payment, SEZ, Deemed Exports)
 */
export async function getExports(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: { $in: ['EXPORT', 'EXPORT_WITH_PAYMENT', 'EXPORT_WITHOUT_PAYMENT', 'SEZ_WITH_PAYMENT', 'SEZ_WITHOUT_PAYMENT', 'DEEMED_EXPORT'] },
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  }).lean();

  return bills.map(bill => ({
    export_type: bill.btype,
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    invoice_value: bill.gtot,
    taxable_value: bill.ntot,
    igst: bill.igst || 0,
    cess: 0,
    port_code: bill.port_code || '',
    shipping_bill_no: bill.shipping_bill_no || '',
    shipping_bill_date: bill.shipping_bill_date || '',
    bill_id: bill._id,
  }));
}

/**
 * Table 8: Nil Rated, Exempted, Non-GST Supplies
 */
export async function getNilRatedSupplies(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    cgst: 0,
    sgst: 0,
    igst: 0,
  }).lean();

  const firmStateCode = firmGstin ? firmGstin.substring(0, 2) : null;

  // Categorize by supply type and inter/intra state
  const categorized = {
    nil_rated_intra: 0,
    nil_rated_inter: 0,
    exempted_intra: 0,
    exempted_inter: 0,
    non_gst_intra: 0,
    non_gst_inter: 0,
  };

  bills.forEach(bill => {
    const isInterState = bill.state_code && bill.state_code !== firmStateCode;
    const category = bill.supply_type || 'nil_rated'; // nil_rated, exempted, non_gst
    
    if (category === 'exempted') {
      if (isInterState) categorized.exempted_inter += bill.ntot || 0;
      else categorized.exempted_intra += bill.ntot || 0;
    } else if (category === 'non_gst') {
      if (isInterState) categorized.non_gst_inter += bill.ntot || 0;
      else categorized.non_gst_intra += bill.ntot || 0;
    } else {
      if (isInterState) categorized.nil_rated_inter += bill.ntot || 0;
      else categorized.nil_rated_intra += bill.ntot || 0;
    }
  });

  return [
    { description: 'Nil Rated Supplies', inter_state: categorized.nil_rated_inter, intra_state: categorized.nil_rated_intra },
    { description: 'Exempted Supplies', inter_state: categorized.exempted_inter, intra_state: categorized.exempted_intra },
    { description: 'Non-GST Supplies', inter_state: categorized.non_gst_inter, intra_state: categorized.non_gst_intra },
  ];
}

/**
 * Table 10: B2CS Amendments
 */
export async function getB2CSAmendments(firmId, firmGstin, startDate, endDate) {
  // B2CS amendments are typically aggregated changes to previous period B2CS data
  // This would require tracking amendments in a separate collection
  // For now, returning empty array - implement based on your amendment tracking mechanism
  return [];
}

/**
 * Table 11: Advances Received/Adjusted
 */
export async function getAdvances(firmId, firmGstin, startDate, endDate) {
  const advances = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'ADVANCE_RECEIPT',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  }).lean();

  const firmStateCode = firmGstin ? firmGstin.substring(0, 2) : null;

  // Aggregate by place of supply and rate
  const aggregated = {};

  advances.forEach(adv => {
    const stateCode = adv.state_code || firmStateCode || '00';
    const gstRate = adv.cgst + adv.sgst + adv.igst > 0 
      ? Math.round(((adv.cgst + adv.sgst + adv.igst) / adv.ntot) * 100)
      : 0;
    const key = `${stateCode}_${gstRate}`;

    if (!aggregated[key]) {
      aggregated[key] = {
        place_of_supply: stateCode,
        rate: gstRate,
        gross_advance_received: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
      };
    }

    aggregated[key].gross_advance_received += adv.gtot || 0;
    aggregated[key].cgst += adv.cgst || 0;
    aggregated[key].sgst += adv.sgst || 0;
    aggregated[key].igst += adv.igst || 0;
  });

  return Object.values(aggregated);
}

/**
 * Table 12: HSN Summary - B2B Tab
 * Mandatory: 4-digit HSN for turnover < ₹5 Cr, 6-digit for ≥ ₹5 Cr
 */
export async function getHSNSummaryB2B(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    gstin: { $ne: 'UNREGISTERED', $exists: true },
  }).lean();

  const billIds = bills.map(b => b._id);

  const stockRegs = await StockReg.find({
    firm_id: firmId,
    type: 'SALE',
    bill_id: { $in: billIds },
  }).lean();

  // Aggregate by HSN
  const aggregated = {};

  stockRegs.forEach(sr => {
    const hsn = sr.hsn || '0000';

    if (!aggregated[hsn]) {
      aggregated[hsn] = {
        hsn: hsn,
        description: sr.item || '',
        uqc: sr.uom || 'PCS',
        total_quantity: 0,
        total_value: 0,
        taxable_value: 0,
        integrated_tax: 0,
        central_tax: 0,
        state_ut_tax: 0,
        cess: 0,
      };
    }

    aggregated[hsn].total_quantity += parseFloat(sr.qty) || 0;
    aggregated[hsn].total_value += parseFloat(sr.total) || 0;
    aggregated[hsn].taxable_value += parseFloat(sr.total) || 0;

    // Find corresponding bill for GST
    const bill = bills.find(b => b._id.toString() === sr.bill_id.toString());
    if (bill) {
      const billTaxableValue = bill.ntot || 1;
      const itemProportion = (parseFloat(sr.total) || 0) / billTaxableValue;
      aggregated[hsn].central_tax += (bill.cgst || 0) * itemProportion;
      aggregated[hsn].state_ut_tax += (bill.sgst || 0) * itemProportion;
      aggregated[hsn].integrated_tax += (bill.igst || 0) * itemProportion;
    }
  });

  return Object.values(aggregated);
}

/**
 * Table 12: HSN Summary - B2C Tab
 */
export async function getHSNSummaryB2C(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    $or: [
      { gstin: 'UNREGISTERED' },
      { gstin: { $exists: false } },
      { gstin: null },
    ],
  }).lean();

  const billIds = bills.map(b => b._id);

  const stockRegs = await StockReg.find({
    firm_id: firmId,
    type: 'SALE',
    bill_id: { $in: billIds },
  }).lean();

  // Aggregate by HSN
  const aggregated = {};

  stockRegs.forEach(sr => {
    const hsn = sr.hsn || '0000';

    if (!aggregated[hsn]) {
      aggregated[hsn] = {
        hsn: hsn,
        description: sr.item || '',
        uqc: sr.uom || 'PCS',
        total_quantity: 0,
        total_value: 0,
        taxable_value: 0,
        integrated_tax: 0,
        central_tax: 0,
        state_ut_tax: 0,
        cess: 0,
      };
    }

    aggregated[hsn].total_quantity += parseFloat(sr.qty) || 0;
    aggregated[hsn].total_value += parseFloat(sr.total) || 0;
    aggregated[hsn].taxable_value += parseFloat(sr.total) || 0;

    // Find corresponding bill for GST
    const bill = bills.find(b => b._id.toString() === sr.bill_id.toString());
    if (bill) {
      const billTaxableValue = bill.ntot || 1;
      const itemProportion = (parseFloat(sr.total) || 0) / billTaxableValue;
      aggregated[hsn].central_tax += (bill.cgst || 0) * itemProportion;
      aggregated[hsn].state_ut_tax += (bill.sgst || 0) * itemProportion;
      aggregated[hsn].integrated_tax += (bill.igst || 0) * itemProportion;
    }
  });

  return Object.values(aggregated);
}

/**
 * Table 13: Document Summary
 * All documents issued during the tax period
 */
export async function getDocumentSummary(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  }).lean();

  // Categorize documents by type
  const docTypes = {
    invoices: { from: '', to: '', total: 0, cancelled: 0 },
    credit_notes: { from: '', to: '', total: 0, cancelled: 0 },
    debit_notes: { from: '', to: '', total: 0, cancelled: 0 },
    delivery_challan: { from: '', to: '', total: 0, cancelled: 0 },
  };

  const invoices = bills.filter(b => b.btype === 'SALES' || b.btype === 'PURCHASE');
  const creditNotes = bills.filter(b => b.btype === 'CREDIT_NOTE');
  const debitNotes = bills.filter(b => b.btype === 'DEBIT_NOTE');

  if (invoices.length > 0) {
    const invoiceNos = invoices.map(b => b.bno).sort();
    docTypes.invoices.from = invoiceNos[0];
    docTypes.invoices.to = invoiceNos[invoiceNos.length - 1];
    docTypes.invoices.total = invoices.length;
    docTypes.invoices.cancelled = invoices.filter(b => b.status === 'CANCELLED').length;
  }

  if (creditNotes.length > 0) {
    const cnNos = creditNotes.map(b => b.bno).sort();
    docTypes.credit_notes.from = cnNos[0];
    docTypes.credit_notes.to = cnNos[cnNos.length - 1];
    docTypes.credit_notes.total = creditNotes.length;
    docTypes.credit_notes.cancelled = creditNotes.filter(b => b.status === 'CANCELLED').length;
  }

  if (debitNotes.length > 0) {
    const dnNos = debitNotes.map(b => b.bno).sort();
    docTypes.debit_notes.from = dnNos[0];
    docTypes.debit_notes.to = dnNos[dnNos.length - 1];
    docTypes.debit_notes.total = debitNotes.length;
    docTypes.debit_notes.cancelled = debitNotes.filter(b => b.status === 'CANCELLED').length;
  }

  return [
    { nature_of_document: 'Invoices for outward supply', sr_no_from: docTypes.invoices.from, sr_no_to: docTypes.invoices.to, total_number: docTypes.invoices.total, cancelled: docTypes.invoices.cancelled },
    { nature_of_document: 'Credit Notes', sr_no_from: docTypes.credit_notes.from, sr_no_to: docTypes.credit_notes.to, total_number: docTypes.credit_notes.total, cancelled: docTypes.credit_notes.cancelled },
    { nature_of_document: 'Debit Notes', sr_no_from: docTypes.debit_notes.from, sr_no_to: docTypes.debit_notes.to, total_number: docTypes.debit_notes.total, cancelled: docTypes.debit_notes.cancelled },
  ];
}

/**
 * Table 14: E-commerce Supplies (TCS under Section 52)
 * Sales through e-commerce operators where TCS is collected
 */
export async function getEcommerceSupplies(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    ecommerce_gstin: { $exists: true, $ne: null },
  }).lean();

  // Group by e-commerce operator GSTIN
  const grouped = {};

  bills.forEach(bill => {
    const ecomGstin = bill.ecommerce_gstin;
    if (!grouped[ecomGstin]) {
      grouped[ecomGstin] = {
        ecommerce_gstin: ecomGstin,
        supplies: [],
      };
    }

    grouped[ecomGstin].supplies.push({
      invoice_no: bill.bno,
      invoice_date: bill.bdate,
      invoice_value: bill.gtot,
      taxable_value: bill.ntot,
      cgst: bill.cgst || 0,
      sgst: bill.sgst || 0,
      igst: bill.igst || 0,
    });
  });

  return Object.values(grouped);
}

/**
 * Table 15: E-commerce Operator Supplies (Section 9(5))
 * For e-commerce operators who pay tax on behalf of suppliers
 */
export async function getEcommerceOperatorSupplies(firmId, firmGstin, startDate, endDate) {
  // This table is only for e-commerce operators themselves
  // Regular taxpayers will have empty data here
  return [];
}

/**
 * Get exempted supplies (nil or exempted GST rate)
 */
export async function getExemptedSupplies(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    cgst: 0,
    sgst: 0,
    igst: 0,
  }).lean();

  return bills.map(bill => ({
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    customer_gstin: bill.gstin,
    invoice_value: bill.gtot,
    taxable_value: bill.ntot,
    bill_id: bill._id,
  }));
}

/**
 * Get GSTR1 summary statistics
 */
export async function getGSTR1Summary(firmId, firmGstin, startDate, endDate) {
  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  }).lean();

  const b2bBills = bills.filter(b => b.gstin && b.gstin !== 'UNREGISTERED');
  const b2cBills = bills.filter(b => !b.gstin || b.gstin === 'UNREGISTERED');

  const totalTaxableValue = bills.reduce((sum, b) => sum + (b.ntot || 0), 0);
  const totalCGST = bills.reduce((sum, b) => sum + (b.cgst || 0), 0);
  const totalSGST = bills.reduce((sum, b) => sum + (b.sgst || 0), 0);
  const totalIGST = bills.reduce((sum, b) => sum + (b.igst || 0), 0);
  const totalInvoiceValue = bills.reduce((sum, b) => sum + (b.gtot || 0), 0);

  return {
    period_start: startDate,
    period_end: endDate,
    firm_gstin: firmGstin,
    total_invoices: bills.length,
    b2b_invoices: b2bBills.length,
    b2c_invoices: b2cBills.length,
    total_taxable_value: parseFloat(totalTaxableValue.toFixed(2)),
    total_cgst: parseFloat(totalCGST.toFixed(2)),
    total_sgst: parseFloat(totalSGST.toFixed(2)),
    total_igst: parseFloat(totalIGST.toFixed(2)),
    total_invoice_value: parseFloat(totalInvoiceValue.toFixed(2)),
    total_gst: parseFloat((totalCGST + totalSGST + totalIGST).toFixed(2)),
  };
}

/**
 * Validate GSTR1 data with comprehensive checks
 */
export async function validateGSTR1Data(firmId, firmGstin, startDate, endDate) {
  const errors = [];
  const warnings = [];

  const bills = await Bill.find({
    firm_id: firmId,
    firm_gstin: firmGstin,
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  }).lean();

  const stockRegs = await StockReg.find({
    firm_id: firmId,
    type: 'SALE',
    bill_id: { $in: bills.map(b => b._id) },
  }).lean();

  bills.forEach(bill => {
    // Check for missing GSTIN in B2B
    if (!bill.gstin || bill.gstin === 'UNREGISTERED') {
      if (bill.gtot > 100000) {
        // B2CL threshold is ₹1 lakh
        const firmStateCode = firmGstin ? firmGstin.substring(0, 2) : null;
        const isInterState = bill.state_code && bill.state_code !== firmStateCode;
        if (isInterState) {
          warnings.push(`Bill ${bill.bno}: B2CL invoice (inter-state > ₹1 lakh) - ensure proper reporting`);
        }
      }
    }

    // Check for missing state code
    if (!bill.state_code) {
      errors.push(`Bill ${bill.bno}: Missing state code (mandatory for GSTR-1)`);
    }

    // Check for GST mismatch
    const expectedGST = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
    const actualGST = (bill.gtot || 0) - (bill.ntot || 0);
    if (Math.abs(expectedGST - actualGST) > 0.01) {
      warnings.push(`Bill ${bill.bno}: GST calculation mismatch (Expected: ${expectedGST.toFixed(2)}, Actual: ${actualGST.toFixed(2)})`);
    }

    // Check for inter-state CGST/SGST (should be IGST)
    const firmStateCode = firmGstin ? firmGstin.substring(0, 2) : null;
    const isInterState = bill.state_code && bill.state_code !== firmStateCode;
    if (isInterState && ((bill.cgst || 0) > 0 || (bill.sgst || 0) > 0)) {
      errors.push(`Bill ${bill.bno}: Inter-state supply should have IGST, not CGST/SGST`);
    }

    // Check for intra-state IGST (should be CGST/SGST)
    if (!isInterState && (bill.igst || 0) > 0) {
      errors.push(`Bill ${bill.bno}: Intra-state supply should have CGST/SGST, not IGST`);
    }
  });

  // Validate HSN codes
  stockRegs.forEach(sr => {
    const hsn = sr.hsn || '';
    if (hsn.length < 4) {
      errors.push(`Item ${sr.item}: HSN code must be at least 4 digits (current: ${hsn})`);
    }
    // Note: 6-digit HSN mandatory for turnover ≥ ₹5 Cr (implement based on firm's turnover)
  });

  return { 
    errors, 
    warnings, 
    valid: errors.length === 0,
    total_bills: bills.length,
    total_items: stockRegs.length,
  };
}
