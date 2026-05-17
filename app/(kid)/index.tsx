import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView, Animated, Platform } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { createLinkToken } from '../../lib/plaid'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import Header from '../../components/Header'
import SpendingPieChart, { SpendingSlice } from '../../components/SpendingPieChart'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../lib/theme'
import { getMoneyInTotal, getMonthStartDateString, isEverydaySpending } from '../../lib/spending'

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
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('User')
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

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

        if (connected) {
          await syncTransactions(user.id)
          await fetchTransactions(user.id)
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
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('read', false)

    setUnreadNotificationCount(count ?? 0)
  }

  async function checkAccount(uid: string): Promise<boolean> {
    const { data } = await supabase
      .from('plaid_accounts')
      .select('id')
      .eq('user_id', uid)
      .single()
    setHasAccount(!!data)
    return !!data
  }

  async function handleRefresh() {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await syncTransactions(user.id)
      await fetchTransactions(user.id)
      await fetchUnreadNotificationCount(user.id)
    }
  }

  async function syncTransactions(uid: string) {
    setSyncing(true)
    try {
      const { error } = await supabase.functions.invoke('sync-transactions', {
        body: { user_id: uid },
      })
      if (error) console.log('sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  async function fetchTransactions(uid: string) {
    const { data } = await supabase
      .from('transactions')
      .select('id, merchant_name, category, amount, transaction_date')
      .eq('user_id', uid)
      .gte('transaction_date', getMonthStartDateString())
      .order('transaction_date', { ascending: false })
    if (data) setTransactions(data)
  }

  async function openPlaidLink() {
    console.log('button pressed, linkToken:', linkToken)
    if (!linkToken) return
    if (Platform.OS === 'web') {
      Alert.alert('Bank linking is only available in the mobile app.')
      return
    }

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
        if (userId) {
          await syncTransactions(userId)
          await fetchTransactions(userId)
        }
        Alert.alert('Success', 'Bank account connected!')
      },
      onExit: (exit) => console.log('exit:', exit),
    })
  }

  function openInsights() {
    insightTransition.setValue(0)
    Animated.timing(insightTransition, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => router.push('/(kid)/insights' as any))
  }

  const expenseTransactions = transactions.filter(isEverydaySpending)
  const spendingColors = ['#6F55F2', '#2D185F', '#9B7BFF', '#4A2DB4', '#C3B0FF', '#1D123E', '#7D3FE8']
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
  const broadInsight = topSpendingSlice
    ? `${formatCategory(topSpendingSlice.category)} is your biggest spending area this month. Check your insights for a broader pattern.`
    : 'Connect an account and spend a little more to unlock a broad monthly insight.'
  const backLayerTransform = {
    transform: [
      { translateX: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
      { translateY: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) },
      { rotate: insightTransition.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '0deg'] }) },
    ],
  }
  const midLayerTransform = {
    transform: [
      { translateX: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
      { translateY: insightTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) },
      { rotate: insightTransition.interpolate({ inputRange: [0, 1], outputRange: ['3deg', '0deg'] }) },
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
        {!hasAccount && linkToken && (
          <TouchableOpacity style={styles.connectBtn} onPress={openPlaidLink}>
            <Text style={styles.connectTxt}>Connect bank account</Text>
          </TouchableOpacity>
        )}

        {hasAccount ? (
          <>
            <View style={styles.progressContainer}>
              <SpendingPieChart slices={spendingSlices} size={212} />
            </View>

            <TouchableOpacity
              style={styles.insightStack}
              onPress={openInsights}
              activeOpacity={0.85}
            >
              <Animated.View style={[styles.insightLayer, styles.insightLayerBack, backLayerTransform]} />
              <Animated.View style={[styles.insightLayer, styles.insightLayerMid, midLayerTransform]} />
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>{broadInsight}</Text>
              </View>
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

        <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
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
  connectBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  connectTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.body },
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
