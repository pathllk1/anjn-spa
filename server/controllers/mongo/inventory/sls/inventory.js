

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
  getOtherChargesTypes, getCurrentUserFirmName, lookupGST,
} from '../sharedStockHandlers.js';

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
    const balance = debit - credit; // positive = still receivable from customer
    const balanceType = balance > 0 ? 'Debit' : balance < 0 ? 'Credit' : 'Nil';
    res.json({ success: true, data: { partyId, balance, balance_type: balanceType, outstanding: Math.abs(balance), debit, credit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE BILL (SALES)
═══════════════════════════════════════════════════════════════════════════ */

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

  // BUG FIX — was Party.findById(party) with no firm_id scope.
  // A party ObjectId from a different firm would be accepted, writing that
  // firm's party name, GSTIN, state, address etc. into this firm's bill and
  // ledger. Fix: scope the lookup to this firm so any cross-firm ID → 404.
  const partyDoc = await Party.findOne({ _id: partyIdRaw, firm_id: firmId }).lean();
  if (!partyDoc) {
    return res.status(404).json({ error: 'Party not found' });
  }

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
    const voucherId = await getNextVoucherNumber(firmId); // Number

    const gstEnabled = await isGstEnabled(firmId);
    // Sales uses getEffectiveItemQty for service items
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

    // B. Process cart — deduct stock, collect StockReg docs + COGS lines
    const stockRegDocs = [];
    const cogsLines    = [];

    for (const item of cart) {
      const serviceItem  = isServiceItem(item);
      const effectiveQty = getEffectiveItemQty(item);
      const lineTotal    = effectiveQty * item.rate * (1 - (item.disc || 0) / 100);

      if (serviceItem) {
        // Service item — no stock movement, no COGS
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
          cost_rate: null, // service items have no cost
          stock_id: null, bill_id: billId, user: actorUsername, qtyh: 0,
        });
        continue;
      }

      // Goods item — deduct stock
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

      // WAC cost at moment of sale (BEFORE deducting) — used for COGS
      const wacCostRate = stockRecord.rate;
      const cogsValue   = effectiveQty * wacCostRate;

      // Deduct. Negative stock intentionally allowed (back-dated entries).
      batches[batchIndex].qty -= effectiveQty;
      const newTotalQty = batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);

      // On sale: rate (WAC) does NOT change. Total reduces proportionally.
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
        // Store WAC at time of sale for accurate credit-note COGS reversal
        cost_rate: wacCostRate,
        stock_id: item.stockId, bill_id: billId, user: actorUsername, qtyh: newTotalQty,
      });

      // COGS line for ledger posting
      cogsLines.push({
        stockId:    item.stockId,
        stockRegId, // pre-assigned _id
        item:       normalizeOptionalText(item.item, 200),
        cogsValue,
      });
    }

    await StockReg.insertMany(stockRegDocs, { session });

    // C. Compute taxableItemsTotal for Sales A/c CR
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

/* ═══════════════════════════════════════════════════════════════════════════
   UPDATE BILL (SALES)
═══════════════════════════════════════════════════════════════════════════ */

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
      if (!ei.stock_id) continue; // service item
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
        // Batch was removed since original sale — recreate it
        batches.push({ batch: ei.batch || null, qty: ei.qty, rate: ei.rate, expiry: null, mrp: null });
      }

      const newTotalQty = batches.reduce((s, b) => s + b.qty, 0);
      // Rate stays the same on stock restore from sale
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

    // Step 3: Update bill header
    await Bill.findOneAndUpdate(
      { _id: billId, firm_id: firmId },
      { $set: {
          bdate: meta.billDate, supply: partyDoc.firm || '', firm: firmName,
          addr: partyDoc.addr || '', gstin: partyDoc.gstin || 'UNREGISTERED',
          state: partyDoc.state || '', pin: partyDoc.pin || null, state_code: partyDoc.state_code || null,
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

    // Step 6: Delete old sales ledger (COGS included — same voucher_id) and re-post
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

/* ═══════════════════════════════════════════════════════════════════════════
   CANCEL BILL (SALES)
═══════════════════════════════════════════════════════════════════════════ */

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

    // Restore stock — add back the sold qty
    const items = await StockReg.find({ bill_id: billId, firm_id: firmId }).lean();
    for (const item of items) {
      if (!item.stock_id) continue; // service items have no stock
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
      // Rate unchanged on stock restore
      await Stock.findOneAndUpdate(
        { _id: item.stock_id, firm_id: firmId },
        { $set: { qty: newTotalQty, batches, total: newTotalQty * stockRecord.rate, user: actorUsername } },
        { session }
      );
    }

    // Delete all ledger entries for this bill — COGS and revenue are both under voucher_id + SALES
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