import { History } from '../models/history.model.js'

export async function createHistory(
  module,
  action,
  descriptionId,
  descriptionEn,
  userId,
) {
  const history = await History.create({
    module,
    action,
    description_id: descriptionId,
    description_en: descriptionEn,
    user: userId,
  })
  return history
}
