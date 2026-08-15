import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userModel = {
  findById: vi.fn(),
}

const memberModel = {
  findById: vi.fn(),
}

const bookModel = {
  findById: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
}

const loanModel = {
  create: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
  findOneAndUpdate: vi.fn(),
}

vi.mock('../src/models/user.model.js', () => ({ User: userModel }))
vi.mock('../src/models/member.model.js', () => ({ Member: memberModel }))
vi.mock('../src/models/book.model.js', () => ({ Book: bookModel }))
vi.mock('../src/models/loan.model.js', () => ({ Loan: loanModel }))

const { createApp } = await import('../src/app.js')

const app = createApp()
const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Reader',
}
const memberId = '507f1f77bcf86cd799439013'
const bookId = '507f1f77bcf86cd799439012'
const bookId2 = '507f1f77bcf86cd799439014'
const loanId = '507f1f77bcf86cd799439015'
const token = jwt.sign(
  { sub: user.id },
  process.env.JWT_SECRET ??
    'unsia-library-test-jwt-secret-minimum-32-characters',
)

const member = {
  id: memberId,
  membershipCode: 'UNSIA00001',
  name: 'Reader',
}

const book = {
  activeLoans: 1,
  author: 'Jane Doe',
  id: bookId,
  isbn: '978-3-16-148410-0',
  title: 'A Book',
  totalCopies: 3,
}

const book2 = {
  ...book,
  id: bookId2,
  title: 'B Book',
}

const populatedLoan = {
  books: [book],
  borrowedAt: '2026-08-15T10:00:00.000Z',
  createdAt: '2026-08-15T10:00:00.000Z',
  createdBy: { id: user.id, name: user.name },
  durationDays: 7,
  id: loanId,
  member,
  returnedAt: null,
  status: 'borrowed',
  updatedAt: '2026-08-15T10:00:00.000Z',
  updatedBy: { id: user.id, name: user.name },
}

const publicLoan = {
  books: [
    {
      activeLoans: book.activeLoans,
      author: book.author,
      id: book.id,
      isbn: book.isbn,
      title: book.title,
      totalCopies: book.totalCopies,
    },
  ],
  borrowedAt: populatedLoan.borrowedAt,
  createdAt: populatedLoan.createdAt,
  createdBy: { id: user.id, name: user.name },
  durationDays: 7,
  id: loanId,
  member: { id: memberId, membershipCode: 'UNSIA00001', name: 'Reader' },
  returnedAt: null,
  status: 'borrowed',
  updatedAt: populatedLoan.updatedAt,
  updatedBy: { id: user.id, name: user.name },
}

