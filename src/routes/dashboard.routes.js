import { Router } from 'express'
import { protectedRoute } from '../middleware/protected-route.js'
import { getDashboardSummary } from '../controllers/dashboard.controller.js'

export const dashboardRouter = Router()

dashboardRouter.get('/summary', protectedRoute, getDashboardSummary)
