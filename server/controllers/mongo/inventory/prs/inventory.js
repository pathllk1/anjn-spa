import mongoose from 'mongoose';
import { createHash } from 'crypto';
import path from 'path';
import axios from 'axios';
import { put as blobPut } from '@vercel/blob';
import {
  Stock, Party, Bill, StockReg, Ledger, Firm,
} from '../../../../models/index.js';
import {
  getActorUsername, getFirmId, validateObjectId,
  normalizeOptionalText, normalizeOptionalMultilineText, escapeRegex,
  getNextBillNumber, previewNextBillNumber, getNextVoucherNumber,
  isGstEnabled, ensureUniqueSupplierBillNo, calcBillTotals,
  computeWAC, reverseWAC,
} from '../billUtils.js';
import { postPurchaseLedger } from '../inventoryLedgerHelper.js';

/* ── Re-export everything shared ─────────────────────────────────────────── */
export {
  getAllStocks, createStock, getStockById, updateStock, deleteStock,
  getAllParties, createParty,
  getBillById, getAllBills, exportBillsExcel, exportBillsToPdf,
  getStockBatches, getStockMovements, exportStockMovementsToExcel,
  getStockMovementsByStock, createStockMovement,
  getOtherChargesTypes, lookupGST,
} from '../sharedStockHandlers.js';

/* ── Purchase-specific: getCurrentUserFirmName (includes locations[]) ────── */

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

/* ── Purchase-specific: party item history ────────────────────────────────── */

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
      { $match: { firm_id: fid, stock_id: sid, type: 'PURCHASE' } },
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

/* ── Purchase-specific: bill number preview ───────────────────────────────── */

