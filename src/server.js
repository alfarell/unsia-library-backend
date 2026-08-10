import { createApp } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

const startServer = async () => {
  await connectDatabase(env.MONGODB_URI)

  const app = createApp({ corsOrigin: env.CORS_ORIGIN })
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Server started')
  })

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Server stopping')
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

startServer().catch((error) => {
  logger.fatal(error, 'Server failed to start')
  process.exit(1)
})
