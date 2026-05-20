import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import { supabase } from '../../lib/supabase'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'
import {
  formatCategoryLabel,
  getGoalNudges,
  getMoneyInTotal,
  getMonthStartDateString,
  getSpendingByCategory,
  getTopSpendingCategory,
  isEverydaySpending,
  SpendingGoal,
  SpendingTransaction,
} from '../../lib/spending'

type InsightCard = {
  id: string
  kind: 'goal' | 'trend' | 'lesson' | 'habit' | 'encouragement'
  eyebrow: string
  title: string
  body: string
  helpTitle: string
  helpBody: string
  accent: string
}

type InsightRecord = {
  category: string
  insight: string
  tip: string
}

const EDUCATION_SNIPPETS: Record<string, { title: string; body: string }> = {
  FOOD_AND_DRINK: {
    title: 'Food spending can hide quickly',
    body: 'Small snack purchases add up because they happen often. A good check is to ask if the purchase is planned or just convenient.',
  },
  TRANSPORTATION: {
    title: 'Transportation is a utility cost',
    body: 'Rides, gas, and transit are normal spending. The win is planning them ahead so they do not surprise you at the end of the month.',
  },
  ENTERTAINMENT: {
    title: 'Entertainment is a want, not a need',
    body: 'Fun spending is healthy, but it should have a limit. Keeping a cap helps you enjoy things without losing track of other goals.',
  },
  SHOPPING: {
    title: 'Shopping is easiest to overspend on',
    body: 'One trick is to wait 24 hours before buying anything non-essential. That gives your brain time to decide if you really want it.',
  },
  OTHER: {
    title: 'Other spending should be reviewed',
    body: 'Unexpected categories are worth checking because they can hide subscriptions, one-time purchases, or categories that should be renamed.',
  },
}

