import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../../lib/supabase'

type Request = {
  id: string
  parent_id: string
  status: string
  users: { full_name: string; username: string }
}

type Connection = {
  id: string
  parent_id: string
  visibility_enabled: boolean
  users: { full_name: string; username: string }
}

export default function Connections() {
  const [requests, setRequests] = useState<Request[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        fetchRequests(user.id)
        fetchConnections(user.id)
      }
    })
  }, [])

  async function fetchRequests(uid: string) {
    const { data, error } = await supabase
      .from('connection_requests')
      .select('id, parent_id, status, users!parent_id(full_name, username)')
      .eq('child_id', uid)
      .eq('status', 'pending')
    
    console.log('requests data:', JSON.stringify(data))
    console.log('requests error:', JSON.stringify(error))
    
    if (data) setRequests(data as any)
  }

  async function fetchConnections(uid: string) {
    const { data } = await supabase
      .from('parent_child_connections')
      .select('id, parent_id, visibility_enabled, users!parent_id(full_name, username)')
      .eq('child_id', uid)
      .eq('status', 'active')
    if (data) setConnections(data as any)
  }

  async function handleRequest(requestId: string, parentId: string, accept: boolean) {
    if (accept) {
      const { error: updateError } = await supabase.from('connection_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)
      console.log('update request error:', updateError)

      const { error: insertError } = await supabase.from('parent_child_connections')
        .upsert(
          { parent_id: parentId, child_id: userId, status: 'active', visibility_enabled: true },
          { onConflict: 'parent_id,child_id' }
        )

      const { error: notifError } = await supabase.from('notifications')
        .insert({ user_id: parentId, type: 'request_accepted', message: 'Your connection request was accepted.' })
      console.log('notification error:', notifError)
    } else {
      await supabase.from('connection_requests')
        .update({ status: 'declined' })
        .eq('id', requestId)
      await supabase.from('notifications')
        .insert({ user_id: parentId, type: 'request_declined', message: 'Your connection request was declined.' })
    }
    if (userId) {
      fetchRequests(userId)
      fetchConnections(userId)
    }
  }

  async function toggleVisibility(connectionId: string, current: boolean, parentId: string) {
    await supabase
      .from('parent_child_connections')
      .update({ visibility_enabled: !current })
      .eq('id', connectionId)

    await supabase
      .from('notifications')
      .insert({
        user_id: parentId,
        type: 'visibility_toggled',
        message: `Your child has turned visibility ${!current ? 'on' : 'off'}.`
      })

    if (userId) fetchConnections(userId)
  }

  async function handleRevoke(connectionId: string, parentId: string) {
    Alert.alert('Revoke access', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          await supabase.from('parent_child_connections')
            .update({ status: 'revoked' })
            .eq('id', connectionId)
          await supabase.from('notifications')
            .insert({ user_id: parentId, type: 'access_revoked', message: 'Your access has been revoked.' })
          if (userId) fetchConnections(userId)
        }
      }
    ])
  }

  async function handleBlock(parentId: string) {
    Alert.alert('Block user', 'They will be notified. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block', style: 'destructive', onPress: async () => {
          await supabase.from('blocks')
            .insert({ blocker_id: userId, blocked_id: parentId })
          await supabase.from('notifications')
            .insert({ user_id: parentId, type: 'blocked', message: 'You have been blocked from sending further requests.' })
          if (userId) fetchRequests(userId)
        }
      }
    ])
  }

  return (
    <View style={styles.container}>
      {requests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending requests</Text>
          <FlatList
            data={requests}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name}>{item.users?.full_name}</Text>
                <Text style={styles.username}>@{item.users?.username}</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRequest(item.id, item.parent_id, true)}>
                    <Text style={styles.acceptTxt}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineBtn} onPress={() => handleRequest(item.id, item.parent_id, false)}>
                    <Text style={styles.declineTxt}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.blockBtn} onPress={() => handleBlock(item.parent_id)}>
                    <Text style={styles.blockTxt}>Block</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      <Text style={styles.sectionTitle}>Connected parents</Text>
      {connections.length === 0 ? (
        <Text style={styles.empty}>No connected parents yet.</Text>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.users?.full_name}</Text>
              <Text style={styles.username}>@{item.users?.username}</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.toggleBtn, item.visibility_enabled && styles.toggleActive]}
                  onPress={() => toggleVisibility(item.id, item.visibility_enabled, item.parent_id)}
                >
                  <Text style={styles.toggleTxt}>
                    Visibility: {item.visibility_enabled ? 'On' : 'Off'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(item.id, item.parent_id)}>
                  <Text style={styles.revokeTxt}>Revoke</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 16 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 14, color: '#666', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: '#000', borderRadius: 8, padding: 8, flex: 1, alignItems: 'center' },
  acceptTxt: { color: '#fff', fontWeight: '600' },
  declineBtn: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, flex: 1, alignItems: 'center' },
  declineTxt: { color: '#333' },
  blockBtn: { borderWidth: 1, borderColor: '#ff3b30', borderRadius: 8, padding: 8, flex: 1, alignItems: 'center' },
  blockTxt: { color: '#ff3b30' },
  toggleBtn: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, flex: 1, alignItems: 'center' },
  toggleActive: { backgroundColor: '#000', borderColor: '#000' },
  toggleTxt: { color: '#333' },
  revokeBtn: { borderWidth: 1, borderColor: '#ff3b30', borderRadius: 8, padding: 8, flex: 1, alignItems: 'center' },
  revokeTxt: { color: '#ff3b30' },
  empty: { color: '#999', fontSize: 14 },
})