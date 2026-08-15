import { Router } from 'express'
import {
  createMember,
  deleteMember,
  listMembers,
  updateMember,
} from '../controllers/member.controller.js'
import { protectedRoute } from '../middleware/protected-route.js'

export const memberRouter = Router()

memberRouter.use(protectedRoute)

memberRouter.get('/', listMembers)
memberRouter.post('/', createMember)
memberRouter.put('/:id', updateMember)
memberRouter.delete('/:id', deleteMember)
