import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../config/env.js'
import { User } from '../models/user.model.js'
import { createHttpError } from '../utils/http-error.js'

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
      message: 'Password maksimal 72 byte',
    }),
})

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(100),
})

const toPublicUser = (user) => ({
  email: user.email,
  id: user.id,
  name: user.name,
})

const createToken = (user) =>
  jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })

export const register = async (request, response) => {
  const { email, name, password } = registerSchema.parse(request.body)
  const existingUser = await User.findOne({ email })

  if (existingUser) {
    throw createHttpError(
      400,
      'EMAIL_ALREADY_REGISTERED',
      'Email sudah terdaftar',
    )
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ email, name, passwordHash })

    return response.status(201).json({
      data: {
        token: createToken(user),
        user: toPublicUser(user),
      },
    })
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError(
        400,
        'EMAIL_ALREADY_REGISTERED',
        'Email sudah terdaftar',
      )
    }

    throw error
  }
}

export const login = async (request, response) => {
  const { email, password } = credentialsSchema.parse(request.body)
  const user = await User.findOne({ email }).select('+passwordHash')

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw createHttpError(
      401,
      'INVALID_CREDENTIALS',
      'Email atau password tidak valid',
    )
  }

  return response.status(200).json({
    data: {
      token: createToken(user),
      user: toPublicUser(user),
    },
  })
}

export const me = (request, response) =>
  response.status(200).json({ data: { user: toPublicUser(request.user) } })
