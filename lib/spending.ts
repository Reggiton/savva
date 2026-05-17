export type SpendingTransaction = {
  amount: number
  category: string
  transaction_date: string
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
