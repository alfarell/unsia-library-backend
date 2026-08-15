import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userModel = {
  findById: vi.fn(),
}

const memberModel = {
  create: vi.fn(),
  deleteOne: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
  findOne: vi.fn(),
}

const createHistoryMock = vi.fn().mockResolvedValue({})

vi.mock('../src/models/user.model.js', () => ({ User: userModel }))
vi.mock('../src/models/member.model.js', () => ({ Member: memberModel }))
vi.mock('../src/utils/create-history.js', () => ({
  createHistory: createHistoryMock,
}))

const { createApp } = await import('../src/app.js')

const app = createApp()
const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Reader',
}
const memberId = '507f1f77bcf86cd799439013'
const token = jwt.sign(
  { sub: user.id },
  process.env.JWT_SECRET ??
    'unsia-library-test-jwt-secret-minimum-32-characters',
)

const member = {
  address: 'Jl. Merdeka No. 1',
  createdAt: '2026-08-15T10:00:00.000Z',
  createdBy: { id: user.id, name: user.name },
  email: 'reader@example.com',
  id: memberId,
  membershipCode: 'UNSIA00001',
  name: 'Reader',
  phone: '0812-3456-7890',
  updatedAt: '2026-08-15T10:00:00.000Z',
  updatedBy: { id: user.id, name: user.name },
}

