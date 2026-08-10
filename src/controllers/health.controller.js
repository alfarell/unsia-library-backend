export const getHealth = (_request, response) => {
  response.status(200).json({
    data: {
      service: 'unsia-library-backend',
      status: 'ok',
    },
  })
}
