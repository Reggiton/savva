import React from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BorderRadius, Colors, Spacing, Typography } from '../lib/theme'

interface HeaderProps {
  greeting?: string
  userName: string
  userInitials?: string
  profilePicUrl?: string
  onProfilePress?: () => void
}

export default function Header({
  greeting = 'Good morning',
  userName,
  userInitials,
  profilePicUrl,
  onProfilePress,
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
      <View style={styles.textContainer}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.userName}>{userName}</Text>
      </View>

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
  textContainer: {
    flex: 1,
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
