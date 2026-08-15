import { Router } from 'express'
import {
  createLoan,
  listLoans,
  returnLoan,
} from '../controllers/loan.controller.js'
import { protectedRoute } from '../middleware/protected-route.js'

export const loanRouter = Router()

loanRouter.use(protectedRoute)

loanRouter.get('/', listLoans)
loanRouter.post('/', createLoan)
loanRouter.put('/:id/return', returnLoan)
