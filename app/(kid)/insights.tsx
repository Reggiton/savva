import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native'
import { supabase } from '../../lib/supabase'

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
      setLoading(false)
      return
    }

    const { data, error } = await supabase.functions.invoke('generate-insights', {
      body: { transactions },
    })

    if (!error && data?.insights) {
      setInsights(data.insights)
    }

    setLoading(false)
    setRefreshing(false)
  }

  async function refresh() {
    setRefreshing(true)
    await loadInsights()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingTxt}>Analyzing your spending...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <TouchableOpacity onPress={refresh} disabled={refreshing}>
          <Text style={styles.refreshBtn}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Based on your spending this month</Text>

      {insights.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTxt}>No insights yet — make some transactions first!</Text>
        </View>
      ) : (
        insights.map((insight, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.category}>{insight.category}</Text>
            <Text style={styles.insight}>{insight.insight}</Text>
            <View style={styles.tipBox}>
              <Text style={styles.tipLabel}>💡 Tip</Text>
              <Text style={styles.tip}>{insight.tip}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingTxt: { marginTop: 12, color: '#999', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '600' },
  refreshBtn: { color: '#007AFF', fontSize: 14 },
  subtitle: { fontSize: 14, color: '#999', marginBottom: 16 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 12 },
  category: { fontSize: 13, fontWeight: '600', color: '#999', textTransform: 'uppercase', marginBottom: 6 },
  insight: { fontSize: 15, color: '#333', marginBottom: 12, lineHeight: 22 },
  tipBox: { backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  tipLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  tip: { fontSize: 14, color: '#555', lineHeight: 20 },
  emptyCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyTxt: { color: '#999', fontSize: 14, textAlign: 'center' },
})