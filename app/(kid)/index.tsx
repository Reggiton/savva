import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView } from 'react-native'
import { create, open, LinkSuccess, LinkExit, LinkTokenConfiguration } from 'react-native-plaid-link-sdk'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { createLinkToken } from '../../lib/plaid'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import Header from '../../components/Header'
import StatCard from '../../components/StatCard'
import SpendingPieChart, { SpendingSlice } from '../../components/SpendingPieChart'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../lib/theme'

type Transaction = {
  id: string
  merchant_name: string
  category: string
  amount: number
  transaction_date: string
}

export default function KidDashboard() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('User')
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

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
        .single()

      if (profile?.full_name || profile?.username) {
        setUserName(profile.full_name || profile.username)
      }
      setProfilePicUrl((user.user_metadata?.profile_pic_url as string) || '')

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
      .order('transaction_date', { ascending: false })
      .limit(20)
    if (data) setTransactions(data)
  }

  async function openPlaidLink() {
    console.log('button pressed, linkToken:', linkToken)
    if (!linkToken) return

    console.log('calling create...')
    const tokenConfig: LinkTokenConfiguration = { token: linkToken }
    await create(tokenConfig)

    console.log('calling open...')
    open({
      onSuccess: async (success: LinkSuccess) => {
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
      onExit: (exit: LinkExit) => console.log('exit:', exit),
    })
  }

  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0)
  const excludedSpendingCategories = ['TRANSFER_OUT', 'TRANSFER_IN', 'LOAN_PAYMENTS', 'BANK_FEES']
  const transferOutTotal = transactions
    .filter((transaction) => transaction.category === 'TRANSFER_OUT')
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0)
  const expenseTransactions = transactions.filter((transaction) => {
    const amount = Number(transaction.amount)
    const category = transaction.category || ''

    return amount > 0 && !excludedSpendingCategories.includes(category)
  })
  const spendingTotal = expenseTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0)
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

            <View style={styles.statsRow}>
              <StatCard
                label="Spent"
                value={`$${Math.abs(spendingTotal).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                subtitle="this month"
              />
              <View style={styles.statGap} />
              <StatCard
                label="Transfers Out"
                value={`$${transferOutTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                subtitle="moved out"
                variant="primary"
                onInfoPress={() =>
                  Alert.alert(
                    'Transfers Out',
                    'Transfers Out is money that moved out of your account, such as moving money to another account, paying a credit card, or sending money externally. Savva keeps it separate from everyday spending so your chart focuses on purchases like food, transportation, shopping, and entertainment.'
                  )
                }
              />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  progressContainer: { alignItems: 'center' },
  statsRow: { flexDirection: 'row', marginBottom: Spacing.xl },
  statGap: { width: Spacing.sm },
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
