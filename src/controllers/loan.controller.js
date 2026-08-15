import mongoose from 'mongoose'
import { z } from 'zod'
import { Book } from '../models/book.model.js'
import { Loan } from '../models/loan.model.js'
import { Member } from '../models/member.model.js'
import { createHttpError } from '../utils/http-error.js'

const objectIdSchema = z
  .string()
  .refine((value) => mongoose.isValidObjectId(value), {
    message: 'Format ObjectId tidak valid',
  })

const createLoanSchema = z.object({
  memberId: objectIdSchema,
  bookIds: z
    .array(objectIdSchema)
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'bookIds tidak boleh duplikat',
    }),
})

const toPublicLoan = (loan) => ({
  books: loan.books.map((book) =>
    book
      ? {
          activeLoans: book.activeLoans,
          author: book.author,
          id: book.id,
          isbn: book.isbn,
          title: book.title,
          totalCopies: book.totalCopies,
        }
      : null,
  ),
  createdAt: loan.createdAt,
  createdBy: loan.createdBy
    ? { id: loan.createdBy.id, name: loan.createdBy.name }
    : null,
  id: loan.id,
  member: loan.member
    ? {
        id: loan.member.id,
        membershipCode: loan.member.membershipCode,
        name: loan.member.name,
      }
    : null,
  status: loan.status,
  updatedAt: loan.updatedAt,
  updatedBy: loan.updatedBy
    ? { id: loan.updatedBy.id, name: loan.updatedBy.name }
    : null,
})

const memberNotFoundError = () =>
  createHttpError(404, 'MEMBER_NOT_FOUND', 'Anggota tidak ditemukan')

const bookNotFoundError = () =>
  createHttpError(404, 'BOOK_NOT_FOUND', 'Buku tidak ditemukan')

const loanNotFoundError = () =>
  createHttpError(404, 'LOAN_NOT_FOUND', 'Peminjaman tidak ditemukan')

const outOfStockError = () =>
  createHttpError(400, 'BOOK_OUT_OF_STOCK', 'Stok buku tidak mencukupi')

const alreadyReturnedError = () =>
  createHttpError(400, 'LOAN_ALREADY_RETURNED', 'Peminjaman sudah dikembalikan')

const internalServerError = () =>
  createHttpError(500, 'INTERNAL_SERVER_ERROR', 'Terjadi kesalahan pada server')

const populateLoan = async (loan) => {
  await loan.populate('member', 'name membershipCode')
  await loan.populate('books')
  await loan.populate('createdBy updatedBy', 'name')
}

export const listLoans = async (request, response) => {
  const loans = await Loan.find()
    .sort({ createdAt: -1 })
    .populate('member', 'name membershipCode')
    .populate('books')
    .populate('createdBy updatedBy', 'name')

  return response.status(200).json({
    data: {
      loans: loans.map(toPublicLoan),
    },
  })
}

export const createLoan = async (request, response) => {
  const { memberId, bookIds } = createLoanSchema.parse(request.body)

  const member = await Member.findById(memberId)

  if (!member) {
    throw memberNotFoundError()
  }

  const books = []

  for (const bookId of bookIds) {
    const book = await Book.findById(bookId)

    if (!book) {
      throw bookNotFoundError()
    }

    books.push(book)
  }

  const incrementedBookIds = []

  for (const book of books) {
    const updatedBook = await Book.findOneAndUpdate(
      { _id: book.id, activeLoans: { $lt: book.totalCopies } },
      { $inc: { activeLoans: 1 } },
    )

    if (!updatedBook) {
      for (const incrementedBookId of incrementedBookIds) {
        await Book.updateOne(
          { _id: incrementedBookId },
          { $inc: { activeLoans: -1 } },
        )
      }

      throw outOfStockError()
    }

    incrementedBookIds.push(book.id)
  }

  const loan = await Loan.create({
    member: memberId,
    books: bookIds,
    status: 'borrowed',
    createdBy: request.user.id,
    updatedBy: request.user.id,
  })

  await populateLoan(loan)

  return response.status(201).json({
    data: {
      loan: toPublicLoan(loan),
    },
  })
}

export const returnLoan = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw loanNotFoundError()
  }

  const loan = await Loan.findOneAndUpdate(
    { _id: request.params.id, status: 'borrowed' },
    { $set: { status: 'returned', updatedBy: request.user.id } },
    { new: true },
  )

  if (!loan) {
    const existingLoan = await Loan.findById(request.params.id)

    if (existingLoan) {
      throw alreadyReturnedError()
    }

    throw loanNotFoundError()
  }

  for (const bookId of loan.books) {
    const result = await Book.updateOne(
      { _id: bookId, activeLoans: { $gt: 0 } },
      { $inc: { activeLoans: -1 } },
    )

    if (result.modifiedCount === 0) {
      throw internalServerError()
    }
  }

  await populateLoan(loan)

  return response.status(200).json({
    data: {
      loan: toPublicLoan(loan),
    },
  })
}