describe('loan endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userModel.findById.mockResolvedValue(user)
  })

  it('rejects all loan endpoints without a Bearer token', async () => {
    const requests = [
      request(app).get('/api/loans'),
      request(app)
        .post('/api/loans')
        .send({ durationDays: 7, memberId, bookIds: [bookId] }),
      request(app).put(`/api/loans/${loanId}/return`),
    ]

    for (const req of requests) {
      const response = await req

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    }
  })

  it('lists loans with populated member, books, and audit fields', async () => {
    loanModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            populate: vi.fn().mockResolvedValue([populatedLoan]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(loanModel.find).toHaveBeenCalledTimes(1)
    expect(response.body.data.loans).toEqual([publicLoan])
  })

  it('creates a loan for one book and increments activeLoans', async () => {
    memberModel.findById.mockResolvedValue(member)
    bookModel.findById.mockResolvedValue(book)
    bookModel.findOneAndUpdate.mockResolvedValue({ id: bookId })
    loanModel.create.mockResolvedValue({
      ...populatedLoan,
      populate: vi.fn().mockResolvedValue(populatedLoan),
    })

    const response = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ durationDays: 7, memberId, bookIds: [bookId] })

    expect(response.status).toBe(201)
    expect(memberModel.findById).toHaveBeenCalledWith(memberId)
    expect(bookModel.findById).toHaveBeenCalledWith(bookId)
    expect(bookModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: bookId, activeLoans: { $lt: book.totalCopies } },
      { $inc: { activeLoans: 1 } },
      { timestamps: false },
    )
    expect(loanModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        books: [bookId],
        createdBy: user.id,
        durationDays: 7,
        member: memberId,
        status: 'borrowed',
        updatedBy: user.id,
      }),
    )
    expect(response.body.data.loan).toEqual(publicLoan)
  })

  it('creates a loan with multiple books and increments each', async () => {
    memberModel.findById.mockResolvedValue(member)
    bookModel.findById.mockResolvedValueOnce(book).mockResolvedValueOnce(book2)
    bookModel.findOneAndUpdate.mockResolvedValue({ id: bookId })
    loanModel.create.mockResolvedValue({
      ...populatedLoan,
      books: [book, book2],
      populate: vi.fn().mockResolvedValue({
        ...populatedLoan,
        books: [book, book2],
      }),
    })

    const response = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ durationDays: 7, memberId, bookIds: [bookId, bookId2] })

    expect(response.status).toBe(201)
    expect(bookModel.findOneAndUpdate).toHaveBeenCalledTimes(2)
    expect(bookModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: bookId, activeLoans: { $lt: book.totalCopies } },
      { $inc: { activeLoans: 1 } },
      { timestamps: false },
    )
    expect(bookModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: bookId2, activeLoans: { $lt: book2.totalCopies } },
      { $inc: { activeLoans: 1 } },
      { timestamps: false },
    )
    expect(response.body.data.loan.books).toEqual([book, book2])
  })

  it('rejects duplicate, empty, or invalid bookIds', async () => {
    const requests = [
      { durationDays: 7, memberId, bookIds: [bookId, bookId] },
      { durationDays: 7, memberId, bookIds: [] },
      { durationDays: 7, memberId, bookIds: ['not-an-object-id'] },
    ]

    for (const payload of requests) {
      const response = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${token}`)
        .send(payload)

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    }

    expect(memberModel.findById).not.toHaveBeenCalled()
  })

  it('rejects missing or invalid durationDays', async () => {
    const requests = [
      { memberId, bookIds: [bookId] },
      { durationDays: 0, memberId, bookIds: [bookId] },
      { durationDays: 1.5, memberId, bookIds: [bookId] },
      { durationDays: 366, memberId, bookIds: [bookId] },
    ]

    for (const payload of requests) {
      const response = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${token}`)
        .send(payload)

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    }

    expect(memberModel.findById).not.toHaveBeenCalled()
  })

  it('returns 404 when the member does not exist', async () => {
    memberModel.findById.mockResolvedValue(null)

    const response = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ durationDays: 7, memberId, bookIds: [bookId] })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('MEMBER_NOT_FOUND')
  })

  it('returns 404 when a book does not exist', async () => {
    memberModel.findById.mockResolvedValue(member)
    bookModel.findById.mockResolvedValue(null)

    const response = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ durationDays: 7, memberId, bookIds: [bookId] })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('BOOK_NOT_FOUND')
    expect(bookModel.findOneAndUpdate).not.toHaveBeenCalled()
  })

  it('rejects when stock is full and compensates incremented books', async () => {
    memberModel.findById.mockResolvedValue(member)
    bookModel.findById
      .mockResolvedValueOnce({ ...book, totalCopies: 1 })
      .mockResolvedValueOnce({ ...book2, totalCopies: 1 })
    bookModel.findOneAndUpdate
      .mockResolvedValueOnce({ id: bookId })
      .mockResolvedValueOnce(null)

    const response = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({ durationDays: 7, memberId, bookIds: [bookId, bookId2] })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('BOOK_OUT_OF_STOCK')
    expect(bookModel.updateOne).toHaveBeenCalledTimes(1)
    expect(bookModel.updateOne).toHaveBeenCalledWith(
      { _id: bookId },
      { $inc: { activeLoans: -1 } },
      { timestamps: false },
    )
    expect(bookModel.updateOne).not.toHaveBeenCalledWith(
      { _id: bookId2 },
      { $inc: { activeLoans: -1 } },
      { timestamps: false },
    )
    expect(loanModel.create).not.toHaveBeenCalled()
  })

  it('returns a loan and decrements activeLoans', async () => {
    const loan = {
      books: [bookId],
      borrowedAt: populatedLoan.borrowedAt,
      createdAt: populatedLoan.createdAt,
      durationDays: 7,
      id: loanId,
      member: memberId,
      returnedAt: new Date('2026-08-15T12:00:00.000Z'),
      status: 'returned',
      updatedAt: populatedLoan.updatedAt,
      updatedBy: user.id,
      populate: vi.fn(),
    }
    loan.populate.mockImplementation(async () => {
      loan.member = member
      loan.books = [book]
      loan.createdBy = { id: user.id, name: user.name }
      loan.updatedBy = { id: user.id, name: user.name }
      return loan
    })
    loanModel.findOneAndUpdate.mockResolvedValue(loan)
    bookModel.updateOne.mockResolvedValue({ modifiedCount: 1 })

    const response = await request(app)
      .put(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(loanModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: loanId, status: 'borrowed' },
      {
        $set: {
          returnedAt: expect.any(Date),
          status: 'returned',
          updatedBy: user.id,
        },
      },
      { new: true },
    )
    expect(bookModel.updateOne).toHaveBeenCalledWith(
      { _id: bookId, activeLoans: { $gt: 0 } },
      { $inc: { activeLoans: -1 } },
      { timestamps: false },
    )
    expect(response.body.data.loan).toEqual({
      ...publicLoan,
      returnedAt: '2026-08-15T12:00:00.000Z',
      status: 'returned',
    })
  })

  it('rejects returning an already returned loan', async () => {
    loanModel.findOneAndUpdate.mockResolvedValue(null)
    loanModel.findById.mockResolvedValue({ status: 'returned' })

    const response = await request(app)
      .put(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('LOAN_ALREADY_RETURNED')
    expect(bookModel.updateOne).not.toHaveBeenCalled()
  })

  it('returns 404 for invalid or missing loan ids', async () => {
    const invalidReturn = await request(app)
      .put('/api/loans/not-an-object-id/return')
      .set('Authorization', `Bearer ${token}`)

    expect(invalidReturn.status).toBe(404)
    expect(invalidReturn.body.error.code).toBe('LOAN_NOT_FOUND')
    expect(loanModel.findOneAndUpdate).not.toHaveBeenCalled()

    loanModel.findOneAndUpdate.mockResolvedValue(null)
    loanModel.findById.mockResolvedValue(null)

    const missingReturn = await request(app)
      .put(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${token}`)

    expect(missingReturn.status).toBe(404)
    expect(missingReturn.body.error.code).toBe('LOAN_NOT_FOUND')
  })

  it('returns 500 when a book decrement modifies nothing', async () => {
    const loan = {
      books: [bookId],
      id: loanId,
      status: 'returned',
      populate: vi.fn(),
    }
    loan.populate.mockResolvedValue(loan)
    loanModel.findOneAndUpdate.mockResolvedValue(loan)
    bookModel.updateOne.mockResolvedValue({ modifiedCount: 0 })

    const response = await request(app)
      .put(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(500)
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(bookModel.updateOne).toHaveBeenCalledWith(
      { _id: bookId, activeLoans: { $gt: 0 } },
      { $inc: { activeLoans: -1 } },
      { timestamps: false },
    )
  })

  it('maps deleted member and books to null in the list output', async () => {
    const loanWithGaps = {
      books: [null],
      createdAt: populatedLoan.createdAt,
      createdBy: null,
      id: loanId,
      member: null,
      status: 'borrowed',
      updatedAt: populatedLoan.updatedAt,
      updatedBy: null,
    }
    loanModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            populate: vi.fn().mockResolvedValue([loanWithGaps]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.loans).toEqual([
      {
        books: [null],
        createdAt: populatedLoan.createdAt,
        createdBy: null,
        id: loanId,
        member: null,
        status: 'borrowed',
        updatedAt: populatedLoan.updatedAt,
        updatedBy: null,
      },
    ])
  })
})
