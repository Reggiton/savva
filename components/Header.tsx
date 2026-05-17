import React from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BorderRadius, Colors, Spacing, Typography } from '../lib/theme'

interface HeaderProps {
  greeting?: string
  userName: string
  userInitials?: string
  profilePicUrl?: string
  onProfilePress?: () => void
  onNotificationsPress?: () => void
  unreadNotificationCount?: number
}

export default function Header({
  greeting = 'Good morning',
  userName,
  userInitials,
  profilePicUrl,
  onProfilePress,
  onNotificationsPress,
  unreadNotificationCount = 0,
}: HeaderProps) {
  const initials =
    userInitials ||
    userName
      .split(' ')
      .map((name) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  return (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <View style={styles.logoBadge}>
          <Image source={require('../assets/savva-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.brand}>SAVVA</Text>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={onNotificationsPress}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
          {unreadNotificationCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileBadge}
          onPress={onProfilePress}
          activeOpacity={0.7}
        >
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={styles.profileImage} />
          ) : (
            <Text style={styles.initials}>{initials}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  logo: {
    width: 32,
    height: 32,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  brand: {
    color: Colors.primaryLight,
    fontSize: Typography.tiny,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  greeting: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: Typography.h3,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#FF2DAA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  notificationBadgeText: {
    color: Colors.textPrimary,
    fontSize: Typography.tiny,
    fontWeight: '900',
  },
  profileBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
})
