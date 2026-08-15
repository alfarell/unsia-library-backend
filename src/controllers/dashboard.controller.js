import { Book } from '../models/book.model.js'
import { History } from '../models/history.model.js'
import { Loan } from '../models/loan.model.js'
import { Member } from '../models/member.model.js'

export const getDashboardSummary = async (request, response) => {
  const totalBooksResult = await Book.aggregate([
    { $group: { _id: null, total: { $sum: '$totalCopies' } } },
  ])

  const totalBooks = totalBooksResult[0]?.total ?? 0

  const activeMembers = await Member.countDocuments()

  const activeLoansResult = await Book.aggregate([
    { $group: { _id: null, total: { $sum: '$activeLoans' } } },
  ])

  const activeLoans = activeLoansResult[0]?.total ?? 0

  const allBorrowedLoans = await Loan.find({ status: 'borrowed' }).populate(
    'books',
  )

  let overdueLoans = 0
  for (const loan of allBorrowedLoans) {
    const dueDate = new Date(
      loan.borrowedAt.getTime() + loan.durationDays * 24 * 60 * 60 * 1000,
    )
    if (new Date() > dueDate) {
      overdueLoans += 1
    }
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const monthLoans = await Loan.find({
    createdAt: { $gte: monthStart, $lt: monthEnd },
  }).populate('books')

  let monthBorrowed = 0
  let monthReturned = 0
  let monthOverdue = 0

  for (const loan of monthLoans) {
    if (loan.status === 'borrowed') {
      const dueDate = new Date(
        loan.borrowedAt.getTime() + loan.durationDays * 24 * 60 * 60 * 1000,
      )
      if (new Date() > dueDate) {
        monthOverdue += 1
      } else {
        monthBorrowed += 1
      }
    } else if (loan.status === 'returned') {
      monthReturned += 1
    }
  }

  const recentActivities = await History.find()
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()

  const formattedActivities = recentActivities.map((activity) => ({
    module: activity.module,
    action: activity.action,
    description_id: activity.description_id,
    description_en: activity.description_en,
    user: activity.user ? { name: activity.user.name } : null,
    createdAt: activity.createdAt.toISOString(),
  }))

  return response.status(200).json({
    data: {
      summary: {
        totalBooks,
        activeMembers,
        activeLoans,
        overdueLoans,
      },
      loanStatus: {
        borrowed: monthBorrowed,
        returned: monthReturned,
        overdue: monthOverdue,
      },
      recentActivities: formattedActivities,
    },
  })
}