const DEFAULT_EDUCATION = {
  title: 'How budgets work',
  body: 'A budget is just a plan for your money. It helps you decide where your money should go before it disappears on random purchases.',
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getRecentTrend(transactions: SpendingTransaction[]) {
  if (transactions.length < 4) {
    return null
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 7)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(now.getDate() - 14)

  const recent = transactions.filter((transaction) => {
    const date = new Date(transaction.transaction_date)
    return date >= sevenDaysAgo && date <= now && isEverydaySpending(transaction)
  })

  const previous = transactions.filter((transaction) => {
    const date = new Date(transaction.transaction_date)
    return date >= fourteenDaysAgo && date < sevenDaysAgo && isEverydaySpending(transaction)
  })

  const recentTotal = recent.reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  const previousTotal = previous.reduce((sum, transaction) => sum + Number(transaction.amount), 0)

  if (recentTotal === 0 && previousTotal === 0) {
    return null
  }

  const diff = recentTotal - previousTotal
  const change = previousTotal > 0 ? diff / previousTotal : 0

  return {
    recentTotal,
    previousTotal,
    diff,
    change,
  }
}

function buildInsightCards(transactions: SpendingTransaction[], goals: SpendingGoal[]): InsightCard[] {
  const spendingByCategory = getSpendingByCategory(transactions)
  const topCategory = getTopSpendingCategory(spendingByCategory)
  const goalNudges = getGoalNudges(goals, spendingByCategory)
  const trend = getRecentTrend(transactions)
  const moneyInTotal = getMoneyInTotal(transactions)

  const cards: InsightCard[] = []

  if (goalNudges.length > 0) {
    goalNudges.slice(0, 2).forEach((nudge, index) => {
      cards.push({
        id: `goal-${nudge.category}-${index}`,
        kind: 'goal',
        eyebrow: nudge.severity === 'over' ? 'ACTION NEEDED' : 'GOAL CHECK',
        title: nudge.title,
        body: `${nudge.message} ${nudge.action}`,
        helpTitle: `${nudge.categoryLabel} goal`,
        helpBody: `You set a monthly limit of ${formatMoney(nudge.limit)} for ${nudge.categoryLabel}. ${formatMoney(nudge.spent)} has been spent so far, so you have ${formatMoney(nudge.remaining)} left. Goal nudges help you pause before a category takes over your budget.`,
        accent: nudge.severity === 'over' ? Colors.error : nudge.severity === 'warning' ? Colors.warning : Colors.primary,
      })
    })
  }

  if (trend) {
    const direction = trend.diff > 0 ? 'up' : trend.diff < 0 ? 'down' : 'flat'
    const body =
      direction === 'flat'
        ? 'Your spending is holding steady compared with the previous week. That usually means your habits are consistent.'
        : trend.diff > 0
          ? `You spent ${formatMoney(trend.diff)} more in the last 7 days than the 7 days before. That can happen fast when small purchases pile up.`
          : `You spent ${formatMoney(Math.abs(trend.diff))} less in the last 7 days than the week before. That is a real habit win.`

    cards.push({
      id: 'trend',
      kind: 'trend',
      eyebrow: 'WEEKLY TREND',
      title: direction === 'flat' ? 'Your spending is steady' : trend.diff > 0 ? 'Spending picked up' : 'Spending slowed down',
      body,
      helpTitle: 'Weekly spending trend',
      helpBody: 'Weekly trends help you see whether spending is speeding up or cooling down before the month is over. A small increase can be normal, but repeated increases are worth watching.',
      accent: trend.diff > 0 ? Colors.warning : Colors.success,
    })
  }

  if (topCategory) {
    const [category, amount] = topCategory
    const education = EDUCATION_SNIPPETS[category] || DEFAULT_EDUCATION
    cards.push({
      id: `top-${category}`,
      kind: 'lesson',
      eyebrow: 'TOP CATEGORY',
      title: `${formatCategoryLabel(category)} leads your spending`,
      body: `${formatMoney(amount)} went to ${formatCategoryLabel(category).toLowerCase()} this month. ${education.body}`,
      helpTitle: education.title,
      helpBody: education.body,
      accent: Colors.primary,
    })
  }

  if (moneyInTotal > 0) {
    cards.push({
      id: 'money-in',
      kind: 'encouragement',
      eyebrow: 'MONEY IN',
      title: 'Money is coming in',
      body: `You have received ${formatMoney(moneyInTotal)} this month. A simple habit is to give every dollar a job: spend, save, or set aside.`,
      helpTitle: 'Give every dollar a job',
      helpBody: 'A healthy money habit is deciding what money should do before it gets spent. That can mean saving part of it, using part of it for needs, and keeping some for wants.',
      accent: Colors.success,
    })
  }

  if (cards.length < 3) {
    cards.push({
      id: 'budget-basics',
      kind: 'habit',
      eyebrow: 'BUDGET BASICS',
      title: 'A budget is a spending plan',
      body: 'Budgets do not mean you cannot spend. They help you choose what matters most so random purchases do not take over.',
      helpTitle: DEFAULT_EDUCATION.title,
      helpBody: DEFAULT_EDUCATION.body,
      accent: Colors.primaryLight,
    })
  }

  return cards.slice(0, 4)
}

export default function Insights() {
  const [insights, setInsights] = useState<InsightCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadInsights()
  }, [])

  async function loadInsights() {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const startOfMonth = getMonthStartDateString()

      const [{ data: transactionsData }, { data: goalsData }] = await Promise.all([
        supabase
          .from('transactions')
          .select('category, amount, merchant_name, transaction_date')
          .eq('user_id', user.id)
          .gte('transaction_date', startOfMonth),
        supabase
          .from('goals')
          .select('category, monthly_limit')
          .eq('user_id', user.id),
      ])

      const transactions = (transactionsData || []) as SpendingTransaction[]
      const goals = (goalsData || []) as SpendingGoal[]

      if (transactions.length === 0) {
        setInsights([
          {
            id: 'empty-basics',
            kind: 'habit',
            eyebrow: 'START HERE',
            title: 'No transactions yet',
            body: 'Once spending starts, this page will show what changed, where your money went, and how to stay on track.',
            helpTitle: 'What insights do',
            helpBody: 'Insights help you turn raw transactions into patterns you can act on. They are most useful when they tell you what to watch, what is going well, and what to do next.',
            accent: Colors.primary,
          },
        ])
        return
      }

      setInsights(buildInsightCards(transactions, goals))
    } catch (error) {
      console.log('insights load error:', error)
      Alert.alert('Insights unavailable', 'We could not load your insights right now. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function refresh() {
    setRefreshing(true)
    await loadInsights()
  }

  const hasInsights = useMemo(() => insights.length > 0, [insights])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingTxt}>Analyzing your spending...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <RefreshableScrollView onRefresh={refresh} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SMART NOTES</Text>
            <Text style={styles.title}>Insights</Text>
          </View>
          <TouchableOpacity onPress={refresh} disabled={refreshing}>
            <Text style={styles.refreshBtn}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Based on your spending this month</Text>

        {!hasInsights ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.emptyTxt}>Make a few transactions and refresh this page.</Text>
          </View>
        ) : (
          insights.map((insight) => (
            <View key={insight.id} style={[styles.card, { borderLeftColor: insight.accent }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.category, { color: insight.accent }]}>{insight.eyebrow}</Text>
                <TouchableOpacity
                  style={styles.helpButton}
                  onPress={() => Alert.alert(insight.helpTitle, insight.helpBody)}
                  accessibilityLabel={`Learn more about ${insight.title}`}
                >
                  <Text style={styles.helpText}>?</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insight}>{insight.body}</Text>
              <View style={styles.tipBox}>
                <Text style={styles.tipLabel}>Try this</Text>
                <Text style={styles.tip}>{insight.helpBody}</Text>
              </View>
            </View>
          ))
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Colors.background },
  loadingTxt: { marginTop: 12, color: Colors.textSecondary, fontSize: Typography.bodySmall },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xs },
  eyebrow: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: Typography.h2, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  refreshBtn: { color: Colors.primary, fontSize: Typography.bodySmall, fontWeight: '800', paddingTop: Spacing.xs },
  subtitle: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.lg },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    ...Shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  category: { fontSize: Typography.caption, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  insightTitle: { fontSize: Typography.body, color: Colors.textPrimary, marginBottom: Spacing.xs, lineHeight: 22, fontWeight: '800' },
  insight: { fontSize: Typography.bodySmall, color: Colors.textPrimary, marginBottom: Spacing.md, lineHeight: 21, fontWeight: '600' },
  tipBox: { backgroundColor: Colors.cardBackgroundAlt, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tipLabel: { fontSize: Typography.caption, fontWeight: '800', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' },
  tip: { fontSize: Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  helpButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.progressBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: { color: Colors.textPrimary, fontSize: Typography.caption, fontWeight: '900' },
  emptyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '800', marginBottom: Spacing.xs },
  emptyTxt: { color: Colors.textMuted, fontSize: Typography.bodySmall, textAlign: 'center' },
})
