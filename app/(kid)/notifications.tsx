import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'

type Notification = {
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
}

const TYPE_ICONS: { [key: string]: string } = {
  connection_request: '👋',
  request_accepted: '✅',
  request_declined: '❌',
  access_revoked: '🚫',
  blocked: '⛔',
  visibility_toggled: '👁',
  account_deleted: '🗑',
}

export default function KidNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        await fetchNotifications(user.id)
        setLoading(false)
      }
    })
  }, [])

  async function fetchNotifications(uid: string) {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, message, read, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead(uid: string) {
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          Notifications {unreadCount > 0 && <Text style={styles.badge}> {unreadCount} </Text>}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) markAllRead(user.id)
          }}>
            <Text style={styles.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.unread]}
            onPress={() => markAsRead(item.id)}
          >
            <Text style={styles.icon}>{TYPE_ICONS[item.type] || '🔔'}</Text>
            <View style={styles.cardContent}>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>No notifications yet.</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  badge: { fontSize: 14, backgroundColor: '#ff3b30', color: '#fff', borderRadius: 10, paddingHorizontal: 6 },
  markAllBtn: { color: '#007AFF', fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 8 },
  unread: { backgroundColor: '#e8f0fe' },
  icon: { fontSize: 24, marginRight: 12 },
  cardContent: { flex: 1 },
  message: { fontSize: 15, color: '#333', marginBottom: 4 },
  date: { fontSize: 12, color: '#999' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#007AFF' },
  emptyCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 24, alignItems: 'center', marginTop: 16 },
  emptyTxt: { color: '#999', fontSize: 14 },
})