import mongoose from 'mongoose';

const { Schema } = mongoose;

const billSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    // voucher_id is kept as String for backward compatibility with existing data.
    // New bills store the integer as a string (e.g. "1"). Old bills stored zero-padded
    // strings (e.g. "00000001"). Mongoose's type coercion makes both work for Ledger
    // queries (Number field) because String("00000001") and String("1") both cast to
    // the same integer via Number().
    voucher_id:   { type: String },
    bno:          { type: String, required: true },
    bdate:        { type: String, required: true },
    supply:       { type: String },
    addr:         { type: String },
    gstin:        { type: String },
    state:        { type: String },
    pin:          { type: String },
    state_code:   { type: String },
    gtot:         { type: Number, required: true, default: 0 },
    ntot:         { type: Number, required: true, default: 0 },
    rof:          { type: Number, default: 0 },
    btype:        { type: String, default: 'SALES' },
    bill_subtype: { type: String },
    usern:        { type: String },
    firm:         { type: String },
    party_id: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
    },
    oth_chg_json:         { type: String },
    other_charges:        [{ type: Schema.Types.Mixed }],
    supplier_bill_no:     { type: String },
    order_no:             { type: String },
    vehicle_no:           { type: String },
    dispatch_through:     { type: String },
    narration:            { type: String },
    reverse_charge:       { type: Boolean, default: false },
    cgst:                 { type: Number, default: 0 },
    sgst:                 { type: Number, default: 0 },
    igst:                 { type: Number, default: 0 },
    status:               { type: String, default: 'ACTIVE' },
    cancellation_reason:  { type: String },
    cancelled_at:         { type: Date, default: null },
    cancelled_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    consignee_name:       { type: String },
    consignee_gstin:      { type: String },
    consignee_address:    { type: String },
    consignee_state:      { type: String },
    consignee_pin:        { type: String },
    consignee_state_code: { type: String },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────
// bno is unique per firm (each firm has its own sequential bill numbers)
billSchema.index({ firm_id: 1, bno: 1 }, { unique: true });
// Common list/filter queries
billSchema.index({ firm_id: 1, btype: 1, createdAt: -1 });
billSchema.index({ firm_id: 1, party_id: 1 });
billSchema.index({ firm_id: 1, status: 1 });
// ensureUniqueSupplierBillNo runs on every purchase create/update
billSchema.index({ firm_id: 1, party_id: 1, supplier_bill_no: 1, status: 1 });

const Bill = mongoose.model('Bill', billSchema);

export default Bill;