import { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import { supabase } from '../../lib/supabase'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

type Insight = {
  category: string
  insight: string
  tip: string
}

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadInsights()
  }, [])

  async function loadInsights() {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const now = new Date()
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data: transactions } = await supabase
        .from('transactions')
        .select('category, amount, merchant_name, transaction_date')
        .eq('user_id', user.id)
        .gte('transaction_date', startOfMonth)

      if (!transactions || transactions.length === 0) {
        setInsights([])
        return
      }

      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { transactions },
      })

      if (!error && data?.insights) {
        setInsights(data.insights)
      }
    } catch (error) {
      console.log('insights load error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function refresh() {
    setRefreshing(true)
    await loadInsights()
  }

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

        {insights.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.emptyTxt}>Make a few transactions and refresh this page.</Text>
          </View>
        ) : (
          insights.map((insight, index) => (
            <View key={`${insight.category}-${index}`} style={styles.card}>
              <Text style={styles.category}>{insight.category}</Text>
              <Text style={styles.insight}>{insight.insight}</Text>
              <View style={styles.tipBox}>
                <Text style={styles.tipLabel}>Tip</Text>
                <Text style={styles.tip}>{insight.tip}</Text>
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
    ...Shadows.medium,
  },
  category: { fontSize: Typography.caption, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', marginBottom: Spacing.sm, letterSpacing: 1 },
  insight: { fontSize: Typography.bodySmall, color: Colors.textPrimary, marginBottom: Spacing.md, lineHeight: 21, fontWeight: '600' },
  tipBox: { backgroundColor: Colors.cardBackgroundAlt, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tipLabel: { fontSize: Typography.caption, fontWeight: '800', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' },
  tip: { fontSize: Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
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
