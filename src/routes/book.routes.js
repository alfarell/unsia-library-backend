import { Router } from 'express'
import {
  createBook,
  deleteBook,
  listBooks,
  updateBook,
} from '../controllers/book.controller.js'
import { protectedRoute } from '../middleware/protected-route.js'

export const bookRouter = Router()

bookRouter.use(protectedRoute)

bookRouter.get('/', listBooks)
bookRouter.post('/', createBook)
bookRouter.put('/:id', updateBook)
bookRouter.delete('/:id', deleteBook)
