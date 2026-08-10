import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/user.model.js'

const createAuthenticationError = () =>
  Object.assign(new Error('Autentikasi diperlukan atau token tidak valid'), {
    code: 'UNAUTHENTICATED',
    status: 401,
  })

export const protectedRoute = async (request, _response, next) => {
  const authorization = request.get('authorization')
  const match = authorization?.match(/^Bearer (.+)$/)

  if (!match) {
    return next(createAuthenticationError())
  }

  try {
    const payload = jwt.verify(match[1], env.JWT_SECRET)

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw createAuthenticationError()
    }

    const user = await User.findById(payload.sub)

    if (!user) {
      throw createAuthenticationError()
    }

    request.user = user
    return next()
  } catch (error) {
    return next(error.status === 401 ? error : createAuthenticationError())
  }
}
