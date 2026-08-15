import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userModel = {
  findById: vi.fn(),
}

const bookModel = {
  create: vi.fn(),
  deleteOne: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
}

vi.mock('../src/models/user.model.js', () => ({ User: userModel }))
vi.mock('../src/models/book.model.js', () => ({ Book: bookModel }))

const { createApp } = await import('../src/app.js')

const app = createApp()
const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Reader',
}
const bookId = '507f1f77bcf86cd799439012'
const token = jwt.sign(
  { sub: user.id },
  process.env.JWT_SECRET ??
    'unsia-library-test-jwt-secret-minimum-32-characters',
)

describe('book endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userModel.findById.mockResolvedValue(user)
  })

  it('rejects all book endpoints without a Bearer token', async () => {
    const requests = [
      request(app).get('/api/books'),
      request(app)
        .post('/api/books')
        .send({ author: 'Jane Doe', title: 'A Book' }),
      request(app).put(`/api/books/${bookId}`).send({ title: 'A Book' }),
      request(app).delete(`/api/books/${bookId}`),
    ]

    for (const req of requests) {
      const response = await req

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    }
  })

  it('lists books with populated audit fields', async () => {
    const book = {
      activeLoans: 0,
      author: 'Jane Doe',
      category: 'Fiction',
      createdAt: '2026-08-15T10:00:00.000Z',
      createdBy: { id: user.id, name: user.name },
      id: bookId,
      isbn: '978-3-16-148410-0',
      publicationYear: 2024,
      publisher: 'Publisher X',
      title: 'A Book',
      totalCopies: 3,
      updatedAt: '2026-08-15T10:00:00.000Z',
      updatedBy: { id: user.id, name: user.name },
    }

    bookModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue([book]),
      }),
    })

    const response = await request(app)
      .get('/api/books')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(bookModel.find).toHaveBeenCalledTimes(1)
    expect(response.body.data.books).toEqual([book])
  })

  it('creates a book with audit fields and default totalCopies', async () => {
    const book = {
      activeLoans: 0,
      author: 'Jane Doe',
      category: undefined,
      createdAt: '2026-08-15T10:00:00.000Z',
      createdBy: { id: user.id, name: user.name },
      id: bookId,
      isbn: undefined,
      publicationYear: undefined,
      publisher: undefined,
      title: 'A Book',
      totalCopies: 1,
      updatedAt: '2026-08-15T10:00:00.000Z',
      updatedBy: { id: user.id, name: user.name },
    }

    bookModel.create.mockResolvedValue({
      ...book,
      populate: vi.fn().mockResolvedValue(book),
    })

    const response = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ author: 'Jane Doe', title: 'A Book' })

    expect(response.status).toBe(201)
    expect(bookModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        author: 'Jane Doe',
        createdBy: user.id,
        title: 'A Book',
        totalCopies: 1,
        updatedBy: user.id,
      }),
    )
    expect(response.body.data.book).toEqual(book)
  })

  it('rejects creating a book without title or author', async () => {
    const response = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({ isbn: '978-3-16-148410-0' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a duplicate isbn', async () => {
    bookModel.create.mockRejectedValue(
      Object.assign(new Error('duplicate key'), { code: 11000 }),
    )

    const response = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send({
        author: 'Jane Doe',
        isbn: '978-3-16-148410-0',
        title: 'A Book',
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('ISBN_ALREADY_EXISTS')
  })

  it('updates only the sent fields and sets updatedBy', async () => {
    const book = {
      activeLoans: 0,
      author: 'Jane Doe',
      category: undefined,
      createdAt: '2026-08-15T10:00:00.000Z',
      createdBy: { id: user.id, name: user.name },
      id: bookId,
      isbn: undefined,
      publicationYear: undefined,
      publisher: undefined,
      title: 'Old Title',
      totalCopies: 1,
      updatedAt: '2026-08-15T10:00:00.000Z',
      updatedBy: { id: user.id, name: user.name },
      populate: vi.fn(),
      save: vi.fn(),
    }
    book.save.mockResolvedValue(book)
    book.populate.mockImplementation(async () => {
      book.createdBy = { id: user.id, name: user.name }
      book.updatedBy = { id: user.id, name: user.name }
      return book
    })
    bookModel.findById.mockResolvedValue(book)

    const response = await request(app)
      .put(`/api/books/${bookId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title' })

    expect(response.status).toBe(200)
    expect(bookModel.findById).toHaveBeenCalledWith(bookId)
    expect(book.save).toHaveBeenCalledTimes(1)
    expect(book.title).toBe('New Title')
    expect(book.author).toBe('Jane Doe')
    expect(book.totalCopies).toBe(1)
    expect(response.body.data.book).toEqual({
      activeLoans: 0,
      author: 'Jane Doe',
      category: undefined,
      createdAt: '2026-08-15T10:00:00.000Z',
      createdBy: { id: user.id, name: user.name },
      id: bookId,
      isbn: undefined,
      publicationYear: undefined,
      publisher: undefined,
      title: 'New Title',
      totalCopies: 1,
      updatedAt: '2026-08-15T10:00:00.000Z',
      updatedBy: { id: user.id, name: user.name },
    })
  })

  it('rejects updating a book with an empty body', async () => {
    const response = await request(app)
      .put(`/api/books/${bookId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for invalid or missing book ids', async () => {
    const invalidUpdate = await request(app)
      .put('/api/books/not-an-object-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title' })

    expect(invalidUpdate.status).toBe(404)
    expect(invalidUpdate.body.error.code).toBe('BOOK_NOT_FOUND')

    bookModel.findById.mockResolvedValue(null)

    const missingUpdate = await request(app)
      .put(`/api/books/${bookId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title' })

    expect(missingUpdate.status).toBe(404)
    expect(missingUpdate.body.error.code).toBe('BOOK_NOT_FOUND')

    const invalidDelete = await request(app)
      .delete('/api/books/not-an-object-id')
      .set('Authorization', `Bearer ${token}`)

    expect(invalidDelete.status).toBe(404)
    expect(invalidDelete.body.error.code).toBe('BOOK_NOT_FOUND')

    bookModel.deleteOne.mockResolvedValue({ deletedCount: 0 })

    const missingDelete = await request(app)
      .delete(`/api/books/${bookId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(missingDelete.status).toBe(404)
    expect(missingDelete.body.error.code).toBe('BOOK_NOT_FOUND')
  })

  it('deletes a book and returns 204', async () => {
    bookModel.deleteOne.mockResolvedValue({ deletedCount: 1 })

    const response = await request(app)
      .delete(`/api/books/${bookId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(204)
    expect(bookModel.deleteOne).toHaveBeenCalledWith({ _id: bookId })
  })
})
