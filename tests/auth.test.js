import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userModel = {
  create: vi.fn(),
  findById: vi.fn(),
  findOne: vi.fn(),
}

vi.mock('../src/models/user.model.js', () => ({ User: userModel }))

const { createApp } = await import('../src/app.js')

const app = createApp()
const password = 'rahasia-kuat'
const user = {
  email: 'reader@example.com',
  id: '507f1f77bcf86cd799439011',
  name: 'Reader',
  passwordHash: await bcrypt.hash(password, 4),
}

describe('auth endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers a user, hashes the password, and returns a JWT', async () => {
    userModel.findOne.mockResolvedValue(null)
    userModel.create.mockResolvedValue(user)

    const response = await request(app).post('/api/auth/register').send({
      email: 'READER@EXAMPLE.COM',
      name: user.name,
      password,
    })

    expect(response.status).toBe(201)
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: user.email,
        name: user.name,
        passwordHash: expect.any(String),
      }),
    )
    expect(response.body.data.user).toEqual({
      email: user.email,
      id: user.id,
      name: user.name,
    })
    expect(response.body.data.user.passwordHash).toBeUndefined()
    expect(
      jwt.verify(
        response.body.data.token,
        process.env.JWT_SECRET ??
          'unsia-library-test-jwt-secret-minimum-32-characters',
      ).sub,
    ).toBe(user.id)
  })

  it('rejects a duplicate registration', async () => {
    userModel.findOne.mockResolvedValue(user)

    const response = await request(app).post('/api/auth/register').send({
      email: user.email,
      name: user.name,
      password,
    })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED')
  })

  it('logs in with valid credentials', async () => {
    userModel.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    })

    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password,
    })

    expect(response.status).toBe(200)
    expect(response.body.data.user.email).toBe(user.email)
    expect(response.body.data.token).toEqual(expect.any(String))
  })

  it('rejects invalid credentials without exposing account existence', async () => {
    userModel.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    })

    const response = await request(app).post('/api/auth/login').send({
      email: user.email,
      password,
    })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns the active user for a valid Bearer token', async () => {
    userModel.findById.mockResolvedValue(user)
    const token = jwt.sign(
      { sub: user.id },
      process.env.JWT_SECRET ??
        'unsia-library-test-jwt-secret-minimum-32-characters',
    )

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.user).toEqual({
      email: user.email,
      id: user.id,
      name: user.name,
    })
  })

  it('rejects requests to protected routes without a Bearer token', async () => {
    const response = await request(app).get('/api/auth/me')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })
})
