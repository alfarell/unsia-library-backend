import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { logger } from './config/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFound } from './middleware/not-found.js'
import { apiRouter } from './routes/index.js'

export const createApp = ({ corsOrigin = 'http://localhost:5173' } = {}) => {
  const app = express()

  app.use(pinoHttp({ logger }))
  app.use(helmet())
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '1mb' }))
  app.use('/api/v1', apiRouter)
  app.use(notFound)
  app.use(errorHandler)

  return app
}
