import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native'
import { create, open, LinkSuccess, LinkExit, LinkTokenConfiguration } from 'react-native-plaid-link-sdk'
import { supabase } from '../../lib/supabase'
import { createLinkToken } from '../../lib/plaid'

type Transaction = {
  id: string
  merchant_name: string
  category: string
  amount: number
  transaction_date: string
}

export default function KidDashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        const connected = await checkAccount(user.id)
        if (connected) {
          await syncTransactions(user.id)
          await fetchTransactions(user.id)
        }
        const token = await createLinkToken(user.id)
        if (token) setLinkToken(token)
        setLoading(false)
      }
    })
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

  async function syncTransactions(uid: string) {
    setSyncing(true)
    const { error } = await supabase.functions.invoke('sync-transactions', {
      body: { user_id: uid },
    })
    if (error) console.log('sync error:', error)
    setSyncing(false)
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>

      {!hasAccount && linkToken && (
        <TouchableOpacity style={styles.connectBtn} onPress={openPlaidLink}>
          <Text style={styles.connectTxt}>Connect bank account</Text>
        </TouchableOpacity>
      )}

      {hasAccount && (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total spent this month</Text>
            <Text style={styles.summaryAmount}>${totalSpent.toFixed(2)}</Text>
            {syncing && <Text style={styles.syncing}>Syncing...</Text>}
          </View>

          <View style={styles.row}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <TouchableOpacity onPress={() => userId && syncTransactions(userId).then(() => fetchTransactions(userId!))}>
              <Text style={styles.refresh}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={transactions}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.txCard}>
                <View style={styles.txLeft}>
                  <Text style={styles.txMerchant}>{item.merchant_name}</Text>
                  <Text style={styles.txCategory}>{item.category}</Text>
                </View>
                <Text style={styles.txAmount}>${item.amount.toFixed(2)}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
          />
        </>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutTxt}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  connectBtn: { backgroundColor: '#000', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  connectTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
  summaryCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 16 },
  summaryLabel: { fontSize: 14, color: '#666', marginBottom: 4 },
  summaryAmount: { fontSize: 32, fontWeight: '700' },
  syncing: { fontSize: 12, color: '#999', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  refresh: { color: '#007AFF', fontSize: 14 },
  txCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: 15, fontWeight: '500' },
  txCategory: { fontSize: 13, color: '#999', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '600' },
  empty: { color: '#999', fontSize: 14, textAlign: 'center', marginTop: 24 },
  signOutBtn: { alignSelf: 'flex-end', padding: 8, marginTop: 16 },
  signOutTxt: { color: '#ff3b30', fontWeight: '600' },
})