import mongoose from 'mongoose'
import { z } from 'zod'
import { Member } from '../models/member.model.js'
import { createHttpError } from '../utils/http-error.js'

const createMemberSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().min(1),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(200).optional(),
})

const updateMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().toLowerCase().min(1).optional(),
    phone: z.string().trim().max(20).optional(),
    address: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diisi',
  })

const toPublicMember = (member) => ({
  address: member.address,
  createdAt: member.createdAt,
  createdBy: member.createdBy
    ? { id: member.createdBy.id, name: member.createdBy.name }
    : null,
  email: member.email,
  id: member.id,
  membershipCode: member.membershipCode,
  name: member.name,
  phone: member.phone,
  updatedAt: member.updatedAt,
  updatedBy: member.updatedBy
    ? { id: member.updatedBy.id, name: member.updatedBy.name }
    : null,
})

const memberNotFoundError = () =>
  createHttpError(404, 'MEMBER_NOT_FOUND', 'Anggota tidak ditemukan')

const emailAlreadyExistsError = () =>
  createHttpError(400, 'EMAIL_ALREADY_EXISTS', 'Email sudah terdaftar')

const isMembershipCodeDuplicate = (error) =>
  error?.code === 11000 && error?.keyPattern?.membershipCode

const rethrowDuplicate = (error) => {
  if (error?.code === 11000) {
    throw emailAlreadyExistsError()
  }

  throw error
}

const generateMembershipCode = async (previousCode) => {
  const lastMember = await Member.findOne({
    membershipCode: { $regex: /^UNSIA\d+$/ },
  }).sort({ membershipCode: -1 })
  const lastMatch = lastMember?.membershipCode?.match(/^UNSIA(\d+)$/)
  const lastNumber = lastMatch ? Number(lastMatch[1]) : 0
  const previousMatch = previousCode?.match(/^UNSIA(\d+)$/)
  const previousNumber = previousMatch ? Number(previousMatch[1]) : 0

  return `UNSIA${String(Math.max(lastNumber + 1, previousNumber + 1)).padStart(5, '0')}`
}

export const listMembers = async (request, response) => {
  const members = await Member.find()
    .sort({ createdAt: -1 })
    .populate('createdBy updatedBy', 'name')

  return response.status(200).json({
    data: {
      members: members.map(toPublicMember),
    },
  })
}

export const createMember = async (request, response) => {
  const memberData = createMemberSchema.parse(request.body)
  let previousCode

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const membershipCode = await generateMembershipCode(previousCode)
      previousCode = membershipCode
      const member = await Member.create({
        ...memberData,
        createdBy: request.user.id,
        membershipCode,
        updatedBy: request.user.id,
      })

      await member.populate('createdBy updatedBy', 'name')

      return response.status(201).json({
        data: {
          member: toPublicMember(member),
        },
      })
    } catch (error) {
      if (isMembershipCodeDuplicate(error)) {
        if (attempt < 2) {
          continue
        }

        throw createHttpError(
          500,
          'INTERNAL_SERVER_ERROR',
          'Terjadi kesalahan pada server',
        )
      }

      rethrowDuplicate(error)
    }
  }
}

export const updateMember = async (request, response) => {
  const memberData = updateMemberSchema.parse(request.body)

  if (!mongoose.isValidObjectId(request.params.id)) {
    throw memberNotFoundError()
  }

  const member = await Member.findById(request.params.id)

  if (!member) {
    throw memberNotFoundError()
  }

  try {
    Object.assign(member, memberData, { updatedBy: request.user.id })
    await member.save()
    await member.populate('createdBy updatedBy', 'name')

    return response.status(200).json({
      data: {
        member: toPublicMember(member),
      },
    })
  } catch (error) {
    rethrowDuplicate(error)
  }
}

export const deleteMember = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw memberNotFoundError()
  }

  const result = await Member.deleteOne({ _id: request.params.id })

  if (result.deletedCount === 0) {
    throw memberNotFoundError()
  }

  return response.status(204).send()
}
