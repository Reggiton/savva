import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useFocusEffect, useRouter } from 'expo-router'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../lib/theme'
import Header from '../../components/Header'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import {
  formatCategoryLabel,
  getCashflowSnapshot,
  getEverydaySpendingTotal,
  getGoalNudges,
  getSpendingByCategory,
  getTopSpendingCategory,
  getWeeklySpendVelocity,
  suggestMonthlyCategoryLimit,
} from '../../lib/spending'
import { trackEvent } from '../../lib/metrics'

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

type MonthTransaction = {
  id: string
  merchant_name: string
  category: string
  amount: number
  transaction_date: string
}

export default function ParentHome() {
  const router = useRouter()
  const isMounted = useRef(true)
  const selectedKidRef = useRef<Connection | null>(null)

  // UI State
  const [loading, setLoading] = useState(true)
  const [kidLoading, setKidLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Kid[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'coaching' | 'activity'>('overview')

  // Data State
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Parent')
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedKid, setSelectedKid] = useState<Connection | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [monthTransactions, setMonthTransactions] = useState<MonthTransaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [spending, setSpending] = useState<SpendingByCategory>({})

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    selectedKidRef.current = selectedKid
  }, [selectedKid])

  const ensureParentProfile = useCallback(async () => {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    const fullName = (user.user_metadata?.full_name as string) || 'Parent'
    const username = (user.user_metadata?.username as string) || ''
    const email = (user.email as string) || ''

    const { error: profileError } = await supabase.from('users').upsert(
      {
        id: user.id,
        full_name: fullName,
        username,
        email,
        role: 'parent',
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      throw profileError
    }

    return user
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
        supabase.from('transactions').select('id, merchant_name, category, amount, transaction_date').eq('user_id', kidId).gte('transaction_date', startOfMonth)
      ])

      if (!isMounted.current) return

      setTransactions(txRes.data || [])
      setGoals(goalRes.data || [])
      setMonthTransactions((monthTxRes.data || []) as MonthTransaction[])

      if (monthTxRes.data) {
        const totals: SpendingByCategory = {}
        monthTxRes.data.forEach((tx: { category: string; amount: number }) => {
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

      try {
        await ensureParentProfile()
      } catch (profileError) {
        console.error('ensureParentProfile error:', profileError)
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
        const currentSelectedKidId = selectedKidRef.current?.id
        const nextKid = fetchedConnections.find((connection) => connection.id === currentSelectedKidId) || fetchedConnections[0]

        if (nextKid.id !== currentSelectedKidId) {
          setSelectedKid(nextKid)
        }
      }

      await trackEvent('dashboard_viewed', {
        role: 'parent',
        connections: fetchedConnections.length,
      })
    } catch (error) {
      console.error('loadDashboard error:', error)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [fetchKidDetails, ensureParentProfile])

  useEffect(() => {
    if (!selectedKid) return
    fetchKidDetails(selectedKid)
  }, [selectedKid, fetchKidDetails])

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

    try {
      await ensureParentProfile()
      const { error } = await supabase.from('connection_requests').insert({ parent_id: userId, child_id: kidId, status: 'pending' })
      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      await trackEvent('connection_request_sent', { role: 'parent' })
      await supabase.from('notifications').insert({ user_id: kidId, type: 'connection_request', message: 'A parent wants to connect with you.' })
      Alert.alert('Success', 'Request sent!')
      setResults([])
      setSearch('')
    } catch (profileError) {
      console.error('handleSendRequest profile error:', profileError)
      Alert.alert('Error', 'Could not verify your parent profile. Please sign out and back in, then try again.')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  const totalSpent = Object.values(spending).reduce((sum, val) => sum + val, 0)
  const monthlySpendingByCategory = useMemo(() => getSpendingByCategory(monthTransactions), [monthTransactions])
  const goalNudges = useMemo(() => getGoalNudges(goals, monthlySpendingByCategory), [goals, monthlySpendingByCategory])
  const weeklyVelocity = useMemo(() => getWeeklySpendVelocity(monthTransactions), [monthTransactions])
  const cashflowSnapshot = useMemo(() => getCashflowSnapshot(monthTransactions), [monthTransactions])
  const topCategory = useMemo(() => getTopSpendingCategory(monthlySpendingByCategory), [monthlySpendingByCategory])
  const categorySuggestion = useMemo(() => {
    if (!topCategory) return null
    return suggestMonthlyCategoryLimit(monthTransactions, topCategory[0])
  }, [monthTransactions, topCategory])
  const selectedKidName = selectedKid?.users?.full_name || 'Your kid'
  const coachStatus = goalNudges[0]?.severity === 'over'
    ? 'Needs attention'
    : weeklyVelocity?.direction === 'up'
      ? 'Watch spending'
      : 'Healthy rhythm'
  const heroAccent = goalNudges[0]?.severity === 'over' ? Colors.error : Colors.primary
  const recentUpdates = useMemo(() => {
    const items: Array<{ key: string; title: string; subtitle: string }> = []

    if (goalNudges[0]) {
      items.push({
        key: `nudge-${goalNudges[0].category}`,
        title: goalNudges[0].title,
        subtitle: goalNudges[0].action,
      })
    }

    transactions.slice(0, 2).forEach((transaction) => {
      items.push({
        key: transaction.id,
        title: transaction.merchant_name || formatCategoryLabel(transaction.category),
        subtitle: `${formatCategoryLabel(transaction.category)} · ${Number(transaction.amount) < 0 ? '+' : '-'}$${Math.abs(Number(transaction.amount)).toFixed(2)}`,
      })
    })

    if (items.length === 0) {
      items.push({
        key: 'empty',
        title: 'No updates yet',
        subtitle: 'Once transactions sync, you’ll see the latest activity here.',
      })
    }

    return items.slice(0, 3)
  }, [goalNudges, transactions])
  const overviewRecommendation = goalNudges[0]
    ? {
        eyebrow: goalNudges[0].severity === 'over' ? 'NEEDS ATTENTION' : 'COACHING MOVE',
        title: goalNudges[0].title,
        body: goalNudges[0].action,
      }
    : categorySuggestion
      ? {
          eyebrow: 'COACHING MOVE',
          title: `Consider a ${formatCategoryLabel(categorySuggestion.category)} cap`,
          body: `That category is projected around $${categorySuggestion.projectedSpend.toFixed(2)} this month. A helpful limit would be about $${categorySuggestion.suggestedLimit.toFixed(2)}.`,
        }
      : null

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
        <View style={styles.heroCard}>
          <View style={[styles.heroAccent, { backgroundColor: heroAccent }]} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>COACHING VIEW</Text>
              <Text style={styles.heroTitle}>{selectedKidName}</Text>
              <Text style={styles.heroSubtitle}>A premium snapshot of money in motion, goals, and next best coaching move.</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>STATUS</Text>
              <Text style={styles.heroPillValue}>{coachStatus}</Text>
            </View>
          </View>

          <View style={styles.heroMetricsRow}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>MONTH SPEND</Text>
              <Text style={styles.heroMetricValue}>${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>TOP CATEGORY</Text>
              <Text style={styles.heroMetricValueSmall}>{topCategory ? formatCategoryLabel(topCategory[0]) : 'Waiting for data'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'coaching', label: 'Coaching' },
            { key: 'activity', label: 'Activity' },
          ].map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key as typeof activeTab)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.tabCaption}>
          {activeTab === 'overview' ? 'Overview' : activeTab === 'coaching' ? 'Coaching' : 'Activity'}
        </Text>

        {activeTab === 'overview' && (
          <>
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
                <Text style={styles.emptyTitle}>No connected kids yet</Text>
                <Text style={styles.emptyTxt}>Search for a kid’s username above to send a request. Once connected, you’ll see recent updates and coaching recommendations here.</Text>
                <View style={styles.emptyChecklist}>
                  <Text style={styles.emptyChecklistItem}>1. Search by username</Text>
                  <Text style={styles.emptyChecklistItem}>2. Send a connection request</Text>
                  <Text style={styles.emptyChecklistItem}>3. Review updates and coaching</Text>
                </View>
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
                  <View style={[styles.summaryGlow, { backgroundColor: heroAccent }]} />
                  <View>
                    <Text style={styles.summaryName}>{selectedKid?.users?.full_name}</Text>
                    <Text style={styles.summaryLabel}>CONNECTION SNAPSHOT</Text>
                  </View>
                  <View style={styles.summaryRight}>
                    <Text style={styles.summaryAmount}>{connections.length}</Text>
                    <Text style={styles.summaryRightLabel}>Kids</Text>
                  </View>
                </View>

                <View style={styles.recentUpdatesCard}>
                  <View style={styles.recentHeader}>
                    <Text style={styles.sectionTitle}>RECENT UPDATES</Text>
                    <Text style={styles.recentCount}>{recentUpdates.length}</Text>
                  </View>
                  {recentUpdates.map((item) => (
                    <View key={item.key} style={styles.recentItem}>
                      <View style={styles.recentDot} />
                      <View style={styles.recentBody}>
                        <Text style={styles.recentTitle}>{item.title}</Text>
                        <Text style={styles.recentSubtitle}>{item.subtitle}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {overviewRecommendation && (
                  <View style={styles.recommendationCard}>
                    <Text style={styles.recommendationEyebrow}>{overviewRecommendation.eyebrow}</Text>
                    <Text style={styles.recommendationTitle}>{overviewRecommendation.title}</Text>
                    <Text style={styles.recommendationBody}>{overviewRecommendation.body}</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'coaching' && (
          <>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>WEEK TREND</Text>
                <Text style={styles.kpiValue}>
                  {weeklyVelocity
                    ? weeklyVelocity.direction === 'up'
                      ? `+${((weeklyVelocity.difference / Math.max(weeklyVelocity.previousTotal, 1)) * 100).toFixed(0)}%`
                      : weeklyVelocity.direction === 'down'
                        ? `-${((Math.abs(weeklyVelocity.difference) / Math.max(weeklyVelocity.previousTotal, 1)) * 100).toFixed(0)}%`
                        : 'Flat'
                    : '—'}
                </Text>
                <Text style={styles.kpiSub}>{weeklyVelocity ? 'vs previous 7 days' : 'Needs more data'}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>NET FLOW</Text>
                <Text style={styles.kpiValue}>{cashflowSnapshot.net >= 0 ? '+' : '-'}${Math.abs(cashflowSnapshot.net).toFixed(2)}</Text>
                <Text style={styles.kpiSub}>money in less out</Text>
              </View>
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
                        <Text style={styles.goalCategory}>{formatCategoryLabel(goal.category)}</Text>
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

            <Text style={styles.sectionTitle}>WATCHLIST</Text>
            <View style={styles.coachingCardSecondary}>
              <Text style={styles.coachingEyebrow}>WHAT NEEDS ATTENTION FIRST</Text>
              {goalNudges.length > 0 ? (
                goalNudges.slice(0, 2).map((nudge) => (
                  <View key={nudge.category} style={styles.watchlistItem}>
                    <View style={styles.watchlistBullet} />
                    <View style={styles.watchlistBody}>
                      <Text style={styles.watchlistTitle}>{nudge.title}</Text>
                      <Text style={styles.watchlistText}>{nudge.action}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.coachingBody}>No urgent watchlist items yet. Savva will surface one once a category starts moving faster than expected.</Text>
              )}
            </View>

            <View style={styles.coachingCard}>
              <Text style={styles.coachingEyebrow}>NEXT COACHING MOVE</Text>
              <Text style={styles.coachingTitle}>
                {goalNudges.length > 0
                  ? goalNudges[0].title
                  : categorySuggestion
                    ? `Consider a ${formatCategoryLabel(categorySuggestion.category)} cap`
                    : 'No watchlist yet'}
              </Text>
              <Text style={styles.coachingBody}>
                {goalNudges.length > 0
                  ? goalNudges[0].message
                  : categorySuggestion
                    ? `That category is on pace for about $${categorySuggestion.projectedSpend.toFixed(2)} this month. A good coaching target would be around $${categorySuggestion.suggestedLimit.toFixed(2)}.`
                    : 'Once more spending comes in, Savva will suggest a category to watch.'}
              </Text>
            </View>
          </>
        )}

        {activeTab === 'activity' && (
          <>
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
  tabBar: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.full, padding: 4, borderWidth: 1, borderColor: Colors.border },
  tabButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, alignItems: 'center', backgroundColor: 'transparent' },
  tabButtonActive: { backgroundColor: Colors.primary },
  tabButtonText: { color: Colors.textSecondary, fontSize: Typography.caption, fontWeight: '800' },
  tabButtonTextActive: { color: Colors.textPrimary },
  tabCaption: { color: Colors.textMuted, fontSize: Typography.caption, fontWeight: '700', marginBottom: Spacing.md, marginTop: 2, paddingLeft: 6 },
  heroCard: { backgroundColor: Colors.cardBackgroundAlt, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.large },
  heroAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  heroCopy: { flex: 1 },
  heroEyebrow: { color: Colors.textSecondary, fontSize: Typography.caption, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  heroTitle: { color: Colors.textPrimary, fontSize: Typography.h4, fontWeight: '900', marginBottom: 4 },
  heroSubtitle: { color: Colors.textSecondary, fontSize: Typography.bodySmall, lineHeight: 20 },
  heroPill: { backgroundColor: Colors.background, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'flex-end' },
  heroPillLabel: { color: Colors.textMuted, fontSize: Typography.tiny, fontWeight: '900', letterSpacing: 1 },
  heroPillValue: { color: Colors.textPrimary, fontSize: Typography.bodySmall, fontWeight: '800', marginTop: 2 },
  heroMetricsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  heroMetric: { flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  heroMetricLabel: { color: Colors.textMuted, fontSize: Typography.tiny, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  heroMetricValue: { color: Colors.textPrimary, fontSize: Typography.h4, fontWeight: '900' },
  heroMetricValueSmall: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '800' },
  emptyCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
  emptyTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  emptyTxt: { color: Colors.textMuted, fontSize: Typography.bodySmall, textAlign: 'center' },
  emptyChecklist: { marginTop: Spacing.md, width: '100%' },
  emptyChecklistItem: { color: Colors.textSecondary, fontSize: Typography.bodySmall, fontWeight: '700', marginBottom: 6, textAlign: 'left' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.large },
  summaryGlow: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 6, opacity: 0.9 },
  summaryName: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  summaryLabel: { fontSize: Typography.tiny, color: Colors.textSecondary, fontWeight: '900', letterSpacing: 1 },
  summaryAmount: { fontSize: Typography.h3, fontWeight: '900', color: Colors.textPrimary },
  summaryRight: { alignItems: 'flex-end' },
  summaryRightLabel: { color: Colors.textSecondary, fontSize: Typography.tiny, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  kpiCard: { flex: 1, backgroundColor: Colors.cardBackgroundAlt, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  kpiLabel: { color: Colors.textMuted, fontSize: Typography.tiny, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  kpiValue: { color: Colors.textPrimary, fontSize: Typography.h4, fontWeight: '900', marginBottom: 4 },
  kpiSub: { color: Colors.textSecondary, fontSize: Typography.caption, fontWeight: '600' },
  sectionTitle: { fontSize: Typography.caption, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: Spacing.md, marginTop: Spacing.xs },
  goalCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  goalCategory: { fontSize: Typography.bodySmall, fontWeight: '800', color: Colors.textPrimary },
  goalStatus: { fontSize: Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },
  overLimit: { color: Colors.error },
  progressBg: { height: 8, backgroundColor: Colors.progressBackground, borderRadius: 10, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 10 },
  coachingCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  coachingCardSecondary: { backgroundColor: Colors.cardBackgroundAlt, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  coachingEyebrow: { fontSize: Typography.tiny, fontWeight: '900', color: Colors.textSecondary, letterSpacing: 1, marginBottom: 6 },
  coachingTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  coachingBody: { fontSize: Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  watchlistItem: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'flex-start' },
  watchlistBullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 6 },
  watchlistBody: { flex: 1 },
  watchlistTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.bodySmall, marginBottom: 2 },
  watchlistText: { color: Colors.textSecondary, fontSize: Typography.caption, lineHeight: 18 },
  recentUpdatesCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  recentCount: { color: Colors.textSecondary, fontSize: Typography.caption, fontWeight: '900' },
  recentItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  recentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  recentBody: { flex: 1 },
  recentTitle: { color: Colors.textPrimary, fontSize: Typography.bodySmall, fontWeight: '800', marginBottom: 2 },
  recentSubtitle: { color: Colors.textSecondary, fontSize: Typography.caption, lineHeight: 18 },
  recommendationCard: { backgroundColor: Colors.cardBackgroundAlt, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadows.small },
  recommendationEyebrow: { color: Colors.textMuted, fontSize: Typography.tiny, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  recommendationTitle: { color: Colors.textPrimary, fontSize: Typography.bodySmall, fontWeight: '900', marginBottom: 4 },
  recommendationBody: { color: Colors.textSecondary, fontSize: Typography.bodySmall, lineHeight: 20 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: Typography.bodySmall, fontWeight: '600', color: Colors.textPrimary },
  txCategory: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary },
  positive: { color: Colors.success },
  signOutBtn: { alignSelf: 'flex-end', padding: Spacing.sm, marginTop: Spacing.xl },
  signOutTxt: { color: Colors.error, fontWeight: '700', fontSize: Typography.bodySmall },
})
