import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { create, open, LinkSuccess, LinkExit, LinkTokenConfiguration } from 'react-native-plaid-link-sdk'
import { supabase } from '../../lib/supabase'
import { createLinkToken } from '../../lib/plaid'

export default function KidDashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        checkAccount(user.id)
        const token = await createLinkToken(user.id)
        console.log('link token:', token)
        if (token) {
          setLinkToken(token)
        }
      }
    })
  }, [])

  async function checkAccount(uid: string) {
    const { data } = await supabase
      .from('plaid_accounts')
      .select('id')
      .eq('user_id', uid)
      .single()
    setHasAccount(!!data)
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
        console.log('success:', success)
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
        Alert.alert('Success', 'Bank account connected!')
      },
      onExit: (exit: LinkExit) => {
        console.log('exit:', JSON.stringify(exit))
      },
    })
    console.log('open called')
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
        <Text style={styles.connected}>Bank account connected</Text>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutTxt}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 24 },
  connectBtn: { backgroundColor: '#000', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  connectTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
  connected: { color: 'green', fontSize: 16, marginBottom: 16 },
  signOutBtn: { alignSelf: 'flex-end', padding: 8 },
  signOutTxt: { color: '#ff3b30', fontWeight: '600' },
})