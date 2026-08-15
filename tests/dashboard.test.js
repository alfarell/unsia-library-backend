import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userModel = {
  findById: vi.fn(),
}

const bookModel = {
  aggregate: vi.fn(),
  find: vi.fn(),
}

const memberModel = {
  countDocuments: vi.fn(),
}

const loanModel = {
  find: vi.fn(),
}

const historyModel = {
  find: vi.fn(),
}

vi.mock('../src/models/user.model.js', () => ({ User: userModel }))
vi.mock('../src/models/book.model.js', () => ({ Book: bookModel }))
vi.mock('../src/models/member.model.js', () => ({ Member: memberModel }))
vi.mock('../src/models/loan.model.js', () => ({ Loan: loanModel }))
vi.mock('../src/models/history.model.js', () => ({ History: historyModel }))

const { createApp } = await import('../src/app.js')

const app = createApp()
const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Admin User',
}
const token = jwt.sign(
  { sub: user.id },
  process.env.JWT_SECRET ??
    'unsia-library-test-jwt-secret-minimum-32-characters',
)

describe('dashboard endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userModel.findById.mockResolvedValue(user)
  })

  it('rejects dashboard summary without a Bearer token', async () => {
    const response = await request(app).get('/api/dashboard/summary')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns dashboard summary with correct response shape', async () => {
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 100 }])
    memberModel.countDocuments.mockResolvedValueOnce(50)
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 25 }])
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty('summary')
    expect(response.body.data).toHaveProperty('loanStatus')
    expect(response.body.data).toHaveProperty('recentActivities')
    expect(response.body.data.summary).toHaveProperty('totalBooks')
    expect(response.body.data.summary).toHaveProperty('activeMembers')
    expect(response.body.data.summary).toHaveProperty('activeLoans')
    expect(response.body.data.summary).toHaveProperty('overdueLoans')
    expect(response.body.data.loanStatus).toHaveProperty('borrowed')
    expect(response.body.data.loanStatus).toHaveProperty('returned')
    expect(response.body.data.loanStatus).toHaveProperty('overdue')
    expect(Array.isArray(response.body.data.recentActivities)).toBe(true)
  })

  it('calculates totalBooks correctly from Book.totalCopies sum', async () => {
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 8 }])
    memberModel.countDocuments.mockResolvedValueOnce(0)
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.summary.totalBooks).toBe(8)
  })

  it('counts activeMembers correctly', async () => {
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    memberModel.countDocuments.mockResolvedValueOnce(3)
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.summary.activeMembers).toBe(3)
  })

  it('sums activeLoans from all books', async () => {
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    memberModel.countDocuments.mockResolvedValueOnce(0)
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 15 }])
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.summary.activeLoans).toBe(15)
  })

  it('counts overdue loans correctly based on durationDays', async () => {
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    memberModel.countDocuments.mockResolvedValueOnce(0)
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])

    const now = new Date()
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)

    const overdueLoan = {
      borrowedAt: tenDaysAgo,
      durationDays: 5,
      status: 'borrowed',
      books: [],
    }

    loanModel.find.mockReturnValueOnce({
      populate: vi.fn().mockResolvedValueOnce([overdueLoan]),
    })
    loanModel.find.mockReturnValueOnce({
      populate: vi.fn().mockResolvedValueOnce([]),
    })
    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.summary.overdueLoans).toBe(1)
  })

  it('counts current month loan statuses separately', async () => {
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    memberModel.countDocuments.mockResolvedValueOnce(0)
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])

    loanModel.find.mockReturnValueOnce({
      populate: vi.fn().mockResolvedValueOnce([]),
    })

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const borrowedLoan = {
      borrowedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      durationDays: 14,
      status: 'borrowed',
      createdAt: monthStart,
      books: [],
    }

    const returnedLoan = {
      status: 'returned',
      createdAt: monthStart,
    }

    loanModel.find.mockReturnValueOnce({
      populate: vi.fn().mockResolvedValueOnce([borrowedLoan, returnedLoan]),
    })

    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.loanStatus.borrowed).toBe(1)
    expect(response.body.data.loanStatus.returned).toBe(1)
  })

  it('limits recentActivities to 5 items sorted by createdAt descending', async () => {
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    memberModel.countDocuments.mockResolvedValueOnce(0)
    bookModel.aggregate.mockResolvedValueOnce([{ _id: null, total: 0 }])
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })

    const activities = Array.from({ length: 10 }, (_, i) => ({
      _id: `activity-${i}`,
      module: 'book',
      action: 'create',
      description_id: `Desc ${i}`,
      description_en: `Description ${i}`,
      user: { name: 'User' },
      createdAt: new Date(new Date().getTime() - i * 60000),
    }))

    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(activities.slice(0, 5)),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.recentActivities.length).toBe(5)
    expect(response.body.data.recentActivities[0].user.name).toBe('User')
  })

  it('handles empty results gracefully with zero values and empty arrays', async () => {
    bookModel.aggregate.mockResolvedValueOnce([])
    memberModel.countDocuments.mockResolvedValueOnce(0)
    bookModel.aggregate.mockResolvedValueOnce([])
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    loanModel.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    })
    historyModel.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.summary.totalBooks).toBe(0)
    expect(response.body.data.summary.activeMembers).toBe(0)
    expect(response.body.data.summary.activeLoans).toBe(0)
    expect(response.body.data.summary.overdueLoans).toBe(0)
    expect(response.body.data.recentActivities.length).toBe(0)
  })
})
