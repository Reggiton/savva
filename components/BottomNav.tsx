import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import { Colors, Spacing, Typography } from '../lib/theme'

interface NavItem {
  name: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
  route: string
  pathname: string
}

interface BottomNavProps {
  userType: 'kid' | 'parent'
}

export default function BottomNav({ userType }: BottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  const kidNavItems: NavItem[] = [
    {
      name: 'home',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
      route: '/(kid)',
      pathname: '/',
    },
    {
      name: 'goals',
      label: 'Goals',
      icon: 'flag-outline',
      activeIcon: 'flag',
      route: '/(kid)/goals',
      pathname: '/goals',
    },
    {
      name: 'transactions',
      label: 'Transactions',
      icon: 'card-outline',
      activeIcon: 'card',
      route: '/(kid)/transactions',
      pathname: '/transactions',
    },
    {
      name: 'settings',
      label: 'Insights',
      icon: 'analytics-outline',
      activeIcon: 'analytics',
      route: '/(kid)/insights',
      pathname: '/insights',
    },
  ]

  const parentNavItems: NavItem[] = [
    {
      name: 'home',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
      route: '/(parent)',
      pathname: '/',
    },
    {
      name: 'notifications',
      label: 'Alerts',
      icon: 'notifications-outline',
      activeIcon: 'notifications',
      route: '/(parent)/notifications',
      pathname: '/notifications',
    },
  ]

  const navItems = userType === 'kid' ? kidNavItems : parentNavItems

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const isActive = pathname === item.pathname

        return (
          <TouchableOpacity
            key={item.name}
            style={styles.navItem}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={24}
              color={isActive ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  label: {
    fontSize: Typography.tiny,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
})
