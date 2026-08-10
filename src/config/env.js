import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://127.0.0.1:27017/unsia_library'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),
})

const parsedEnv = envSchema.parse(process.env)

if (parsedEnv.NODE_ENV !== 'test' && !parsedEnv.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diatur di environment selain test')
}

export const env = {
  ...parsedEnv,
  JWT_SECRET:
    parsedEnv.JWT_SECRET ??
    'unsia-library-test-jwt-secret-minimum-32-characters',
}
