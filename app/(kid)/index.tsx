import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView, Animated, Platform, Pressable, Easing } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { createLinkToken } from '../../lib/plaid'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import Header from '../../components/Header'
import SpendingPieChart, { SpendingSlice } from '../../components/SpendingPieChart'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../lib/theme'
import { formatCategoryLabel, getGoalNudges, getMoneyInTotal, getMonthStartDateString, getSpendingByCategory, isEverydaySpending, SpendingGoal } from '../../lib/spending'
import { trackEvent } from '../../lib/metrics'

type Transaction = {
  id: string
  merchant_name: string
  category: string
  amount: number
  transaction_date: string
}

export default function KidDashboard() {
  const router = useRouter()
  const insightTransition = useRef(new Animated.Value(0)).current
  const insightIdle = useRef(new Animated.Value(0)).current
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('User')
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<SpendingGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [chartSelectedIndex, setChartSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(insightIdle, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(insightIdle, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )

    loop.start()
    return () => loop.stop()
  }, [insightIdle])

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          return
        }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('full_name, username')
        .eq('id', user.id)
        .maybeSingle()

      setUserName(
        (user.user_metadata?.full_name as string) ||
        profile?.full_name ||
        (user.user_metadata?.username as string) ||
        profile?.username ||
        'User'
      )
      setProfilePicUrl((user.user_metadata?.profile_pic_url as string) || '')
      await fetchUnreadNotificationCount(user.id)

      const connected = await checkAccount(user.id)

      await fetchGoals(user.id)

      await trackEvent('dashboard_viewed', {
        role: 'kid',
        connected_account: connected,
      })

        if (connected) {
          await syncTransactions(user.id)
          await fetchTransactions(user.id)
          setLastSyncedAt(new Date().toISOString())
        }

        const token = await createLinkToken(user.id)
        if (token) setLinkToken(token)
      } catch (error) {
        console.log('dashboard load error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  useFocusEffect(
    useCallback(() => {
      async function loadUnreadCount() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await fetchUnreadNotificationCount(user.id)
      }

      loadUnreadCount()
    }, [])
  )

  async function fetchUnreadNotificationCount(uid: string) {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('read', false)

      setUnreadNotificationCount(count ?? 0)
    } catch (err) {
      console.error('fetchUnreadNotificationCount error:', err)
    }
  }

  async function checkAccount(uid: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('plaid_accounts')
        .select('id')
        .eq('user_id', uid)
        .single()
      setHasAccount(!!data)
      return !!data
    } catch (err) {
      console.error('checkAccount error:', err)
      return false
    }
  }

  async function handleRefresh() {
    await trackEvent('refresh_requested', { role: 'kid' })
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        await syncTransactions(user.id)
        await fetchTransactions(user.id)
        await fetchGoals(user.id)
        await fetchUnreadNotificationCount(user.id)
        await trackEvent('refresh_completed', { role: 'kid', success: true })
      }
    } catch (err) {
      console.error('refresh error:', err)
      await trackEvent('refresh_completed', { role: 'kid', success: false })
      Alert.alert('Refresh failed', 'Unable to refresh dashboard. Please try again.')
    }
  }

  async function syncTransactions(uid: string) {
    setSyncing(true)
    await trackEvent('refresh_requested', { role: 'kid', source: 'sync' })
    try {
      const { error } = await supabase.functions.invoke('sync-transactions', {
        body: { user_id: uid },
      })
      if (error) {
        console.error('sync error:', error)
        Alert.alert('Sync failed', 'There was a problem syncing transactions.')
      } else {
        setLastSyncedAt(new Date().toISOString())
      }
    } finally {
      setSyncing(false)
    }
  }

  async function fetchTransactions(uid: string) {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('id, merchant_name, category, amount, transaction_date')
        .eq('user_id', uid)
        .gte('transaction_date', getMonthStartDateString())
        .order('transaction_date', { ascending: false })
      if (data) setTransactions(data)
    } catch (err) {
      console.error('fetchTransactions error:', err)
    }
  }

  async function fetchGoals(uid: string) {
    try {
      const { data } = await supabase
        .from('goals')
        .select('category, monthly_limit')
        .eq('user_id', uid)

      setGoals((data || []) as SpendingGoal[])
    } catch (err) {
      console.error('fetchGoals error:', err)
    }
  }

  async function openPlaidLink() {
    console.log('button pressed, linkToken:', linkToken)
    if (!linkToken) return
    if (Platform.OS === 'web') {
      Alert.alert('Bank linking is only available in the mobile app.')
      return
    }
    try {
      await trackEvent('bank_link_started', { role: 'kid' })
      const {
        create,
        open,
      } = require('react-native-plaid-link-sdk') as typeof import('react-native-plaid-link-sdk')

      console.log('calling create...')
      const tokenConfig = { token: linkToken }
      await create(tokenConfig)

      console.log('calling open...')
      open({
        onSuccess: async (success) => {
          try {
            const { error } = await supabase.functions.invoke('exchange-public-token', {
              body: {
                public_token: success.publicToken,
                user_id: userId,
                institution_name: success.metadata.institution?.name,
              },
            })
            if (error) {
              Alert.alert('Error', 'Failed to connect bank account.')
              return
            }
            setHasAccount(true)
            await trackEvent('bank_link_completed', { role: 'kid' })
            if (userId) {
              await syncTransactions(userId)
              await fetchTransactions(userId)
            }
            Alert.alert('Success', 'Bank account connected!')
          } catch (err) {
            console.error('onSuccess handler error:', err)
            Alert.alert('Error', 'Unexpected error while connecting bank account.')
          }
        },
        onExit: (exit) => console.log('exit:', exit),
      })
    } catch (err) {
      console.error('openPlaidLink error:', err)
      Alert.alert('Error', 'Unable to start bank linking. Please try again later.')
    }
  }

  function openInsights() {
    trackEvent('insights_opened', { role: 'kid' })
    insightTransition.setValue(0)
    Animated.timing(insightTransition, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => router.push('/(kid)/insights' as any))
  }

  const expenseTransactions = transactions.filter(isEverydaySpending)
  const spendingColors = ['#6F55F2', '#2D185F', '#9B7BFF', '#4A2DB4', '#C3B0FF', '#1D123E', '#7D3FE8']
  const spendingByCategory = useMemo(() => getSpendingByCategory(expenseTransactions), [expenseTransactions])
  const goalNudges = useMemo(() => getGoalNudges(goals, spendingByCategory), [goals, spendingByCategory])
  const spendingSlices: SpendingSlice[] = Object.values(
    expenseTransactions.reduce<Record<string, SpendingSlice>>((acc, transaction) => {
      const category = transaction.category || 'OTHER'
      const existing = acc[category]

      if (existing) {
        existing.amount += Number(transaction.amount)
      } else {
        const color = spendingColors[Object.keys(acc).length % spendingColors.length]
        acc[category] = { category, amount: Number(transaction.amount), color }
      }

      return acc
    }, {})
  ).sort((a, b) => b.amount - a.amount)
  const topSpendingSlice = spendingSlices[0]
  const moneyInTotal = getMoneyInTotal(transactions)
  const topGoalNudge = goalNudges[0]
  const broadInsight = topGoalNudge
    ? `${topGoalNudge.title}. ${topGoalNudge.action}`
    : topSpendingSlice
      ? `${formatCategoryLabel(topSpendingSlice.category)} is your biggest spending area this month. Check your insights for a broader pattern.`
      : 'Connect an account and spend a little more to unlock a broad monthly insight.'
  const backLayerTransform = {
    transform: [
      { translateX: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
      { translateY: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) },
      { rotate: insightTransition.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '0deg'] }) },
      { translateY: insightIdle.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
    ],
  }
  const midLayerTransform = {
    transform: [
      { translateX: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
      { translateY: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) },
      { rotate: insightTransition.interpolate({ inputRange: [0, 1], outputRange: ['3deg', '0deg'] }) },
      { translateY: insightIdle.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
    ],
  }
  const insightCardTransform = {
    transform: [
      { translateY: insightIdle.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
      { scale: insightIdle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] }) },
    ],
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Header
        userName={userName}
        profilePicUrl={profilePicUrl}
        onProfilePress={() => router.push('/(kid)/settings' as any)}
        onNotificationsPress={() => router.push('/(kid)/notifications' as any)}
        unreadNotificationCount={unreadNotificationCount}
      />

      <RefreshableScrollView onRefresh={handleRefresh} contentContainerStyle={styles.scrollContent}>
        {!hasAccount && (
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingEyebrow}>FIRST STEP</Text>
            <Text style={styles.onboardingTitle}>Connect a bank account</Text>
            <Text style={styles.onboardingText}>
              Savva becomes useful once it can show your spending, surface an insight, and help you set a goal.
            </Text>
            <View style={styles.onboardingChecklist}>
              <Text style={styles.onboardingItem}>1. Connect your bank</Text>
              <Text style={styles.onboardingItem}>2. Review the home chart</Text>
              <Text style={styles.onboardingItem}>3. Open insights for advice</Text>
              <Text style={styles.onboardingItem}>4. Set your first goal</Text>
            </View>
            {linkToken ? (
              <TouchableOpacity style={styles.connectBtn} onPress={openPlaidLink}>
                <Text style={styles.connectTxt}>Connect bank account</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.connectDisabled}>
                <Text style={styles.connectDisabledText}>Linking is loading right now. Try again in a moment.</Text>
              </View>
            )}
          </View>
        )}

        {hasAccount ? (
          <>
            <Pressable style={styles.progressContainer} onPress={() => setChartSelectedIndex(null)}>
              <SpendingPieChart
                slices={spendingSlices}
                size={212}
                selectedIndex={chartSelectedIndex}
                onSelect={(i) => setChartSelectedIndex(i)}
              />
            </Pressable>

            <TouchableOpacity style={styles.insightStack} onPress={openInsights} activeOpacity={0.85}>
              <Animated.View style={[styles.insightLayer, styles.insightLayerBack, backLayerTransform]} />
              <Animated.View style={[styles.insightLayer, styles.insightLayerMid, midLayerTransform]} />
              <Animated.View style={[styles.insightCard, insightCardTransform]}>
                <Text style={styles.insightLabel}>{topGoalNudge ? 'GOAL NUDGE' : 'INSIGHT'}</Text>
                <Text style={styles.insightText}>{broadInsight}</Text>
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.moneyInCard}>
              <View>
                <Text style={styles.moneyInLabel}>MONEY IN</Text>
                <Text style={styles.moneyInSubtitle}>This month</Text>
              </View>
              <Text style={styles.moneyInAmount}>
                +${moneyInTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>

            <View style={styles.syncCard}>
              <View>
                <Text style={styles.syncLabel}>SYNC STATUS</Text>
                <Text style={styles.syncValue}>{syncing ? 'Updating now' : 'Up to date'}</Text>
              </View>
              <Text style={styles.syncMeta}>
                {lastSyncedAt ? `Last updated ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'No sync yet'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
              <TouchableOpacity onPress={handleRefresh} disabled={syncing}>
                <Text style={styles.refresh}>{syncing ? 'Syncing...' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>

            {transactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.empty}>No transactions yet.</Text>
              </View>
            ) : (
              transactions.map((item) => (
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
        ) : (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>No bank account connected yet</Text>
            <Text style={styles.summaryText}>
              Connect your bank account to see your dashboard.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={async () => {
            try {
              const { error } = await supabase.auth.signOut()
              if (error) {
                console.error('signOut error:', error)
                Alert.alert('Sign out failed', 'Please try again.')
              }
            } catch (err) {
              console.error('signOut exception:', err)
              Alert.alert('Sign out failed', 'Please try again.')
            }
          }}
        >
          <Text style={styles.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </RefreshableScrollView>
    </SafeAreaView>
  )
}

function formatCategory(category: string) {
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const insightBorderColor = Colors.primary

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  progressContainer: { alignItems: 'center' },
  insightStack: {
    minHeight: 154,
    marginBottom: Spacing.xl,
    justifyContent: 'flex-start',
  },
  insightLayer: {
    position: 'absolute',
    left: 10,
    right: 0,
    top: 12,
    height: 118,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: insightBorderColor,
    backgroundColor: Colors.cardBackground,
  },
  insightLayerBack: {
    transform: [{ rotate: '6deg' }],
    top: 28,
    left: 22,
  },
  insightLayerMid: {
    transform: [{ rotate: '3deg' }],
    top: 20,
    left: 16,
  },
  insightCard: {
    minHeight: 118,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: insightBorderColor,
    backgroundColor: Colors.cardBackgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    ...Shadows.medium,
  },
  insightLabel: {
    color: Colors.primaryLight,
    fontSize: Typography.caption,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  insightText: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySmall,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  moneyInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  moneyInLabel: { color: Colors.success, fontSize: Typography.caption, fontWeight: '900', letterSpacing: 1 },
  moneyInSubtitle: { color: Colors.textSecondary, fontSize: Typography.bodySmall, marginTop: 4 },
  moneyInAmount: { color: Colors.success, fontSize: Typography.h4, fontWeight: '900' },
  syncCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  syncLabel: { color: Colors.textMuted, fontSize: Typography.tiny, fontWeight: '900', letterSpacing: 1 },
  syncValue: { color: Colors.textPrimary, fontSize: Typography.bodySmall, fontWeight: '800', marginTop: 2 },
  syncMeta: { color: Colors.textSecondary, fontSize: Typography.caption, fontWeight: '600', textAlign: 'right', maxWidth: 160 },
  connectBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  connectTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.body },
  connectDisabled: {
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  connectDisabledText: { color: Colors.textSecondary, fontSize: Typography.bodySmall, textAlign: 'center' },
  onboardingCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  onboardingEyebrow: { color: Colors.textMuted, fontSize: Typography.tiny, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  onboardingTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '900', marginBottom: 4 },
  onboardingText: { color: Colors.textSecondary, fontSize: Typography.bodySmall, lineHeight: 20, marginBottom: Spacing.md },
  onboardingChecklist: { marginBottom: Spacing.md },
  onboardingItem: { color: Colors.textPrimary, fontSize: Typography.bodySmall, fontWeight: '700', marginBottom: 6 },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  summaryLabel: { fontSize: Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: Spacing.xs },
  summaryText: { fontSize: Typography.bodySmall, color: Colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: Typography.caption, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.2 },
  refresh: { color: Colors.primary, fontSize: Typography.bodySmall, fontWeight: '600' },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: Typography.bodySmall, fontWeight: '600', color: Colors.textPrimary },
  txCategory: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary },
  emptyCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center' },
  empty: { color: Colors.textMuted, fontSize: Typography.bodySmall, textAlign: 'center' },
  signOutBtn: { alignSelf: 'flex-end', padding: Spacing.sm, marginTop: Spacing.lg },
  positive: { color: Colors.success },
  signOutTxt: { color: Colors.error, fontWeight: '700' },
})
