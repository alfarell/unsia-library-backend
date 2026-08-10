import { ZodError } from 'zod'

export const errorHandler = (error, request, response, _next) => {
  request.log.error(error)

  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        details: error.issues,
        message: 'Input tidak valid',
      },
    })
  }

  return response.status(error.status ?? 500).json({
    error: {
      code: error.code ?? 'INTERNAL_SERVER_ERROR',
      message: error.status ? error.message : 'Terjadi kesalahan pada server',
    },
  })
}
