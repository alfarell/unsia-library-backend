import { Router } from 'express'
import { login, me, register } from '../controllers/auth.controller.js'
import { protectedRoute } from '../middleware/protected-route.js'

export const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.get('/me', protectedRoute, me)