export const getNextBillNumberPreviewEndpoint = async (req, res) => {
  try {
    const firmId = getFirmId(req, res, 'PREVIEW_BILL_NUMBER');
    if (!firmId) return;
    const billNo = await previewNextBillNumber(firmId, 'PURCHASE');
    res.json({ success: true, nextBillNumber: billNo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Purchase-specific: party balance (CREDITOR orientation) ──────────────── */

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

    const debit  = result?.total_debit  ?? 0;
    const credit = result?.total_credit ?? 0;
    const balance     = credit - debit; // positive = still payable to supplier
    const balanceType = balance > 0 ? 'Credit' : balance < 0 ? 'Debit' : 'Nil';
    res.json({ success: true, data: { partyId, balance, balance_type: balanceType, outstanding: Math.abs(balance), debit, credit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   SHARED HELPERS
════════════════════════════════════════════════════════════════════════════ */

/**
 * Resolve and validate the active firm location for a purchase bill.
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
 * Validate GST bill type for a purchase.
 */
function validateGstBillType(billType, firmStateCode, partyStateCode, reverseCharge) {
  if (reverseCharge) return null;
  if (!firmStateCode || !partyStateCode) return null;

  const sameState = firmStateCode === partyStateCode;
  const sentIntra = billType === 'intra-state' || billType === 'INTRA-STATE';

  if (sameState && !sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and supplier state (${partyStateCode}) are the same — must use CGST+SGST (intra-state), not IGST.`;
  }
  if (!sameState && sentIntra) {
    return `GST type mismatch: firm state (${firmStateCode}) and supplier state (${partyStateCode}) differ — must use IGST (inter-state), not CGST+SGST.`;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════════════
   CREATE BILL (PURCHASE)
════════════════════════════════════════════════════════════════════════════ */

export const createBill = async (req, res) => {
  const { meta, party, cart, otherCharges, consignee } = req.body;
  const actorUsername = getActorUsername(req);
  if (!actorUsername) return res.status(401).json({ error: 'Unauthorized' });
  const firmId = getFirmId(req, res, 'CREATE_BILL');
  if (!firmId) return;

  if (!cart?.length) return res.status(400).json({ error: 'Cart cannot be empty' });
  if (!party || !mongoose.Types.ObjectId.isValid(party))
    return res.status(400).json({ error: 'Invalid party ID' });

  const partyDoc = await Party.findOne({ _id: party, firm_id: firmId }).lean();
  if (!partyDoc) return res.status(404).json({ error: 'Party not found' });

  let firmLoc, firmStateCode;
  try {
    ({ firmLoc, firmStateCode } = await resolveFirmLocation(firmId, meta?.firmGstin));
  } catch (locErr) {
    return res.status(400).json({ error: locErr.message });
  }

  const partyStateCode = partyDoc.gstin && partyDoc.gstin !== 'UNREGISTERED'
    ? (partyDoc.state_code || partyDoc.gstin.substring(0, 2))
    : null;

  const gstTypeError = validateGstBillType(
    meta?.billType, firmStateCode, partyStateCode, meta?.reverseCharge
  );
  if (gstTypeError) {
    return res.status(400).json({ error: gstTypeError });
  }

  const supplierBillNo = normalizeOptionalText(meta?.supplierBillNo, 80);
  const referenceNo    = normalizeOptionalText(meta?.referenceNo, 80);
  const vehicleNo      = normalizeOptionalText(meta?.vehicleNo, 40);
  const dispatchVia    = normalizeOptionalText(meta?.dispatchThrough, 80);
  const narration      = normalizeOptionalMultilineText(meta?.narration, 2000);
  const billSubtype    = meta?.billType ? String(meta.billType).toUpperCase() : null;

  for (const item of cart) {
    if (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId))
      return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
    if (!item.qty || parseFloat(item.qty) <= 0)
      return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
    if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
      return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await ensureUniqueSupplierBillNo({ firmId, partyId: partyDoc._id, supplierBillNo });

    const billNo    = await getNextBillNumber(firmId, 'PURCHASE');
    const voucherId = await getNextVoucherNumber(firmId);

    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge);

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? '';

    const [newBill] = await Bill.create([{
      firm_id: firmId, voucher_id: String(voucherId), bno: billNo,
      supplier_bill_no: supplierBillNo, bdate: meta.billDate,
      supply: partyDoc.firm || '', firm: firmName,
      addr: partyDoc.addr || '', gstin: partyDoc.gstin || 'UNREGISTERED',
      state: partyDoc.state || '', pin: partyDoc.pin || null,
      state_code: partyDoc.state_code || null,
      firm_gstin:      firmLoc?.gst_number  || null,
      firm_state:      firmLoc?.state       || null,
      firm_state_code: firmStateCode        || null,
      gtot, ntot, rof, btype: 'PURCHASE', bill_subtype: billSubtype,
      usern: actorUsername, party_id: partyDoc._id,
      other_charges: otherCharges?.length > 0 ? otherCharges : null,
      order_no: referenceNo, vehicle_no: vehicleNo, dispatch_through: dispatchVia,
      narration, reverse_charge: Boolean(meta.reverseCharge),
      cgst, sgst, igst,
      consignee_name: consignee?.name || null, consignee_gstin: consignee?.gstin || null,
      consignee_address: consignee?.address || null, consignee_state: consignee?.state || null,
      consignee_pin: consignee?.pin || null, consignee_state_code: consignee?.stateCode || null,
    }], { session });

    const billId = newBill._id;

    const stockRegDocs  = [];
    const purchasedItems = [];

    for (const item of cart) {
      const requestedQty = parseFloat(item.qty);
      const lineValue    = requestedQty * item.rate * (1 - (item.disc || 0) / 100);

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId })
        .session(session).lean();
      if (!stockRecord) throw new Error(`Stock not found: ${item.stockId} (item: ${item.item})`);

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];

      let batchIndex = -1;
      if (item.batchIndex !== undefined && item.batchIndex !== null) {
        const bi = parseInt(item.batchIndex);
        if (bi >= 0 && bi < batches.length) batchIndex = bi;
      } else if (!item.batch || item.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === item.batch);
      }

      if (batchIndex !== -1) {
        batches[batchIndex].qty += requestedQty;
        if (item.rate   !== undefined) batches[batchIndex].rate   = parseFloat(item.rate);
        if (item.mrp    != null)       batches[batchIndex].mrp    = parseFloat(item.mrp);
        if (item.expiry !== undefined) batches[batchIndex].expiry = item.expiry;
      } else {
        batches.push({
          batch: item.batch || null, qty: requestedQty,
          rate: parseFloat(item.rate) || 0, expiry: item.expiry || null,
          mrp: item.mrp != null ? parseFloat(item.mrp) : null,
        });
      }

      const newTotalQty = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);

      const effectiveExistingTotal = stockRecord.total ?? (stockRecord.qty * stockRecord.rate);
      const { blendedRate, newTotal } = computeWAC(
        effectiveExistingTotal, stockRecord.qty, requestedQty, lineValue
      );

      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, rate: blendedRate, total: newTotal, user: actorUsername } },
        { session }
      );

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id:            stockRegId,
        firm_id:        firmId, type: 'PURCHASE', bno: billNo,
        bdate:          meta.billDate, supply: partyDoc.firm,
        item:           item.item, item_narration: item.narration || null,
        batch:          item.batch || null, hsn: item.hsn,
        qty:            item.qty, uom: item.uom, rate: item.rate,
        grate:          item.grate, disc: item.disc || 0,
        total:          lineValue,
        cost_rate:      parseFloat(item.rate),
        stock_id:       item.stockId, bill_id: billId,
        user:           actorUsername, qtyh: newTotalQty,
      });

      purchasedItems.push({ stockId: item.stockId, stockRegId, item: item.item, lineValue });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    await postPurchaseLedger({
      firmId, billId, voucherId, billNo, billDate: meta.billDate,
      party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, purchasedItems, actorUsername, session,
    });

    await session.commitTransaction();
    res.json({ success: true, id: billId, billNo, message: 'Purchase bill created successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('[CREATE_BILL] Error:', err.message, err.stack);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message || 'Failed to create purchase bill' });
  } finally {
    session.endSession();
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   UPDATE BILL (PURCHASE)
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

    if (!party || !mongoose.Types.ObjectId.isValid(party)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid party ID' });
    }

    const partyDoc = await Party.findOne({ _id: party, firm_id: firmId }).lean();
    if (!partyDoc) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Party not found' });
    }

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

    for (const item of cart) {
      if (!item.stockId || !mongoose.Types.ObjectId.isValid(item.stockId))
        return res.status(400).json({ error: `Invalid stockId for item: ${item.item ?? '(unknown)'}` });
      if (!item.qty || parseFloat(item.qty) <= 0)
        return res.status(400).json({ error: `Quantity must be > 0 for item: ${item.item}` });
      if (item.rate === undefined || item.rate === null || parseFloat(item.rate) < 0)
        return res.status(400).json({ error: `Rate must be >= 0 for item: ${item.item}` });
    }

    const existingBill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
    if (!existingBill) return res.status(404).json({ error: 'Bill not found' });
    if (existingBill.status === 'CANCELLED') return res.status(400).json({ error: 'Cancelled bills cannot be modified' });
    if (meta.billNo && meta.billNo !== existingBill.bno) return res.status(400).json({ error: 'Bill number cannot be changed' });

    const supplierBillNo = normalizeOptionalText(meta?.supplierBillNo, 80);
    await ensureUniqueSupplierBillNo({ firmId, partyId: partyDoc._id, supplierBillNo, excludeBillId: billId });

    const existingItems = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const ei of existingItems) {
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
        batches[batchIndex].qty = Math.max(0, batches[batchIndex].qty - ei.qty);
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      const costValue = ei.total || (ei.qty * (ei.cost_rate ?? ei.rate));
      const { newRate, newTotal } = reverseWAC(
        stockRecord.total ?? (stockRecord.qty * stockRecord.rate),
        stockRecord.qty, ei.qty, costValue
      );
      await Stock.findOneAndUpdate(
        { _id: ei.stock_id, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, rate: newRate, total: newTotal, user: actorUsername } },
        { session }
      );
    }

    const gstEnabled = await isGstEnabled(firmId);
    const { gtot, cgst, sgst, igst, ntot, rof } = calcBillTotals(cart, otherCharges, gstEnabled, meta.billType, meta.reverseCharge);

    const firmRecord = await Firm.findById(firmId).select('name').lean();
    const firmName   = firmRecord?.name ?? existingBill.firm ?? '';

    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: {
          bdate: meta.billDate, supply: partyDoc.firm || '', firm: firmName,
          addr: partyDoc.addr || '', gstin: partyDoc.gstin || 'UNREGISTERED',
          state: partyDoc.state || '', pin: partyDoc.pin || null, state_code: partyDoc.state_code || null,
          firm_gstin:      firmLoc?.gst_number  || null,
          firm_state:      firmLoc?.state       || null,
          firm_state_code: firmStateCode        || null,
          gtot, ntot, rof, btype: 'PURCHASE',
          bill_subtype: meta?.billType ? String(meta.billType).toUpperCase() : null,
          usern: actorUsername, party_id: partyDoc._id,
          other_charges: otherCharges?.length > 0 ? otherCharges : null,
          supplier_bill_no: supplierBillNo,
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

    await StockReg.deleteMany({ bill_id: billId, firm_id: firmId }, { session });

    const stockRegDocs   = [];
    const purchasedItems = [];

    for (const item of cart) {
      const requestedQty = parseFloat(item.qty);
      const lineValue    = requestedQty * item.rate * (1 - (item.disc || 0) / 100);

      const stockRecord = await Stock.findOne({ _id: item.stockId, firm_id: firmId }).session(session).lean();
      if (!stockRecord) throw new Error(`Stock not found for ID: ${item.stockId}`);

      let batches = Array.isArray(stockRecord.batches) ? [...stockRecord.batches] : [];
      let batchIndex = -1;

      if (item.batchIndex !== undefined && item.batchIndex !== null) {
        const bi = parseInt(item.batchIndex);
        if (bi >= 0 && bi < batches.length) batchIndex = bi;
      } else if (!item.batch || item.batch === '') {
        batchIndex = batches.findIndex(b => !b.batch || b.batch === '');
      } else {
        batchIndex = batches.findIndex(b => b.batch === item.batch);
      }

      if (batchIndex !== -1) {
        batches[batchIndex].qty += requestedQty;
        if (item.rate   !== undefined) batches[batchIndex].rate   = parseFloat(item.rate);
        if (item.mrp    != null)       batches[batchIndex].mrp    = parseFloat(item.mrp);
        if (item.expiry !== undefined) batches[batchIndex].expiry = item.expiry;
      } else {
        batches.push({ batch: item.batch || null, qty: requestedQty, rate: parseFloat(item.rate) || 0, expiry: item.expiry || null, mrp: item.mrp != null ? parseFloat(item.mrp) : null });
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      const effectiveExistingTotal = stockRecord.total ?? (stockRecord.qty * stockRecord.rate);
      const { blendedRate, newTotal } = computeWAC(effectiveExistingTotal, stockRecord.qty, requestedQty, lineValue);

      await Stock.findOneAndUpdate(
        { _id: item.stockId, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, rate: blendedRate, total: newTotal, user: actorUsername } },
        { session }
      );

      const stockRegId = new mongoose.Types.ObjectId();
      stockRegDocs.push({
        _id: stockRegId, firm_id: firmId, type: 'PURCHASE',
        bno: existingBill.bno, bdate: meta.billDate, supply: partyDoc.firm,
        item: item.item, item_narration: item.narration || null,
        batch: item.batch || null, hsn: item.hsn, qty: item.qty, uom: item.uom,
        rate: item.rate, grate: item.grate, disc: item.disc || 0,
        total: lineValue, cost_rate: parseFloat(item.rate),
        stock_id: item.stockId, bill_id: billId, user: actorUsername, qtyh: newTotalQty,
      });
      purchasedItems.push({ stockId: item.stockId, stockRegId, item: item.item, lineValue });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    await Ledger.deleteMany({ voucher_id: existingBill.voucher_id, voucher_type: 'PURCHASE', firm_id: firmId }, { session });
    await postPurchaseLedger({
      firmId, billId, voucherId: existingBill.voucher_id, billNo: existingBill.bno,
      billDate: meta.billDate, party: partyDoc, ntot, cgst, sgst, igst, rof,
      otherCharges, purchasedItems, actorUsername, session,
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
   BILL FILE UPLOAD (PURCHASE) — CLOUD-ONLY FOR VERCEL
════════════════════════════════════════════════════════════════════════════ */

/**
 * Upload a buffer to Backblaze B2.
 */
async function uploadToBackblazeB2(buffer, fileName, contentType) {
    const keyId    = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
    const appKey   = String(process.env.B2_APPLICATION_KEY    || '').trim();
    const bucketId = String(process.env.B2_BUCKET_ID          || '').trim();
    const prefix   = String(process.env.B2_BUCKET_PREFIX      || '').trim().replace(/^\/+|\/+$/g, '');

    if (!keyId || !appKey || !bucketId) return null;

    const authResp = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}` },
    });
    const auth = authResp.data;

    const urlResp = await axios.post(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, { bucketId }, {
        headers: { Authorization: auth.authorizationToken },
    });
    const uploadInfo = urlResp.data;

    const targetName = prefix ? `${prefix}/${fileName}` : fileName;
    const sha1       = createHash('sha1').update(buffer).digest('hex');

    const uploadResp = await axios.post(uploadInfo.uploadUrl, buffer, {
        headers: {
            Authorization:       uploadInfo.authorizationToken,
            'X-Bz-File-Name':    encodeURIComponent(targetName),
            'Content-Type':      contentType || 'application/octet-stream',
            'Content-Length':    buffer.length,
            'X-Bz-Content-Sha1': sha1,
        },
        maxBodyLength: Infinity,
    });

    return `${auth.downloadUrl}/file/${uploadResp.data.bucketName}/${encodeURIComponent(targetName)}`;
}

/**
 * Upload a buffer to Vercel Blob storage.
 */
async function uploadToVercelBlob(buffer, fileName, contentType) {
    const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    if (!token) return null;

    const blob = await blobPut(fileName, buffer, {
        access:      'public',
        contentType: contentType || 'application/octet-stream',
        token,
    });

    return blob.url;
}

export const uploadBillFile = async (req, res) => {
    try {
        const actorUsername = getActorUsername(req);
        if (!actorUsername) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const firmId = getFirmId(req, res, 'UPLOAD_BILL_FILE');
        if (!firmId) return;

        const billId = validateObjectId(req.params.id, 'bill ID', res);
        if (!billId) return;

        if (!req.file) return res.status(400).json({ success: false, error: 'No file received' });

        const bill = await Bill.findOne({ _id: billId, firm_id: firmId }).lean();
        if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });
        if (bill.status === 'CANCELLED') {
            return res.status(400).json({ success: false, error: 'Cannot attach files to cancelled bills' });
        }

        // ── Cloud storage only (Vercel has no persistent fs) ─────────────────
        const userId   = req.user?.id || req.user?._id || 'unknown';
        const safeName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const cloudPath = `uploads/${firmId}/${userId}/${Date.now()}-${safeName}`;

        let fileUrl = null;

        // Try Backblaze B2 first
        try {
            fileUrl = await uploadToBackblazeB2(req.file.buffer, cloudPath, req.file.mimetype);
        } catch (b2Err) {
            console.warn('[UPLOAD_BILL_FILE] Backblaze upload failed:', b2Err.message);
        }

        // Fallback to Vercel Blob if B2 failed or was not configured
        if (!fileUrl) {
            try {
                fileUrl = await uploadToVercelBlob(req.file.buffer, cloudPath, req.file.mimetype);
            } catch (blobErr) {
                console.error('[UPLOAD_BILL_FILE] Vercel Blob also failed:', blobErr.message);
            }
        }

        if (!fileUrl) {
            return res.status(500).json({
                success: false,
                error: 'Cloud storage upload failed. Verify B2_APPLICATION_KEY_* or BLOB_READ_WRITE_TOKEN are set.',
            });
        }

        // ── Persist on Bill document ────────────────────────────────────────
        await Bill.findOneAndUpdate(
            { _id: billId, firm_id: firmId },
            { $set: { file_url: fileUrl, file_uploaded_by: actorUsername } },
        );

        res.json({ success: true, fileUrl, message: 'File uploaded successfully' });
    } catch (err) {
        console.error('[UPLOAD_BILL_FILE] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};


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
        batches[batchIndex].qty = Math.max(0, batches[batchIndex].qty - item.qty);
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      const costValue   = item.total || (item.qty * (item.cost_rate ?? item.rate));
      const { newRate, newTotal } = reverseWAC(
        stockRecord.total ?? (stockRecord.qty * stockRecord.rate),
        stockRecord.qty, item.qty, costValue
      );
      await Stock.findOneAndUpdate(
        { _id: item.stock_id, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, rate: newRate, total: newTotal, user: actorUsername } },
        { session }
      );
    }

    await Ledger.deleteMany({ voucher_id: bill.voucher_id, voucher_type: 'PURCHASE', firm_id: firmId }, { session });

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