import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { logger } from './config/logger.js'
import { authRouter } from './routes/auth.routes.js'
import { bookRouter } from './routes/book.routes.js'
import { dashboardRouter } from './routes/dashboard.routes.js'
import { loanRouter } from './routes/loan.routes.js'
import { memberRouter } from './routes/member.routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import { apiRouter } from './routes/index.js'

export const createApp = ({ corsOrigin = 'http://localhost:5173' } = {}) => {
  const app = express()

  app.use(pinoHttp({ logger }))
  app.use(helmet())
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '1mb' }))
  app.use('/api/auth', authRouter)
  app.use('/api/books', bookRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/loans', loanRouter)
  app.use('/api/members', memberRouter)
  app.use('/api/v1', apiRouter)
  app.use(notFound)
  app.use(errorHandler)

  return app
}
