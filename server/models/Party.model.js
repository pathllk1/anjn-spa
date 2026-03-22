import mongoose from 'mongoose';

const { Schema } = mongoose;

const partySchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    firm:       { type: String, required: true },
    gstin:      { type: String, default: 'UNREGISTERED' },
    contact:    { type: String },
    state:      { type: String },
    state_code: { type: String },
    addr:       { type: String },
    pin:        { type: String },
    pan:        { type: String },
    usern:      { type: String },
    supply:     { type: String },
  },
  { timestamps: true }
);

// FIX: Without this index, two parties with the same name inside the same firm
// are allowed, which causes merged ledger balances and corrupted account reports.
// The unique constraint enforces one canonical party name per firm.
//
// ⚠️  MIGRATION NOTE: If the DB already contains duplicate (firm_id, firm) pairs,
// run a deduplication script before creating this index, otherwise the index
// creation will fail with a duplicate-key error:
//
//   db.parties.aggregate([
//     { $group: { _id: { firm_id: '$firm_id', firm: '$firm' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
//     { $match: { count: { $gt: 1 } } }
//   ])
partySchema.index({ firm_id: 1, firm: 1 }, { unique: true });

const Party = mongoose.model('Party', partySchema);

export default Party;