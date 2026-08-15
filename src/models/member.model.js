import mongoose from 'mongoose'

const memberSchema = new mongoose.Schema(
  {
    name: {
      maxlength: 100,
      minlength: 1,
      required: true,
      trim: true,
      type: String,
    },
    email: {
      lowercase: true,
      required: true,
      trim: true,
      type: String,
      unique: true,
    },
    phone: {
      maxlength: 20,
      trim: true,
      type: String,
    },
    address: {
      maxlength: 200,
      trim: true,
      type: String,
    },
    membershipCode: {
      maxlength: 50,
      required: true,
      trim: true,
      type: String,
      unique: true,
      uppercase: true,
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

export const Member = mongoose.model('Member', memberSchema)
