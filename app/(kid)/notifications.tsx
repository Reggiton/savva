import { useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

type Notification = {
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
}

const TYPE_LABELS: { [key: string]: string } = {
  connection_request: 'Request',
  request_accepted: 'Accepted',
  request_declined: 'Declined',
  access_revoked: 'Revoked',
  blocked: 'Blocked',
  visibility_toggled: 'Visibility',
  account_deleted: 'Deleted',
}

export default function KidNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      async function loadNotifications() {
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) return

          await fetchNotifications(user.id)
        } catch (error) {
          console.log('kid notifications load error:', error)
        } finally {
          setLoading(false)
        }
      }

      loadNotifications()
    }, [])
  )

  async function onRefresh() {
    setRefreshing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await fetchNotifications(user.id)
    } finally {
      setRefreshing(false)
    }
  }

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
    setNotifications((prev) => prev.map((notification) => notification.id === id ? { ...notification, read: true } : notification))
  }

  async function markAllRead(uid: string) {
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid)
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ACTIVITY</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={async () => {
              const { data: { user } } = await supabase.auth.getUser()
              if (user) markAllRead(user.id)
            }}
          >
            <Text style={styles.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.cardBackground}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.unread]}
            onPress={() => markAsRead(item.id)}
            activeOpacity={0.85}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{TYPE_LABELS[item.type]?.slice(0, 2).toUpperCase() || 'NO'}</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.messageRow}>
                <Text style={styles.type}>{TYPE_LABELS[item.type] || 'Notification'}</Text>
                {!item.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyTxt}>Updates from connections will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  eyebrow: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: Typography.h2, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  markAllBtn: { color: Colors.primary, fontSize: Typography.bodySmall, fontWeight: '800', paddingTop: Spacing.xs },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  unread: { borderColor: Colors.primary, backgroundColor: Colors.cardBackgroundAlt },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  badgeText: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.caption },
  cardContent: { flex: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  type: { fontSize: Typography.caption, color: Colors.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  message: { fontSize: Typography.bodySmall, color: Colors.textPrimary, marginTop: 4, marginBottom: 4, lineHeight: 20 },
  date: { fontSize: Typography.caption, color: Colors.textMuted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  emptyCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '800', marginBottom: Spacing.xs },
  emptyTxt: { color: Colors.textMuted, fontSize: Typography.bodySmall, textAlign: 'center' },
})
