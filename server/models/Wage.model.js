import mongoose from 'mongoose';

const { Schema } = mongoose;

const wageSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    master_roll_id: {
      type: Schema.Types.ObjectId,
      ref: 'MasterRoll',
      required: true,
      index: true,
    },
    p_day_wage:       { type: Number },
    wage_days:        { type: Number, default: 26 },
    project:          { type: String },
    site:             { type: String },
    gross_salary:     { type: Number, required: true },
    epf_deduction:    { type: Number, default: 0 },
    esic_deduction:   { type: Number, default: 0 },
    other_deduction:  { type: Number, default: 0 },
    other_benefit:    { type: Number, default: 0 },
    advance_deduction: { type: Number, default: 0 },
    net_salary:       { type: Number, required: true },
    remarks:          { type: String },
    salary_month:     { type: String, required: true },
    paid_date:        { type: String },
    cheque_no:        { type: String },
    
    // NEW FIELDS FOR ACCOUNTING INTEGRATION
    bank_account_id: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
      index: true,
    },
    payment_mode: {
      type: String,
      enum: ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'IMPS', 'UPI'],
      default: null,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'POSTED', 'LOCKED'],
      default: 'DRAFT',
      index: true,
    },
    voucher_group_id: {
      type: String,
      default: null,
      index: true,
    },
    posted_date: {
      type: Date,
      default: null,
    },
    posted_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for performance
wageSchema.index({ firm_id: 1, salary_month: 1 });
wageSchema.index({ firm_id: 1, master_roll_id: 1, salary_month: 1 }, { unique: true });
wageSchema.index({ firm_id: 1, status: 1 });
wageSchema.index({ firm_id: 1, voucher_group_id: 1 });

const Wage = mongoose.model('Wage', wageSchema);

export default Wage;
