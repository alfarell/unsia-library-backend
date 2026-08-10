import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('health endpoint', () => {
  const app = createApp()

  it('returns the service status', async () => {
    const response = await request(app).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: {
        service: 'unsia-library-backend',
        status: 'ok',
      },
    })
  })

  it('returns a structured error for an unknown route', async () => {
    const response = await request(app).get('/api/v1/unknown')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})
