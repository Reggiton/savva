import { useEffect, useState } from 'react'
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import { supabase } from '../../lib/supabase'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

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
    async function loadConnections() {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)
        await fetchRequests(user.id)
        await fetchConnections(user.id)
      }
    }

    loadConnections()
  }, [])

  async function onRefresh() {
    if (!userId) return

    await fetchRequests(userId)
    await fetchConnections(userId)
  }

  async function fetchRequests(uid: string) {
    const { data } = await supabase
      .from('connection_requests')
      .select('id, parent_id, status, users!parent_id(full_name, username)')
      .eq('child_id', uid)
      .eq('status', 'pending')

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
      await supabase.from('connection_requests').update({ status: 'accepted' }).eq('id', requestId)
      await supabase
        .from('parent_child_connections')
        .upsert(
          { parent_id: parentId, child_id: userId, status: 'active', visibility_enabled: true },
          { onConflict: 'parent_id,child_id' }
        )
      await supabase
        .from('notifications')
        .insert({ user_id: parentId, type: 'request_accepted', message: 'Your connection request was accepted.' })
    } else {
      await supabase.from('connection_requests').update({ status: 'declined' }).eq('id', requestId)
      await supabase
        .from('notifications')
        .insert({ user_id: parentId, type: 'request_declined', message: 'Your connection request was declined.' })
    }

    if (userId) await onRefresh()
  }

  async function toggleVisibility(connectionId: string, current: boolean, parentId: string) {
    await supabase
      .from('parent_child_connections')
      .update({ visibility_enabled: !current })
      .eq('id', connectionId)

    await supabase.from('notifications').insert({
      user_id: parentId,
      type: 'visibility_toggled',
      message: `Your child has turned visibility ${!current ? 'on' : 'off'}.`,
    })

    if (userId) await fetchConnections(userId)
  }

  async function handleRevoke(connectionId: string, parentId: string) {
    Alert.alert('Revoke access', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('parent_child_connections').update({ status: 'revoked' }).eq('id', connectionId)
          await supabase
            .from('notifications')
            .insert({ user_id: parentId, type: 'access_revoked', message: 'Your access has been revoked.' })
          if (userId) await fetchConnections(userId)
        },
      },
    ])
  }

  async function handleBlock(parentId: string) {
    Alert.alert('Block user', 'They will be notified. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: parentId })
          await supabase
            .from('notifications')
            .insert({ user_id: parentId, type: 'blocked', message: 'You have been blocked from sending further requests.' })
          if (userId) await fetchRequests(userId)
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <RefreshableScrollView onRefresh={onRefresh} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRUSTED ACCESS</Text>
          <Text style={styles.title}>Connections</Text>
          <Text style={styles.subtitle}>Manage parent requests and account visibility.</Text>
        </View>

        <Text style={styles.sectionTitle}>Pending requests</Text>
        {requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>No pending requests.</Text>
          </View>
        ) : (
          requests.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.users?.full_name || 'Parent'}</Text>
              <Text style={styles.username}>@{item.users?.username || 'unknown'}</Text>
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
          ))
        )}

        <Text style={styles.sectionTitle}>Connected parents</Text>
        {connections.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>No connected parents yet.</Text>
          </View>
        ) : (
          connections.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.users?.full_name || 'Parent'}</Text>
              <Text style={styles.username}>@{item.users?.username || 'unknown'}</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.toggleBtn, item.visibility_enabled && styles.toggleActive]}
                  onPress={() => toggleVisibility(item.id, item.visibility_enabled, item.parent_id)}
                >
                  <Text style={[styles.toggleTxt, item.visibility_enabled && styles.toggleTxtActive]}>
                    Visibility {item.visibility_enabled ? 'On' : 'Off'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(item.id, item.parent_id)}>
                  <Text style={styles.revokeTxt}>Revoke</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  header: { marginBottom: Spacing.lg },
  eyebrow: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: Typography.h2, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  subtitle: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xs },
  sectionTitle: { fontSize: Typography.caption, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: Spacing.md, marginTop: Spacing.md },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  name: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  username: { fontSize: Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
  acceptBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.sm, flex: 1, alignItems: 'center' },
  acceptTxt: { color: Colors.textPrimary, fontWeight: '800' },
  declineBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.sm, flex: 1, alignItems: 'center' },
  declineTxt: { color: Colors.textSecondary, fontWeight: '700' },
  blockBtn: { borderWidth: 1, borderColor: Colors.error, borderRadius: BorderRadius.md, padding: Spacing.sm, flex: 1, alignItems: 'center' },
  blockTxt: { color: Colors.error, fontWeight: '800' },
  toggleBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.sm, flex: 1, alignItems: 'center' },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleTxt: { color: Colors.textSecondary, fontWeight: '700' },
  toggleTxtActive: { color: Colors.textPrimary },
  revokeBtn: { borderWidth: 1, borderColor: Colors.error, borderRadius: BorderRadius.md, padding: Spacing.sm, flex: 1, alignItems: 'center' },
  revokeTxt: { color: Colors.error, fontWeight: '800' },
  emptyCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  empty: { color: Colors.textMuted, fontSize: Typography.bodySmall },
})
