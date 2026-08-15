import mongoose from 'mongoose'

const loanSchema = new mongoose.Schema(
  {
    member: {
      ref: 'Member',
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    books: {
      ref: 'Book',
      required: true,
      type: [
        {
          ref: 'Book',
          type: mongoose.Schema.Types.ObjectId,
        },
      ],
      validate: {
        message: 'Minimal satu buku dalam satu peminjaman',
        validator: (books) => books.length >= 1,
      },
    },
    status: {
      default: 'borrowed',
      enum: ['borrowed', 'returned'],
      required: true,
      type: String,
    },
    createdBy: {
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    updatedBy: {
      ref: 'User',
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true },
)

export const Loan = mongoose.model('Loan', loanSchema)
