export const notFound = (request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.originalUrl} tidak ditemukan`,
    },
  })
}
