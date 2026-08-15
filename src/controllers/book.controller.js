import mongoose from 'mongoose'
import { z } from 'zod'
import { Book } from '../models/book.model.js'
import { createHttpError } from '../utils/http-error.js'

const createBookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(100),
  isbn: z.string().trim().max(20).optional(),
  publisher: z.string().trim().max(100).optional(),
  publicationYear: z.number().int().optional(),
  category: z.string().trim().max(50).optional(),
  totalCopies: z.number().int().min(0).default(1),
})

const updateBookSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    author: z.string().trim().min(1).max(100).optional(),
    isbn: z.string().trim().max(20).optional(),
    publisher: z.string().trim().max(100).optional(),
    publicationYear: z.number().int().optional(),
    category: z.string().trim().max(50).optional(),
    totalCopies: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diisi',
  })

const toPublicBook = (book) => ({
  activeLoans: book.activeLoans,
  author: book.author,
  category: book.category,
  createdAt: book.createdAt,
  createdBy: book.createdBy
    ? { id: book.createdBy.id, name: book.createdBy.name }
    : null,
  id: book.id,
  isbn: book.isbn,
  publicationYear: book.publicationYear,
  publisher: book.publisher,
  title: book.title,
  totalCopies: book.totalCopies,
  updatedAt: book.updatedAt,
  updatedBy: book.updatedBy
    ? { id: book.updatedBy.id, name: book.updatedBy.name }
    : null,
})

const bookNotFoundError = () =>
  createHttpError(404, 'BOOK_NOT_FOUND', 'Buku tidak ditemukan')

const isbnAlreadyExistsError = () =>
  createHttpError(400, 'ISBN_ALREADY_EXISTS', 'ISBN sudah terdaftar')

const rethrowDuplicate = (error) => {
  if (error?.code === 11000) {
    throw isbnAlreadyExistsError()
  }

  throw error
}

export const listBooks = async (request, response) => {
  const books = await Book.find()
    .sort({ createdAt: -1 })
    .populate('createdBy updatedBy', 'name')

  return response.status(200).json({
    data: {
      books: books.map(toPublicBook),
    },
  })
}

export const createBook = async (request, response) => {
  const bookData = createBookSchema.parse(request.body)

  try {
    const book = await Book.create({
      ...bookData,
      createdBy: request.user.id,
      updatedBy: request.user.id,
    })

    await book.populate('createdBy updatedBy', 'name')

    return response.status(201).json({
      data: {
        book: toPublicBook(book),
      },
    })
  } catch (error) {
    rethrowDuplicate(error)
  }
}

export const updateBook = async (request, response) => {
  const bookData = updateBookSchema.parse(request.body)

  if (!mongoose.isValidObjectId(request.params.id)) {
    throw bookNotFoundError()
  }

  const book = await Book.findById(request.params.id)

  if (!book) {
    throw bookNotFoundError()
  }

  try {
    Object.assign(book, bookData, { updatedBy: request.user.id })
    await book.save()
    await book.populate('createdBy updatedBy', 'name')

    return response.status(200).json({
      data: {
        book: toPublicBook(book),
      },
    })
  } catch (error) {
    rethrowDuplicate(error)
  }
}

export const deleteBook = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw bookNotFoundError()
  }

  const result = await Book.deleteOne({ _id: request.params.id })

  if (result.deletedCount === 0) {
    throw bookNotFoundError()
  }

  return response.status(204).send()
}
