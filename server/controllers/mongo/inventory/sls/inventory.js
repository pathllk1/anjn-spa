import mongoose from 'mongoose';
import {
  Stock, Party, Bill, StockReg, Ledger, Firm,
} from '../../../../models/index.js';
import {
  getActorUsername, getFirmId, validateObjectId,
  normalizeOptionalText, normalizeOptionalMultilineText,
  getNextBillNumber, previewNextBillNumber, getNextVoucherNumber,
  isGstEnabled, calcBillTotals,
  isServiceItem, getEffectiveItemQty,
} from '../billUtils.js';
import { postSalesLedger } from '../inventoryLedgerHelper.js';

/* ── Re-export everything shared ─────────────────────────────────────────── */
export {
  getAllStocks, createStock, getStockById, updateStock, deleteStock,
  getAllParties, createParty,
  getBillById, getAllBills, exportBillsExcel, exportBillsToPdf,
  getStockBatches, getStockMovements, exportStockMovementsToExcel,
  getStockMovementsByStock, createStockMovement,
  getOtherChargesTypes, lookupGST,
} from '../sharedStockHandlers.js';

/* ── Sales-specific: getCurrentUserFirmName (includes locations[]) ─────────
 *
 * FIX: The shared handler returned only { name } from the Firm document.
 * With multiple GST registrations the frontend needs locations[] so it can:
 *   1. Show a "billing from GSTIN" dropdown when a firm has >1 registration
 *   2. Auto-determine intra vs inter-state when a party is selected
 *   3. Send back meta.firmGstin on save so we can validate server-side
 * ────────────────────────────────────────────────────────────────────────── */

