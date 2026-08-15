import mongoose from 'mongoose'

const bookSchema = new mongoose.Schema(
  {
    activeLoans: {
      default: 0,
      min: 0,
      type: Number,
    },
    title: {
      maxlength: 200,
      minlength: 1,
      required: true,
      trim: true,
      type: String,
    },
    author: {
      maxlength: 100,
      minlength: 1,
      required: true,
      trim: true,
      type: String,
    },
    isbn: {
      maxlength: 20,
      sparse: true,
      trim: true,
      type: String,
      unique: true,
    },
    publisher: {
      maxlength: 100,
      trim: true,
      type: String,
    },
    publicationYear: {
      type: Number,
    },
    category: {
      maxlength: 50,
      trim: true,
      type: String,
    },
    totalCopies: {
      default: 1,
      min: 0,
      type: Number,
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

export const Book = mongoose.model('Book', bookSchema)
