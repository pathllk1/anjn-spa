import mongoose from 'mongoose';

const { Schema } = mongoose;

const chartOfAccountsSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    account_name: {
      type: String,
      required: true,
      trim: true,
    },
    account_code: {
      type: String,
      trim: true,
      default: null,
    },
    account_type: {
      type: String,
      enum: [
        'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
        'ASSET', 'LIABILITY', 'CASH', 'BANK',
        'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
        'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
        'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN',
        'PAYABLE'
      ],
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
    is_system: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    opening_balance: {
      type: Number,
      default: 0,
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

// Unique constraint: account_name per firm
chartOfAccountsSchema.index(
  { firm_id: 1, account_name: 1 },
  { unique: true }
);

const ChartOfAccounts = mongoose.model('ChartOfAccounts', chartOfAccountsSchema);

export default ChartOfAccounts;
