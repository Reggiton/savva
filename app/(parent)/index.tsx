import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useFocusEffect, useRouter } from 'expo-router'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../lib/theme'
import Header from '../../components/Header'
import RefreshableScrollView from '../../components/RefreshableScrollView'

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
  const isMounted = useRef(true)

  // UI State
  const [loading, setLoading] = useState(true)
  const [kidLoading, setKidLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Kid[]>([])

  // Data State
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Parent')
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedKid, setSelectedKid] = useState<Connection | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [spending, setSpending] = useState<SpendingByCategory>({})

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const fetchKidDetails = useCallback(async (kid: Connection) => {
    if (!kid.visibility_enabled) {
      setTransactions([])
      setGoals([])
      setSpending({})
      return
    }

    setKidLoading(true)
    const kidId = kid.child_id
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    try {
      const [txRes, goalRes, monthTxRes] = await Promise.all([
        supabase.from('transactions').select('id, merchant_name, category, amount, transaction_date').eq('user_id', kidId).order('transaction_date', { ascending: false }).limit(10),
        supabase.from('goals').select('id, category, monthly_limit').eq('user_id', kidId),
        supabase.from('transactions').select('category, amount').eq('user_id', kidId).gte('transaction_date', startOfMonth)
      ])

      if (!isMounted.current) return

      setTransactions(txRes.data || [])
      setGoals(goalRes.data || [])

      if (monthTxRes.data) {
        const totals: SpendingByCategory = {}
        monthTxRes.data.forEach(tx => {
          totals[tx.category] = (totals[tx.category] || 0) + tx.amount
        })
        setSpending(totals)
      }
    } catch (error) {
      console.error('fetchKidDetails error:', error)
    } finally {
      if (isMounted.current) setKidLoading(false)
    }
  }, [])

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)

    try {
      // Use getUser() to ensure fresh session metadata
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setLoading(false)
        return
      }

      const uid = user.id
      if (isMounted.current) {
        setUserId(uid)
        setProfilePicUrl(user.user_metadata?.profile_pic_url || '')
      }

      const [profileRes, notifyRes, connRes] = await Promise.all([
        supabase.from('users').select('full_name, username').eq('id', uid).maybeSingle(),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('read', false),
        supabase.from('parent_child_connections').select('id, child_id, visibility_enabled, users!child_id(full_name, username)').eq('parent_id', uid).eq('status', 'active')
      ])

      if (!isMounted.current) return

      setUserName(
        user.user_metadata?.full_name ||
        profileRes.data?.full_name ||
        user.user_metadata?.username ||
        profileRes.data?.username ||
        'Parent'
      )
      setUnreadNotificationCount(notifyRes.count ?? 0)

      const fetchedConnections = (connRes.data as any[]) || []
      setConnections(fetchedConnections)

      if (fetchedConnections.length > 0) {
        const stillExists = fetchedConnections.find(c => c.id === selectedKid?.id)
        const nextKid = stillExists || fetchedConnections[0]

        if (nextKid.id !== selectedKid?.id) {
          setSelectedKid(nextKid)
        } else {
          fetchKidDetails(nextKid)
        }
      }
    } catch (error) {
      console.error('loadDashboard error:', error)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [selectedKid?.id, fetchKidDetails])

  useFocusEffect(
    useCallback(() => {
      loadDashboard()
    }, [loadDashboard])
  )

  const handleKidSelect = (kid: Connection) => {
    if (kid.id === selectedKid?.id) return
    setSelectedKid(kid)
    fetchKidDetails(kid)
  }

  const handleSearch = async () => {
    if (!search.trim()) return
    const { data } = await supabase.from('users').select('id, full_name, username').eq('role', 'kid').ilike('username', `%${search}%`)
    if (data) setResults(data)
  }

  const handleSendRequest = async (kidId: string) => {
    if (!userId) return
    const { error } = await supabase.from('connection_requests').insert({ parent_id: userId, child_id: kidId, status: 'pending' })
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      await supabase.from('notifications').insert({ user_id: kidId, type: 'connection_request', message: 'A parent wants to connect with you.' })
      Alert.alert('Success', 'Request sent!')
      setResults([])
      setSearch('')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  const totalSpent = Object.values(spending).reduce((sum, val) => sum + val, 0)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header
        userName={userName}
        profilePicUrl={profilePicUrl}
        onProfilePress={() => router.push('/(parent)/settings' as any)}
        onNotificationsPress={() => router.push('/(parent)/notifications' as any)}
        unreadNotificationCount={unreadNotificationCount}
      />

      <RefreshableScrollView onRefresh={() => loadDashboard(true)} contentContainerStyle={styles.scrollContent}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Search kid by username"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchTxt}>Search</Text>
          </TouchableOpacity>
        </View>

        {results.length > 0 && (
          <View style={styles.resultsContainer}>
            {results.map(item => (
              <View key={item.id} style={styles.card}>
                <View>
                  <Text style={styles.name}>{item.full_name}</Text>
                  <Text style={styles.username}>@{item.username}</Text>
                </View>
                <TouchableOpacity style={styles.requestBtn} onPress={() => handleSendRequest(item.id)}>
                  <Text style={styles.requestTxt}>Connect</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setResults([])} style={styles.clearResults}>
              <Text style={styles.clearResultsTxt}>Clear results</Text>
            </TouchableOpacity>
          </View>
        )}

        {connections.length > 1 && (
          <View style={styles.kidSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {connections.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.kidBtn, selectedKid?.id === item.id && styles.kidBtnActive]}
                  onPress={() => handleKidSelect(item)}
                >
                  <Text style={[styles.kidBtnTxt, selectedKid?.id === item.id && styles.kidBtnActiveTxt]}>
                    {item.users?.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
          <ActivityIndicator style={{ marginVertical: Spacing.xl }} color={Colors.primary} />
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryName}>{selectedKid?.users?.full_name}</Text>
                <Text style={styles.summaryLabel}>SPENT THIS MONTH</Text>
              </View>
              <Text style={styles.summaryAmount}>${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>

            {goals.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>GOALS</Text>
                {goals.map(goal => {
                  const spent = spending[goal.category] || 0
                  const progress = Math.min(spent / goal.monthly_limit, 1)
                  const over = spent > goal.monthly_limit
                  return (
                    <View key={goal.id} style={styles.goalCard}>
                      <View style={styles.goalHeader}>
                        <Text style={styles.goalCategory}>{goal.category.replace(/_/g, ' ')}</Text>
                        <Text style={[styles.goalStatus, over && styles.overLimit]}>
                          ${spent.toFixed(2)} / ${goal.monthly_limit.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: over ? Colors.error : Colors.primary }]} />
                      </View>
                    </View>
                  )
                })}
              </>
            )}

            <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTxt}>No transactions yet.</Text>
              </View>
            ) : (
              transactions.map(item => (
                <View key={item.id} style={styles.txCard}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txMerchant}>{item.merchant_name || 'Unknown merchant'}</Text>
                    <Text style={styles.txCategory}>{item.category}</Text>
                  </View>
                  <Text style={[styles.txAmount, Number(item.amount) < 0 && styles.positive]}>
                    {Number(item.amount) < 0 ? '+' : '-'}${Math.abs(Number(item.amount)).toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </RefreshableScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  input: { flex: 1, backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.bodySmall },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  searchTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.bodySmall },
  resultsContainer: { marginBottom: Spacing.lg },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.small },
  name: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },
  username: { fontSize: Typography.caption, color: Colors.textSecondary },
  requestBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  requestTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.caption },
  clearResults: { alignSelf: 'center', marginTop: Spacing.xs },
  clearResultsTxt: { color: Colors.textMuted, fontSize: Typography.caption },
  kidSelector: { marginBottom: Spacing.lg },
  kidBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm, backgroundColor: Colors.cardBackground },
  kidBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kidBtnTxt: { fontSize: Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },
  kidBtnActiveTxt: { color: Colors.textPrimary },
  emptyCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
  emptyTxt: { color: Colors.textMuted, fontSize: Typography.bodySmall, textAlign: 'center' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border, ...Shadows.medium },
  summaryName: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  summaryLabel: { fontSize: Typography.tiny, color: Colors.textSecondary, fontWeight: '900', letterSpacing: 1 },
  summaryAmount: { fontSize: Typography.h3, fontWeight: '900', color: Colors.textPrimary },
  sectionTitle: { fontSize: Typography.caption, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: Spacing.md, marginTop: Spacing.xs },
  goalCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  goalCategory: { fontSize: Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  goalStatus: { fontSize: Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },
  overLimit: { color: Colors.error },
  progressBg: { height: 8, backgroundColor: Colors.progressBackground, borderRadius: 10, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 10 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: Typography.bodySmall, fontWeight: '600', color: Colors.textPrimary },
  txCategory: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary },
  positive: { color: Colors.success },
  signOutBtn: { alignSelf: 'flex-end', padding: Spacing.sm, marginTop: Spacing.xl },
  signOutTxt: { color: Colors.error, fontWeight: '700', fontSize: Typography.bodySmall },
})
