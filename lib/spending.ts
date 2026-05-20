export type SpendingTransaction = {
  amount: number
  category: string
  transaction_date: string
}

export type SpendingByCategory = Record<string, number>

export type SpendingGoal = {
  category: string
  monthly_limit: number
}

export type GoalNudge = {
  category: string
  categoryLabel: string
  spent: number
  limit: number
  progress: number
  remaining: number
  severity: 'good' | 'watch' | 'warning' | 'over'
  title: string
  message: string
  action: string
}

export type WeeklySpendVelocity = {
  currentTotal: number
  previousTotal: number
  difference: number
  changePercent: number | null
  weeklyAverage: number
  projectedMonthlySpend: number
  direction: 'up' | 'down' | 'flat'
}

export type CashflowSnapshot = {
  moneyIn: number
  everydaySpending: number
  transferOut: number
  moneyOut: number
  net: number
}

export type MonthlyCategoryLimitSuggestion = {
  category: string
  categoryLabel: string
  currentSpent: number
  projectedSpend: number
  suggestedLimit: number
  daysObserved: number
}

const CATEGORY_LABELS: Record<string, string> = {
  FOOD_AND_DRINK: 'Food & Drink',
  TRANSPORTATION: 'Transportation',
  ENTERTAINMENT: 'Entertainment',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
}

export const excludedSpendingCategories = ['TRANSFER_OUT', 'TRANSFER_IN', 'LOAN_PAYMENTS', 'BANK_FEES']

export function getMonthStartDate() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function getMonthStartDateString() {
  const start = getMonthStartDate()
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
}

export function isCurrentMonthTransaction(transaction: SpendingTransaction) {
  return new Date(transaction.transaction_date) >= getMonthStartDate()
}

export function isEverydaySpending(transaction: SpendingTransaction) {
  const amount = Number(transaction.amount)
  const category = transaction.category || ''

  return amount > 0 && !excludedSpendingCategories.includes(category)
}

export function getEverydaySpendingTotal(transactions: SpendingTransaction[]) {
  return transactions
    .filter(isEverydaySpending)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
}

export function getTransferOutTotal(transactions: SpendingTransaction[]) {
  return transactions
    .filter((transaction) => transaction.category === 'TRANSFER_OUT')
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0)
}

export function getMoneyInTotal(transactions: SpendingTransaction[]) {
  return transactions
    .filter((transaction) => Number(transaction.amount) < 0)
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0)
}

export function formatCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getSpendingByCategory(transactions: SpendingTransaction[]) {
  return transactions.reduce<SpendingByCategory>((acc, transaction) => {
    if (!isEverydaySpending(transaction)) {
      return acc
    }

    const category = transaction.category || 'OTHER'
    const amount = Number(transaction.amount)

    acc[category] = (acc[category] || 0) + amount
    return acc
  }, {})
}

export function getGoalNudges(goals: SpendingGoal[], spendingByCategory: SpendingByCategory) {
  return goals
    .map((goal) => {
      const spent = spendingByCategory[goal.category] || 0
      const limit = Number(goal.monthly_limit) || 0

      if (limit <= 0) {
        return null
      }

      const progress = spent / limit
      const remaining = Math.max(limit - spent, 0)
      const categoryLabel = formatCategoryLabel(goal.category)

      let severity: GoalNudge['severity'] = 'good'
      let title = `${categoryLabel} is on track`
      let message = `You have spent $${spent.toFixed(2)} out of $${limit.toFixed(2)} this month.`
      let action = 'Keep doing what is working and check in again later this week.'

      if (progress >= 1) {
        severity = 'over'
        title = `${categoryLabel} is over your goal`
        message = `You have spent $${spent.toFixed(2)}, which is $${(spent - limit).toFixed(2)} above your limit.`
        action = 'Pause spending in this category for a few days and look for a cheaper option.'
      } else if (progress >= 0.85) {
        severity = 'warning'
        title = `${categoryLabel} is nearly at the limit`
        message = `You are at ${Math.round(progress * 100)}% of your goal with $${remaining.toFixed(2)} left.`
        action = 'Use the last part of your budget carefully this week.'
      } else if (progress >= 0.65) {
        severity = 'watch'
        title = `${categoryLabel} is moving fast`
        message = `You have used ${Math.round(progress * 100)}% of your monthly limit.`
        action = 'If this category is a want, slow down before it becomes a problem.'
      }

      return {
        category: goal.category,
        categoryLabel,
        spent,
        limit,
        progress: Math.min(progress, 1.5),
        remaining,
        severity,
        title,
        message,
        action,
      }
    })
    .filter((nudge): nudge is GoalNudge => nudge !== null)
    .sort((a, b) => {
      const order: Record<GoalNudge['severity'], number> = {
        over: 0,
        warning: 1,
        watch: 2,
        good: 3,
      }

      return order[a.severity] - order[b.severity]
    })
}

