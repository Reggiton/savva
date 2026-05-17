import { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { RefreshControl } from 'react-native'

type Kid = { id: string; full_name: string; username: string }
type Connection = {
  id: string
  child_id: string
  visibility_enabled: boolean
  users: { full_name: string; username: string }
}
type Transaction = {
  id: string
  merchant_name: string
  category: string
  amount: number
  transaction_date: string
}
type Goal = {
  id: string
  category: string
  monthly_limit: number
}
type SpendingByCategory = { [key: string]: number }

export default function ParentHome() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Kid[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedKid, setSelectedKid] = useState<Connection | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [spending, setSpending] = useState<SpendingByCategory>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [kidLoading, setKidLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useFocusEffect(
    useCallback(() => {
      async function loadParentHome() {
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) {
            return
          }

          setUserId(user.id)
          await fetchConnections(user.id)
        } catch (error) {
          console.log('parent home load error:', error)
        } finally {
          setLoading(false)
        }
      }

      loadParentHome()
    }, [])
  )

  async function onRefresh() {
    setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await fetchConnections(user.id)
      if (selectedKid) await fetchKidData(selectedKid)
    }
    setRefreshing(false)
  }

  async function fetchConnections(uid: string) {
    const { data } = await supabase
      .from('parent_child_connections')
      .select('id, child_id, visibility_enabled, users!child_id(full_name, username)')
      .eq('parent_id', uid)
      .eq('status', 'active')
    if (data) {
      setConnections(data as any)
      if (data.length > 0) setSelectedKid(data[0] as any)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (selectedKid) fetchKidData(selectedKid)
  }, [selectedKid])

  async function fetchKidData(connection: Connection) {
    if (!connection.visibility_enabled) {
      setTransactions([])
      setGoals([])
      setSpending({})
      return
    }

    setKidLoading(true)
    const uid = connection.child_id

    const now = new Date()
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [txResult, goalResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, merchant_name, category, amount, transaction_date')
        .eq('user_id', uid)
        .order('transaction_date', { ascending: false })
        .limit(10),
      supabase
        .from('goals')
        .select('id, category, monthly_limit')
        .eq('user_id', uid),
    ])

    const monthTx = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', uid)
      .gte('transaction_date', startOfMonth)

    if (txResult.data) setTransactions(txResult.data)
    if (goalResult.data) setGoals(goalResult.data)

    if (monthTx.data) {
      const totals: SpendingByCategory = {}
      monthTx.data.forEach(tx => {
        totals[tx.category] = (totals[tx.category] || 0) + tx.amount
      })
      setSpending(totals)
    }

    setKidLoading(false)
  }

  async function searchKids() {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, username')
      .eq('role', 'kid')
      .ilike('username', `%${search}%`)
    if (data) setResults(data)
  }

  async function sendRequest(kidId: string) {
    const isBlocked = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', kidId)
      .eq('blocked_id', userId)
      .single()

    if (isBlocked.data) {
      Alert.alert('Unable to send request', 'You cannot send a request to this user.')
      return
    }

    const { error } = await supabase
      .from('connection_requests')
      .insert({ parent_id: userId, child_id: kidId, status: 'pending' })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      await supabase.from('notifications')
        .insert({ user_id: kidId, type: 'connection_request', message: 'A parent wants to connect with you.' })
      Alert.alert('Request sent', 'The kid will be notified.')
      setResults([])
      setSearch('')
    }
  }

  async function handleSignOut() {
    setSigningOut(true)

    const { error } = await supabase.auth.signOut({ scope: 'local' })

    setSigningOut(false)

    if (error) {
      Alert.alert('Could not sign out', error.message)
      return
    }

    router.dismissAll()
    router.replace('/login' as any)
  }

  const totalSpent = Object.values(spending).reduce((sum, val) => sum + val, 0)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Parent Dashboard</Text>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            disabled={signingOut}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Text style={[styles.signOutTxt, signingOut && styles.signOutTxtDisabled]}>
              {signingOut ? 'Signing out...' : 'Sign out'}
            </Text>
          </TouchableOpacity>
        </View>

      {/* Search for kids */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search kid by username"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={searchKids}>
          <Text style={styles.searchTxt}>Search</Text>
        </TouchableOpacity>
      </View>

      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.username}>@{item.username}</Text>
              <TouchableOpacity style={styles.requestBtn} onPress={() => sendRequest(item.id)}>
                <Text style={styles.requestTxt}>Send request</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Kid selector if multiple connected */}
      {connections.length > 1 && (
        <FlatList
          horizontal
          data={connections}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.kidSelector}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.kidBtn, selectedKid?.id === item.id && styles.kidBtnActive]}
              onPress={() => setSelectedKid(item)}
            >
              <Text style={[styles.kidBtnTxt, selectedKid?.id === item.id && styles.kidBtnActiveTxt]}>
                {item.users?.full_name}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {connections.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTxt}>No connected kids yet. Search for a kid's username above to send a request.</Text>
        </View>
      ) : selectedKid && !selectedKid.visibility_enabled ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTxt}>{selectedKid.users?.full_name} has turned off visibility.</Text>
        </View>
      ) : kidLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : selectedKid ? (
        <>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryName}>{selectedKid.users?.full_name}</Text>
            <Text style={styles.summaryLabel}>Total spent this month</Text>
            <Text style={styles.summaryAmount}>${totalSpent.toFixed(2)}</Text>
          </View>

          {/* Goals */}
          {goals.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Goals</Text>
              {goals.map(goal => {
                const spent = spending[goal.category] || 0
                const progress = Math.min(spent / goal.monthly_limit, 1)
                const over = spent > goal.monthly_limit
                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <View style={styles.goalHeader}>
                      <Text style={styles.goalCategory}>{goal.category}</Text>
                      <Text style={[styles.goalStatus, over && styles.overLimit]}>
                        ${spent.toFixed(2)} / ${goal.monthly_limit.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: over ? '#ff3b30' : '#000' }]} />
                    </View>
                  </View>
                )
              })}
            </>
          )}

          {/* Recent transactions */}
          <Text style={styles.sectionTitle}>Recent transactions</Text>
          {transactions.map(tx => (
            <View key={tx.id} style={styles.txCard}>
              <View style={styles.txLeft}>
                <Text style={styles.txMerchant}>{tx.merchant_name}</Text>
                <Text style={styles.txCategory}>{tx.category}</Text>
              </View>
              <Text style={styles.txAmount}>${tx.amount.toFixed(2)}</Text>
            </View>
          ))}
        </>
      ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  signOutBtn: { paddingVertical: 8, paddingLeft: 12 },
  signOutTxt: { color: '#ff3b30', fontWeight: '600' },
  signOutTxtDisabled: { opacity: 0.6 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  searchBtn: { backgroundColor: '#000', borderRadius: 8, padding: 12, justifyContent: 'center' },
  searchTxt: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 14, color: '#666', marginBottom: 8 },
  requestBtn: { backgroundColor: '#000', borderRadius: 8, padding: 8, alignItems: 'center' },
  requestTxt: { color: '#fff', fontWeight: '600' },
  kidSelector: { marginBottom: 16, flexGrow: 0 },
  kidBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', marginRight: 8 },
  kidBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  kidBtnTxt: { fontSize: 14, color: '#333' },
  kidBtnActiveTxt: { color: '#fff' },
  emptyCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 24, alignItems: 'center', marginTop: 16 },
  emptyTxt: { color: '#999', fontSize: 14, textAlign: 'center' },
  summaryCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 16 },
  summaryName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  summaryLabel: { fontSize: 13, color: '#999', marginBottom: 4 },
  summaryAmount: { fontSize: 32, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  goalCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 8 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  goalCategory: { fontSize: 14, fontWeight: '600' },
  goalStatus: { fontSize: 14, color: '#333' },
  overLimit: { color: '#ff3b30', fontWeight: '600' },
  progressBg: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4 },
  progressFill: { height: 8, borderRadius: 4 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: 15, fontWeight: '500' },
  txCategory: { fontSize: 13, color: '#999', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '600' },
})