describe('member endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    userModel.findById.mockResolvedValue(user)
  })

  it('rejects all member endpoints without a Bearer token', async () => {
    const requests = [
      request(app).get('/api/members'),
      request(app)
        .post('/api/members')
        .send({ email: 'reader@example.com', name: 'Reader' }),
      request(app).put(`/api/members/${memberId}`).send({ name: 'Reader' }),
      request(app).delete(`/api/members/${memberId}`),
    ]

    for (const req of requests) {
      const response = await req

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    }
  })

  it('lists members with populated audit fields', async () => {
    memberModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue([member]),
      }),
    })

    const response = await request(app)
      .get('/api/members')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(memberModel.find).toHaveBeenCalledTimes(1)
    expect(response.body.data.members).toEqual([member])
  })

  it('creates a member with a generated code and audit fields', async () => {
    memberModel.findOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    })
    memberModel.create.mockResolvedValue({
      ...member,
      populate: vi.fn().mockResolvedValue(member),
    })

    const response = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        address: 'Jl. Merdeka No. 1',
        email: 'READER@EXAMPLE.COM',
        name: 'Reader',
        phone: '0812-3456-7890',
      })

    expect(response.status).toBe(201)
    expect(memberModel.findOne).toHaveBeenCalledTimes(1)
    expect(memberModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        address: 'Jl. Merdeka No. 1',
        createdBy: user.id,
        email: 'reader@example.com',
        membershipCode: 'UNSIA00001',
        name: 'Reader',
        phone: '0812-3456-7890',
        updatedBy: user.id,
      }),
    )
    expect(createHistoryMock).toHaveBeenCalledWith(
      'member',
      'create',
      expect.any(String),
      expect.any(String),
      user.id,
    )
    expect(response.body.data.member).toEqual(member)
  })

  it('rejects creating a member without name or email', async () => {
    const response = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '0812-3456-7890' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a duplicate email', async () => {
    memberModel.findOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    })
    memberModel.create.mockRejectedValue(
      Object.assign(new Error('duplicate key'), {
        code: 11000,
        keyPattern: { email: 1 },
      }),
    )

    const response = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'reader@example.com', name: 'Reader' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS')
  })

  it('increments the membership code counter', async () => {
    memberModel.findOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue({ membershipCode: 'UNSIA00042' }),
    })
    memberModel.create.mockResolvedValue({
      ...member,
      membershipCode: 'UNSIA00043',
      populate: vi.fn().mockResolvedValue(member),
    })

    const response = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'reader@example.com', name: 'Reader' })

    expect(response.status).toBe(201)
    expect(memberModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ membershipCode: 'UNSIA00043' }),
    )
  })

  it('retries with a bumped code when the generated code collides', async () => {
    memberModel.findOne.mockReturnValue({
      sort: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ membershipCode: 'UNSIA00001' }),
    })
    memberModel.create
      .mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), {
          code: 11000,
          keyPattern: { membershipCode: 1 },
        }),
      )
      .mockResolvedValueOnce({
        ...member,
        membershipCode: 'UNSIA00002',
        populate: vi.fn().mockResolvedValue(member),
      })

    const response = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'reader@example.com', name: 'Reader' })

    expect(response.status).toBe(201)
    expect(memberModel.findOne).toHaveBeenCalledTimes(2)
    expect(memberModel.create).toHaveBeenCalledTimes(2)
    expect(memberModel.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ membershipCode: 'UNSIA00002' }),
    )
    expect(response.body.data.member.membershipCode).toBe('UNSIA00002')
  })

  it('returns 500 when membership code retries are exhausted', async () => {
    memberModel.findOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    })
    memberModel.create.mockRejectedValue(
      Object.assign(new Error('duplicate key'), {
        code: 11000,
        keyPattern: { membershipCode: 1 },
      }),
    )

    const response = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'reader@example.com', name: 'Reader' })

    expect(response.status).toBe(500)
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(memberModel.create).toHaveBeenCalledTimes(3)
  })

  it('updates only the sent fields and sets updatedBy', async () => {
    const existingMember = {
      address: 'Jl. Merdeka No. 1',
      createdAt: '2026-08-15T10:00:00.000Z',
      createdBy: { id: user.id, name: user.name },
      email: 'reader@example.com',
      id: memberId,
      membershipCode: 'UNSIA00001',
      name: 'Reader',
      phone: '0812-3456-7890',
      updatedAt: '2026-08-15T10:00:00.000Z',
      updatedBy: { id: user.id, name: user.name },
      populate: vi.fn(),
      save: vi.fn(),
    }
    existingMember.save.mockResolvedValue(existingMember)
    existingMember.populate.mockImplementation(async () => {
      existingMember.createdBy = { id: user.id, name: user.name }
      existingMember.updatedBy = { id: user.id, name: user.name }
      return existingMember
    })
    memberModel.findById.mockResolvedValue(existingMember)

    const response = await request(app)
      .put(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '0811-2222-3333' })

    expect(response.status).toBe(200)
    expect(memberModel.findById).toHaveBeenCalledWith(memberId)
    expect(existingMember.save).toHaveBeenCalledTimes(1)
    expect(existingMember.phone).toBe('0811-2222-3333')
    expect(existingMember.name).toBe('Reader')
    expect(existingMember.address).toBe('Jl. Merdeka No. 1')
    expect(existingMember.updatedBy).toEqual({
      id: user.id,
      name: user.name,
    })
    expect(createHistoryMock).toHaveBeenCalledWith(
      'member',
      'update',
      expect.any(String),
      expect.any(String),
      user.id,
    )
    expect(response.body.data.member).toEqual({
      address: 'Jl. Merdeka No. 1',
      createdAt: '2026-08-15T10:00:00.000Z',
      createdBy: { id: user.id, name: user.name },
      email: 'reader@example.com',
      id: memberId,
      membershipCode: 'UNSIA00001',
      name: 'Reader',
      phone: '0811-2222-3333',
      updatedAt: '2026-08-15T10:00:00.000Z',
      updatedBy: { id: user.id, name: user.name },
    })
  })

  it('rejects updating a member with an empty body', async () => {
    const response = await request(app)
      .put(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects updating membershipCode as an unknown field', async () => {
    const response = await request(app)
      .put(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipCode: 'UNSIA00099' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects updating a member with a duplicate email', async () => {
    const existingMember = {
      save: vi.fn().mockRejectedValue(
        Object.assign(new Error('duplicate key'), {
          code: 11000,
          keyPattern: { email: 1 },
        }),
      ),
    }
    memberModel.findById.mockResolvedValue(existingMember)

    const response = await request(app)
      .put(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@example.com' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS')
  })

  it('returns 404 for invalid or missing member ids', async () => {
    const invalidUpdate = await request(app)
      .put('/api/members/not-an-object-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })

    expect(invalidUpdate.status).toBe(404)
    expect(invalidUpdate.body.error.code).toBe('MEMBER_NOT_FOUND')

    memberModel.findById.mockResolvedValue(null)

    const missingUpdate = await request(app)
      .put(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })

    expect(missingUpdate.status).toBe(404)
    expect(missingUpdate.body.error.code).toBe('MEMBER_NOT_FOUND')

    const invalidDelete = await request(app)
      .delete('/api/members/not-an-object-id')
      .set('Authorization', `Bearer ${token}`)

    expect(invalidDelete.status).toBe(404)
    expect(invalidDelete.body.error.code).toBe('MEMBER_NOT_FOUND')

    memberModel.deleteOne.mockResolvedValue({ deletedCount: 0 })

    const missingDelete = await request(app)
      .delete(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(missingDelete.status).toBe(404)
    expect(missingDelete.body.error.code).toBe('MEMBER_NOT_FOUND')
  })

  it('deletes a member and returns 204', async () => {
    const deleteMember = {
      id: memberId,
      name: 'Reader',
    }
    memberModel.findById.mockResolvedValue(deleteMember)
    memberModel.deleteOne.mockResolvedValue({ deletedCount: 1 })

    const response = await request(app)
      .delete(`/api/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(204)
    expect(memberModel.findById).toHaveBeenCalledWith(memberId)
    expect(createHistoryMock).toHaveBeenCalledWith(
      'member',
      'delete',
      expect.any(String),
      expect.any(String),
      user.id,
    )
    expect(memberModel.deleteOne).toHaveBeenCalledWith({ _id: memberId })
  })
})
