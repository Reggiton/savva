import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { BorderRadius, Colors, Spacing, Typography } from '../../lib/theme'

type Transaction = {
  id: string
  merchant_name: string
  category: string
  amount: number
  transaction_date: string
}

const CATEGORIES = ['All', 'FOOD_AND_DRINK', 'TRANSPORTATION', 'ENTERTAINMENT', 'SHOPPING', 'OTHER']

function formatCategory(category: string) {
  if (category === 'All') return 'All'
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filtered, setFiltered] = useState<Transaction[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      async function loadTransactions() {
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) {
            return
          }

          const { data } = await supabase
            .from('transactions')
            .select('id, merchant_name, category, amount, transaction_date')
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false })

          if (data) {
            setTransactions(data)
            setFiltered(data)
          }
        } catch (error) {
          console.log('transactions load error:', error)
        } finally {
          setLoading(false)
        }
      }

      loadTransactions()
    }, [])
  )
  async function onRefresh() {
    setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('transactions')
        .select('id, merchant_name, category, amount, transaction_date')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
      if (data) {
        setTransactions(data)
        if (selectedCategory === 'All') {
          setFiltered(data)
        } else {
          setFiltered(data.filter(t => t.category === selectedCategory))
        }
      }
    }
    setRefreshing(false)
  }

  function filterByCategory(category: string) {
    setSelectedCategory(category)
    if (category === 'All') {
      setFiltered(transactions)
    } else {
      setFiltered(transactions.filter(t => t.category === category))
    }
  }

  function groupByDate(txs: Transaction[]) {
    const groups: { [key: string]: Transaction[] } = {}
    txs.forEach(tx => {
      if (!groups[tx.transaction_date]) groups[tx.transaction_date] = []
      groups[tx.transaction_date].push(tx)
    })
    return Object.entries(groups).map(([date, items]) => ({ date, items }))
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const grouped = groupByDate(filtered)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SPENDING HISTORY</Text>
        <Text style={styles.title}>Transactions</Text>
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={item => item}
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, selectedCategory === item && styles.filterActive]}
            onPress={() => filterByCategory(item)}
          >
            <Text style={[styles.filterTxt, selectedCategory === item && styles.filterActiveTxt]}>
              {formatCategory(item)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={grouped}
        keyExtractor={item => item.date}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.cardBackground}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{item.date}</Text>
            {item.items.map(tx => (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txLeft}>
                  <Text style={styles.txMerchant}>{tx.merchant_name || 'Unknown merchant'}</Text>
                  <Text style={styles.txCategory}>{formatCategory(tx.category)}</Text>
                </View>
                <Text style={[styles.txAmount, Number(tx.amount) < 0 && styles.positive]}>
                  {Number(tx.amount) < 0 ? '+' : '-'}${Math.abs(Number(tx.amount)).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>No transactions found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  eyebrow: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: Typography.h2, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  filterRow: { height: 48, marginBottom: 16, flexGrow: 0 },
  filterContent: { paddingHorizontal: Spacing.lg, alignItems: 'center', paddingBottom: Spacing.xs },
  filterBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 34,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    backgroundColor: Colors.cardBackground,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTxt: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: '700' },
  filterActiveTxt: { color: Colors.textPrimary },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  dateGroup: { marginBottom: Spacing.lg },
  dateLabel: { fontSize: Typography.caption, fontWeight: '800', color: Colors.textMuted, marginBottom: Spacing.sm, letterSpacing: 1 },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary },
  txCategory: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: Typography.bodySmall, fontWeight: '800', color: Colors.textPrimary },
  positive: { color: Colors.success },
  emptyCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center' },
  empty: { color: Colors.textMuted, fontSize: Typography.bodySmall, textAlign: 'center' },
})