export const getCurrentUserFirmName = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'GET_CURRENT_FIRM');
    if (!firmId) return;

    const firm = await Firm.findById(firmId)
      .select('name locations')
      .lean();

    if (!firm) return res.status(404).json({ success: false, error: 'Firm not found' });

    res.json({
      success: true,
      data: {
        name:      firm.name,
        locations: firm.locations || [],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Sales-specific: party item history (type: SALE) ─────────────────────── */

export const getPartyItemHistory = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_PARTY_ITEM_HISTORY');
    if (!firmId) return;
    const partyId = validateObjectId(req.query.partyId, 'partyId', res);
    if (!partyId) return;
    const stockId = validateObjectId(req.query.stockId, 'stockId', res);
    if (!stockId) return;

    const limitParam = req.query.limit;
    const limit = limitParam === 'all' ? null : Math.min(parseInt(limitParam) || 10, 500);
    const fid = new mongoose.Types.ObjectId(firmId);
    const pid = new mongoose.Types.ObjectId(partyId);
    const sid = new mongoose.Types.ObjectId(stockId);

    const pipeline = [
      { $match: { firm_id: fid, stock_id: sid, type: 'SALE' } },
      { $lookup: { from: 'bills', localField: 'bill_id', foreignField: '_id', as: 'billDoc' } },
      { $unwind: { path: '$billDoc', preserveNullAndEmptyArrays: false } },
      { $match: { 'billDoc.party_id': pid } },
      { $sort:  { bdate: -1, createdAt: -1 } },
      ...(limit !== null ? [{ $limit: limit }] : []),
      { $project: { reg_id: '$_id', stock_id: 1, item: 1, batch: 1, hsn: 1, qty: 1, uom: 1, rate: 1, grate: 1, disc: 1, total: 1, bno: 1, bdate: 1, createdAt: 1, bill_id: '$billDoc._id', party_id: '$billDoc.party_id', firm: '$billDoc.firm', usern: '$billDoc.usern' } },
    ];

    const rows = await StockReg.aggregate(pipeline);
    res.json({ success: true, data: { partyId, stockId, rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ── Sales-specific: bill number preview ─────────────────────────────────── */

export const getNextBillNumberPreviewEndpoint = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'PREVIEW_BILL_NUMBER');
    if (!firmId) return;
    const billNo = await previewNextBillNumber(firmId, 'SALES');
    res.json({ success: true, nextBillNumber: billNo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Sales-specific: party balance (DEBTOR orientation) ──────────────────── */

export const getPartyBalance = async (req, res) => {
  try {
    const firmId  = getFirmId(req, res, 'GET_PARTY_BALANCE');
    if (!firmId) return;
    const partyId = validateObjectId(req.params.partyId, 'partyId', res);
    if (!partyId) return;

    const [result] = await Ledger.aggregate([
      { $match: { firm_id: new mongoose.Types.ObjectId(firmId), party_id: new mongoose.Types.ObjectId(partyId) } },
      { $group: { _id: null, total_debit: { $sum: '$debit_amount' }, total_credit: { $sum: '$credit_amount' } } },
    ]);

    const debit   = result?.total_debit  ?? 0;
    const credit  = result?.total_credit ?? 0;
    const balance = debit - credit;
    const balanceType = balance > 0 ? 'Debit' : balance < 0 ? 'Credit' : 'Nil';
    res.json({ success: true, data: { partyId, balance, balance_type: balanceType, outstanding: Math.abs(balance), debit, credit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   SHARED HELPERS
════════════════════════════════════════════════════════════════════════════ */

/**
 * Resolve and validate the active firm location for a bill.
 *
 * firmGstin (from meta.firmGstin) is the GSTIN the frontend says was selected.
 * If absent, fall back to the firm's default location.
 *
 * Returns { firmLoc, firmStateCode } or throws with a descriptive error.
 */
async function resolveFirmLocation(firmId, firmGstin) {
  const firmDoc = await Firm.findById(firmId).select('locations').lean();
  const locations = firmDoc?.locations || [];

  let firmLoc = null;

  if (firmGstin) {
    firmLoc = locations.find(l => l.gst_number === firmGstin);
    if (!firmLoc) {
      throw new Error(`Firm GSTIN ${firmGstin} not found in firm's registered locations`);
    }
  } else {
    firmLoc = locations.find(l => l.is_default) || locations[0] || null;
  }

  const firmStateCode = firmLoc?.state_code || firmLoc?.gst_number?.substring(0, 2) || null;

  return { firmLoc, firmStateCode };
}

/**
 * Validate GST bill type against firm and party state codes.
 *
 * Section 8 IGST Act:
 *   - same state  → intra-state (CGST + SGST)   — IGST is illegal
 *   - diff states → inter-state (IGST)           — CGST/SGST is illegal
 *
 * Skips validation when:
 *   - party is UNREGISTERED (B2C / unregistered dealer)
 *   - reverse charge (special handling)
 *   - either state code cannot be determined
 */
function validateGstBillType(billType, firmStateCode, partyStateCode, reverseCharge) {
  if (reverseCharge) return null; // reverse charge has different place-of-supply rules
  if (!firmStateCode || !partyStateCode) return null; // cannot determine

  const sameState  = firmStateCode === partyStateCode;
  const sentIntra  = billType === 'intra-state' || billType === 'INTRA-STATE';

  if (sameState && !sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and party state (${partyStateCode}) are the same — must use CGST+SGST (intra-state), not IGST.`;
  }
  if (!sameState && sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and party state (${partyStateCode}) differ — must use IGST (inter-state), not CGST+SGST.`;
  }
  return null; // all good
}

/* ════════════════════════════════════════════════════════════════════════════
   CREATE BILL (SALES)
════════════════════════════════════════════════════════════════════════════ */

export const createBill = async (req, res) => {
  const { meta, party, cart, otherCharges, consignee } = req.body;
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
  const firmId = getFirmId(req, res, 'CREATE_BILL');
  if (!firmId) return;

  if (!cart || cart.length === 0) return res.status(400).json({ error: 'Cart cannot be empty' });

  const partyIdRaw = party?.id ?? party?._id ?? party;
  if (!partyIdRaw || !mongoose.Types.ObjectId.isValid(partyIdRaw)) {
    return res.status(400).json({ error: 'Invalid party ID' });
  }

  const partyDoc = await Party.findOne({ _id: partyIdRaw, firm_id: firmId }).lean();
  if (!partyDoc) {
    return res.status(404).json({ error: 'Party not found' });
  }

  // ── FIX: Resolve firm location + validate GST bill type ─────────────────
  let firmLoc, firmStateCode;
  try {
    ({ firmLoc, firmStateCode } = await resolveFirmLocation(firmId, meta?.firmGstin));
  } catch (locErr) {
    return res.status(400).json({ error: locErr.message });
  }

  // Only validate when party has a GST number (skip B2C / UNREGISTERED)
  const partyStateCode = partyDoc.gstin && partyDoc.gstin !== 'UNREGISTERED'
    ? (partyDoc.state_code || partyDoc.gstin.substring(0, 2))
    : null;

  const gstTypeError = validateGstBillType(
    meta?.billType, firmStateCode, partyStateCode, meta?.reverseCharge
  );
  if (gstTypeError) {
    return res.status(400).json({ error: gstTypeError });
  }
  // ────────────────────────────────────────────────────────────────────────

  const referenceNo = normalizeOptionalText(meta?.referenceNo, 80);
  const vehicleNo   = normalizeOptionalText(meta?.vehicleNo, 40);
  const dispatchVia = normalizeOptionalText(meta?.dispatchThrough, 80);
  const narration   = normalizeOptionalMultilineText(meta?.narration, 2000);
  const billSubtype = meta?.billType ? String(meta.billType).toUpperCase() : null;

  // Validate cart
  for (const item of cart) {
    const serviceItem = isServiceItem(item);
    if (!normalizeOptionalText(item.item, 200))
      return res.status(400).json({ error: 'Item description is required' });
    if (!serviceItem && (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId)))
      return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
    if (!serviceItem && getEffectiveItemQty(item) <= 0)
      return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
    if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
      return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const billNo    = await getNextBillNumber(firmId, 'SALES');
    const voucherId = await getNextVoucherNumber(firmId);

    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(
      cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge, getEffectiveItemQty
    );

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? '';

    const [newBill] = await Bill.create([{
      firm_id: firmId, voucher_id: String(voucherId), bno: billNo,
      bdate: meta.billDate, supply: partyDoc.firm || '', firm: firmName,
      addr: partyDoc.addr || '', gstin: partyDoc.gstin || 'UNREGISTERED',
      state: partyDoc.state || '', pin: partyDoc.pin || null, state_code: partyDoc.state_code || null,

      // FIX: Store the firm GSTIN / location used for this bill
      firm_gstin:      firmLoc?.gst_number  || null,
      firm_state:      firmLoc?.state       || null,
      firm_state_code: firmStateCode        || null,

      gtot, ntot, rof, btype: 'SALES', bill_subtype: billSubtype,
      usern: actorUsername, party_id: partyDoc._id,
      other_charges: otherCharges?.length > 0 ? otherCharges : null,
      order_no: referenceNo, vehicle_no: vehicleNo, dispatch_through: dispatchVia, narration,
      reverse_charge: Boolean(meta.reverseCharge), cgst, sgst, igst,
      consignee_name: consignee?.name || null, consignee_gstin: consignee?.gstin || null,
      consignee_address: consignee?.address || null, consignee_state: consignee?.state || null,
      consignee_pin: consignee?.pin || null, consignee_state_code: consignee?.stateCode || null,
    }], { session });

    const billId = newBill._id;

    const stockRegDocs = [];
    const cogsLines    = [];

    for (const item of cart) {
      const serviceItem  = isServiceItem(item);
      const effectiveQty = getEffectiveItemQty(item);
      const lineTotal    = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);

      if (serviceItem) {
        const stockRegId = new mongoose.Types.ObjectId();
        stockRegDocs.push({
          _id: stockRegId, firm_id: firmId, type: 'SALE', bno: billNo,
          bdate: meta.billDate, supply: partyDoc.firm,
          item_type: 'SERVICE', show_qty: item.showQty !== false,
          item: normalizeOptionalText(item.item, 200),
          item_narration: normalizeOptionalMultilineText(item.narration, 1000),
          batch: null, hsn: normalizeOptionalText(item.hsn, 40),
          qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
          rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
          cost_rate: null, stock_id: null, bill_id: billId, user: actorUsername, qtyh: 0,
        });
        continue;
      }

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId })
        .session(session).lean();
      if (!stockRecord)
        throw new Error(`Stock not found: ${item.stockId} (item: ${item.item})`);

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];

      let batchIndex = -1;
      if (item.batchIndex !== undefined && item.batchIndex !== null) {
        batchIndex = parseInt(item.batchIndex);
        if (batchIndex < 0 || batchIndex >= batches.length)
          throw new Error(`Invalid batch index ${item.batchIndex} for item ${item.item}`);
      } else if (!item.batch || item.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === item.batch);
      }

      if (batchIndex === -1)
        throw new Error(`Batch "${item.batch || '(No Batch)'}" not found for item ${item.item}`);

      const wacCostRate = stockRecord.rate;
      const cogsValue   = effectiveQty * wacCostRate;

      batches[batchIndex].qty -= effectiveQty;
      const newTotalQty = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);

      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } },
        { session }
      );

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id: stockRegId, firm_id: firmId, type: 'SALE', bno: billNo,
        bdate: meta.billDate, supply: partyDoc.firm,
        item_type: 'GOODS', show_qty: true,
        item: normalizeOptionalText(item.item, 200),
        item_narration: normalizeOptionalMultilineText(item.narration, 1000),
        batch: item.batch || null, hsn: normalizeOptionalText(item.hsn, 40),
        qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
        rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
        cost_rate: wacCostRate,
        stock_id: item.stockId, bill_id: billId, user: actorUsername, qtyh: newTotalQty,
      });

      cogsLines.push({
        stockId:    item.stockId,
        stockRegId,
        item:       normalizeOptionalText(item.item, 200),
        cogsValue,
      });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    const taxableItemsTotal = cart.reduce(
      (sum, item) => sum + (getEffectiveItemQty(item) * item.rate * (1 - (item.disc || 0) / 100)), 0
    );

    await postSalesLedger({
      firmId, billId, voucherId, billNo, billDate: meta.billDate,
      party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, taxableItemsTotal, cogsLines, actorUsername, session,
    });

    await session.commitTransaction();
    res.json({ success: true, id: billId, billNo, message: 'Bill created successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CREATE_BILL] Error:', err.message, err.stack);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message || 'Failed to create bill', details: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  } finally {
    session.endSession();
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   UPDATE BILL (SALES)
════════════════════════════════════════════════════════════════════════════ */

export const updateBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
    const firmId = getFirmId(req, res, 'UPDATE_BILL');
    if (!firmId) return;
    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) return;

    const { meta, party, cart, otherCharges, consignee } = req.body;
    if (!cart?.length) return res.status(400).json({ error: 'Cart cannot be empty' });

    const partyIdRaw = party?.id ?? party?._id;
    if (!partyIdRaw || !mongoose.Types.ObjectId.isValid(partyIdRaw)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid party ID' });
    }
    const partyDoc = await Party.findOne({ _id: partyIdRaw, firm_id: firmId }).lean();
    if (!partyDoc) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Party not found or does not belong to your firm' });
    }

    // ── FIX: Resolve firm location + validate GST bill type ─────────────────
    let firmLoc, firmStateCode;
    try {
      ({ firmLoc, firmStateCode } = await resolveFirmLocation(firmId, meta?.firmGstin));
    } catch (locErr) {
      await session.abortTransaction();
      return res.status(400).json({ error: locErr.message });
    }

    const partyStateCode = partyDoc.gstin && partyDoc.gstin !== 'UNREGISTERED'
      ? (partyDoc.state_code || partyDoc.gstin.substring(0, 2))
      : null;

    const gstTypeError = validateGstBillType(
      meta?.billType, firmStateCode, partyStateCode, meta?.reverseCharge
    );
    if (gstTypeError) {
      await session.abortTransaction();
      return res.status(400).json({ error: gstTypeError });
    }
    // ────────────────────────────────────────────────────────────────────────

    // Validate cart
    for (const item of cart) {
      const serviceItem = isServiceItem(item);
      if (!normalizeOptionalText(item.item, 200))
        return res.status(400).json({ error: 'Item description is required' });
      if (!serviceItem && (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId)))
        return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
      if (!serviceItem && getEffectiveItemQty(item) <= 0)
        return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
      if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
        return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
    }

    const existingBill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!existingBill) return res.status(404).json({ error: 'Bill not found' });
    if (existingBill.status === 'CANCELLED') return res.status(400).json({ error: 'Cancelled bills cannot be modified' });
    if (meta.billNo && meta.billNo !== existingBill.bno) return res.status(400).json({ error: 'Bill number cannot be changed' });

    // Step 1: Restore stock from old sale (add back)
    const existingItems = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const ei of existingItems) {
      if (!ei.stock_id) continue;
      const stockRecord = await Stock.findOne({ _id: ei.stock_id, firm_id: firmId }).session(session).lean();
      if (!stockRecord) continue;

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];
      let batchIndex = -1;
      if (!ei.batch || ei.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === ei.batch);
      }

      if (batchIndex !== -1) {
        batches[batchIndex].qty += ei.qty;
      } else {
        batches.push({ batch: ei.batch || null, qty: ei.qty, rate: ei.rate, expiry: null, mrp: null });
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      await Stock.findOneAndUpdate(
        { _id: ei.stock_id, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } },
        { session }
      );
    }

    // Step 2: Recalculate totals
    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(
      cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge, getEffectiveItemQty
    );

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? existingBill.firm ?? '';

    // Step 3: Update bill header — including the firm GSTIN fields
    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: {
          bdate: meta.billDate, supply: partyDoc.firm || '', firm: firmName,
          addr: partyDoc.addr || '', gstin: partyDoc.gstin || 'UNREGISTERED',
          state: partyDoc.state || '', pin: partyDoc.pin || null, state_code: partyDoc.state_code || null,

          // FIX: Update firm GSTIN fields in case the user changed the billing location
          firm_gstin:      firmLoc?.gst_number  || null,
          firm_state:      firmLoc?.state       || null,
          firm_state_code: firmStateCode        || null,

          gtot, ntot, rof, btype: 'SALES',
          bill_subtype: meta?.billType ? String(meta.billType).toUpperCase() : null,
          usern: actorUsername, party_id: partyDoc._id,
          other_charges: otherCharges?.length > 0 ? otherCharges : null,
          order_no: normalizeOptionalText(meta?.referenceNo, 80),
          vehicle_no: normalizeOptionalText(meta?.vehicleNo, 40),
          dispatch_through: normalizeOptionalText(meta?.dispatchThrough, 80),
          narration: normalizeOptionalMultilineText(meta?.narration, 2000),
          reverse_charge: Boolean(meta.reverseCharge), cgst, sgst, igst,
          consignee_name: consignee?.name || null, consignee_gstin: consignee?.gstin || null,
          consignee_address: consignee?.address || null, consignee_state: consignee?.state || null,
          consignee_pin: consignee?.pin || null, consignee_state_code: consignee?.stateCode || null,
      }},
      { session }
    );

    // Step 4: Delete old StockReg entries
    await StockReg.deleteMany({ bill_id: billId, firm_id: firmId }, { session });

    // Step 5: Process new cart — deduct stock + build COGS lines
    const stockRegDocs = [];
    const cogsLines    = [];

    for (const item of cart) {
      const serviceItem  = isServiceItem(item);
      const effectiveQty = getEffectiveItemQty(item);
      const lineTotal    = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);

      if (serviceItem) {
        const stockRegId = new mongoose.Types.ObjectId();
        stockRegDocs.push({
          _id: stockRegId, firm_id: firmId, type: 'SALE', bno: existingBill.bno,
          bdate: meta.billDate, supply: partyDoc.firm,
          item_type: 'SERVICE', show_qty: item.showQty !== false,
          item: normalizeOptionalText(item.item, 200),
          item_narration: normalizeOptionalMultilineText(item.narration, 1000),
          batch: null, hsn: normalizeOptionalText(item.hsn, 40),
          qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
          rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
          cost_rate: null, stock_id: null, bill_id: billId, user: actorUsername, qtyh: 0,
        });
        continue;
      }

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId }).session(session).lean();
      if (!stockRecord) throw new Error(`Stock not found for ID: ${item.stockId}`);

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];
      let batchIndex = -1;

      if (item.batchIndex !== undefined && item.batchIndex !== null) {
        batchIndex = parseInt(item.batchIndex);
        if (batchIndex < 0 || batchIndex >= batches.length)
          throw new Error(`Invalid batch index ${item.batchIndex} for item ${item.item}`);
      } else if (!item.batch || item.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === item.batch);
      }

      if (batchIndex === -1)
        throw new Error(`Batch "${item.batch || '(No Batch)'}" not found for item ${item.item}`);

      const wacCostRate = stockRecord.rate;
      const cogsValue   = effectiveQty * wacCostRate;

      batches[batchIndex].qty -= effectiveQty;
      const newTotalQty = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);

      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } },
        { session }
      );

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id: stockRegId, firm_id: firmId, type: 'SALE', bno: existingBill.bno,
        bdate: meta.billDate, supply: partyDoc.firm,
        item_type: 'GOODS', show_qty: true,
        item: normalizeOptionalText(item.item, 200),
        item_narration: normalizeOptionalMultilineText(item.narration, 1000),
        batch: item.batch || null, hsn: normalizeOptionalText(item.hsn, 40),
        qty: effectiveQty, uom: normalizeOptionalText(item.uom, 20),
        rate: item.rate, grate: item.grate, disc: item.disc || 0, total: lineTotal,
        cost_rate: wacCostRate,
        stock_id: item.stockId, bill_id: billId, user: actorUsername, qtyh: newTotalQty,
      });

      cogsLines.push({ stockId: item.stockId, stockRegId, item: normalizeOptionalText(item.item, 200), cogsValue });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    const taxableItemsTotal = cart.reduce(
      (sum, item) => sum + (getEffectiveItemQty(item) * item.rate * (1 - (item.disc || 0) / 100)), 0
    );

    // Step 6: Delete old sales ledger and re-post
    await Ledger.deleteMany({ voucher_id: existingBill.voucher_id, voucher_type: 'SALES', firm_id: firmId }, { session });
    await postSalesLedger({
      firmId, billId, voucherId: existingBill.voucher_id, billNo: existingBill.bno,
      billDate: meta.billDate, party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, taxableItemsTotal, cogsLines, actorUsername, session,
    });

    await session.commitTransaction();
    res.json({ success: true, message: 'Bill updated successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[UPDATE_BILL] Error:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   CANCEL BILL (SALES)
════════════════════════════════════════════════════════════════════════════ */

export const cancelBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const actorUsername = getActorUsername(req);
    if (!actorUsername) { await session.abortTransaction(); return res.status(401).json({ error: 'Unauthorized' }); }
    const firmId = getFirmId(req, res, 'CANCEL_BILL');
    if (!firmId) { await session.abortTransaction(); return; }
    const billId = validateObjectId(req.params.id, 'bill ID', res);
    if (!billId) { await session.abortTransaction(); return; }

    const { reason } = req.body;
    const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!bill) { await session.abortTransaction(); return res.status(404).json({ error: 'Bill not found' }); }
    if (bill.status === 'CANCELLED') { await session.abortTransaction(); return res.status(400).json({ error: 'Bill is already cancelled' }); }

    const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const item of items) {
      if (!item.stock_id) continue;
      const stockRecord = await Stock.findOne({ _id: item.stock_id, firm_id: firmId }).session(session).lean();
      if (!stockRecord) continue;

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];
      let batchIndex = -1;
      if (!item.batch || item.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === item.batch);
      }

      if (batchIndex !== -1) {
        batches[batchIndex].qty += item.qty;
      } else {
        batches.push({ batch: item.batch || null, qty: item.qty, rate: item.rate, expiry: null, mrp: null });
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      await Stock.findOneAndUpdate(
        { _id: item.stock_id, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } },
        { session }
      );
    }

    await Ledger.deleteMany({ voucher_id: bill.voucher_id, voucher_type: 'SALES', firm_id: firmId }, { session });

    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: { status: 'CANCELLED', cancellation_reason: reason || null, cancelled_at: new Date(), cancelled_by: req.user.id } },
      { session }
    );

    await session.commitTransaction();
    res.json({ success: true, message: 'Bill cancelled successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CANCEL_BILL] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};