export function getTopSpendingCategory(spendingByCategory: SpendingByCategory) {
  return Object.entries(spendingByCategory)
    .sort(([, left], [, right]) => right - left)[0]
}

function getDayStart(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function getCurrentMonthDayCount() {
  const now = new Date()
  return now.getDate()
}

export function getWeeklySpendVelocity(transactions: SpendingTransaction[]): WeeklySpendVelocity | null {
  if (transactions.length === 0) {
    return null
  }

  const now = getDayStart(new Date())
  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(now.getDate() - 6)

  const previousWeekStart = new Date(now)
  previousWeekStart.setDate(now.getDate() - 13)

  const previousWeekEnd = new Date(now)
  previousWeekEnd.setDate(now.getDate() - 7)

  const currentWeekTotal = transactions
    .filter((transaction) => {
      const date = getDayStart(new Date(transaction.transaction_date))
      return date >= currentWeekStart && date <= now && isEverydaySpending(transaction)
    })
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  const previousWeekTotal = transactions
    .filter((transaction) => {
      const date = getDayStart(new Date(transaction.transaction_date))
      return date >= previousWeekStart && date < previousWeekEnd && isEverydaySpending(transaction)
    })
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  const difference = currentWeekTotal - previousWeekTotal
  const changePercent = previousWeekTotal > 0 ? difference / previousWeekTotal : null
  const weeklyAverage = currentWeekTotal / 7
  const projectedMonthlySpend = weeklyAverage * 30

  return {
    currentTotal: currentWeekTotal,
    previousTotal: previousWeekTotal,
    difference,
    changePercent,
    weeklyAverage,
    projectedMonthlySpend,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat',
  }
}

export function getCashflowSnapshot(transactions: SpendingTransaction[]): CashflowSnapshot {
  const moneyIn = getMoneyInTotal(transactions)
  const everydaySpending = getEverydaySpendingTotal(transactions)
  const transferOut = getTransferOutTotal(transactions)
  const moneyOut = everydaySpending + transferOut

  return {
    moneyIn,
    everydaySpending,
    transferOut,
    moneyOut,
    net: moneyIn - moneyOut,
  }
}

export function suggestMonthlyCategoryLimit(transactions: SpendingTransaction[], category: string): MonthlyCategoryLimitSuggestion | null {
  const categoryTransactions = transactions.filter((transaction) => transaction.category === category && isEverydaySpending(transaction))

  if (categoryTransactions.length === 0) {
    return null
  }

  const currentSpent = categoryTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  const daysObserved = Math.max(getCurrentMonthDayCount(), 1)
  const projectedSpend = (currentSpent / daysObserved) * 30
  const suggestedLimit = Math.max(5, Math.round((projectedSpend * 0.9) / 5) * 5)

  return {
    category,
    categoryLabel: formatCategoryLabel(category),
    currentSpent,
    projectedSpend,
    suggestedLimit,
    daysObserved,
  }
}
