import mongoose from 'mongoose'

export const connectDatabase = async (uri) => mongoose.connect(uri)

export const disconnectDatabase = async () => mongoose.disconnect()
