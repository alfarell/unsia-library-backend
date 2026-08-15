export const createHttpError = (status, code, message) =>
  Object.assign(new Error(message), { code, status })
