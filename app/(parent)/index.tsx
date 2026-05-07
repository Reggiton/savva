import { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../../lib/supabase'

type Kid = { id: string; full_name: string; username: string }
type Connection = {
  id: string
  child_id: string
  visibility_enabled: boolean
  users: { full_name: string; username: string }
}

export default function ParentHome() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Kid[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        fetchConnections(user.id)
      }
    })
  }, [])

  async function fetchConnections(uid: string) {
    const { data } = await supabase
      .from('parent_child_connections')
      .select('id, child_id, visibility_enabled, users!child_id(full_name, username)')
      .eq('parent_id', uid)
      .eq('status', 'active')
    if (data) setConnections(data as any)
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to a kid</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by username"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={searchKids}>
          <Text style={styles.searchTxt}>Search</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
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

      <Text style={styles.sectionTitle}>Connected kids</Text>
      {connections.length === 0 ? (
        <Text style={styles.empty}>No connected kids yet.</Text>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.users?.full_name}</Text>
              <Text style={styles.username}>@{item.users?.username}</Text>
              <Text style={styles.visibility}>
                Visibility: {item.visibility_enabled ? 'On' : 'Off'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  searchBtn: { backgroundColor: '#000', borderRadius: 8, padding: 12, justifyContent: 'center' },
  searchTxt: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 14, color: '#666', marginBottom: 8 },
  requestBtn: { backgroundColor: '#000', borderRadius: 8, padding: 8, alignItems: 'center' },
  requestTxt: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 16 },
  empty: { color: '#999', fontSize: 14 },
  visibility: { fontSize: 13, color: '#666' },
  signOutBtn: { alignSelf: 'flex-end', padding: 8 },
  signOutTxt: { color: '#ff3b30', fontWeight: '600' },
})