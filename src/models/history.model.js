import mongoose from 'mongoose'

const historySchema = new mongoose.Schema(
  {
    module: {
      enum: ['book', 'member', 'loan'],
      required: true,
      type: String,
    },
    action: {
      enum: ['create', 'update', 'delete', 'return'],
      required: true,
      type: String,
    },
    description_id: {
      required: true,
      type: String,
    },
    description_en: {
      required: true,
      type: String,
    },
    user: {
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    createdAt: {
      default: Date.now,
      type: Date,
    },
  },
  { timestamps: false },
)

historySchema.index({ createdAt: -1 })

export const History = mongoose.model('History', historySchema)
