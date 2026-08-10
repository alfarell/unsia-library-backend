import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
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
    passwordHash: {
      required: true,
      select: false,
      type: String,
    },
  },
  { timestamps: true },
)

export const User = mongoose.model('User', userSchema)
