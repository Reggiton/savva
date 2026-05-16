import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { RefreshControl } from 'react-native'

type Transaction = {
  id: string
  merchant_name: string
  category: string
  amount: number
  transaction_date: string
}

const CATEGORIES = ['All', 'FOOD_AND_DRINK', 'TRANSPORTATION', 'ENTERTAINMENT', 'SHOPPING', 'OTHER']

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filtered, setFiltered] = useState<Transaction[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          const { data } = await supabase
            .from('transactions')
            .select('id, merchant_name, category, amount, transaction_date')
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false })
          if (data) {
            setTransactions(data)
            setFiltered(data)
          }
          setLoading(false)
        }
      })
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
        setFiltered(data)
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
        <ActivityIndicator size="large" />
      </View>
    )
  }

  const grouped = groupByDate(filtered)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transactions</Text>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={item => item}
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, selectedCategory === item && styles.filterActive]}
            onPress={() => filterByCategory(item)}
          >
            <Text style={[styles.filterTxt, selectedCategory === item && styles.filterActiveTxt]}>
              {item === 'FOOD_AND_DRINK' ? 'Food' :
               item === 'TRANSPORTATION' ? 'Transport' :
               item === 'ENTERTAINMENT' ? 'Entertainment' :
               item === 'SHOPPING' ? 'Shopping' : item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={grouped}
        keyExtractor={item => item.date}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{item.date}</Text>
            {item.items.map(tx => (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txLeft}>
                  <Text style={styles.txMerchant}>{tx.merchant_name}</Text>
                  <Text style={styles.txCategory}>{tx.category}</Text>
                </View>
                <Text style={styles.txAmount}>${tx.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transactions found.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  filterRow: { marginBottom: 16, flexGrow: 0 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', marginRight: 8 },
  filterActive: { backgroundColor: '#000', borderColor: '#000' },
  filterTxt: { fontSize: 13, color: '#333' },
  filterActiveTxt: { color: '#fff' },
  dateGroup: { marginBottom: 16 },
  dateLabel: { fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 8 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: 15, fontWeight: '500' },
  txCategory: { fontSize: 13, color: '#999', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '600' },
  empty: { color: '#999', fontSize: 14, textAlign: 'center', marginTop: 24 },
})