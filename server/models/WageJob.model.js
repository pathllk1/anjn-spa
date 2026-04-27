import mongoose from 'mongoose';

const { Schema } = mongoose;

const wageJobSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    salary_month: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    total_wages: {
      type: Number,
      default: 0,
    },
    processed_wages: {
      type: Number,
      default: 0,
    },
    failed_wages: {
      type: Number,
      default: 0,
    },
    progress_percentage: {
      type: Number,
      default: 0,
    },
    wages_data: {
      type: Array,
      default: [],
    },
    results: {
      type: Array,
      default: [],
    },
    error_message: {
      type: String,
      default: null,
    },
    started_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
    duration_ms: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for finding jobs by firm and status
wageJobSchema.index({ firm_id: 1, status: 1 });
wageJobSchema.index({ firm_id: 1, createdAt: -1 });

const WageJob = mongoose.model('WageJob', wageJobSchema);

export default WageJob;
