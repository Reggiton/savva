import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../lib/theme'

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  variant?: 'default' | 'primary'
  onInfoPress?: () => void
}

export default function StatCard({ 
  label, 
  value, 
  subtitle,
  variant = 'default',
  onInfoPress,
}: StatCardProps) {
  return (
    <View style={[
      styles.container,
      variant === 'primary' && styles.containerPrimary
    ]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {onInfoPress && (
          <TouchableOpacity style={styles.infoButton} onPress={onInfoPress} activeOpacity={0.75}>
            <Text style={styles.infoText}>?</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.value}>{value}</Text>
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flex: 1,
    ...Shadows.medium,
  },
  containerPrimary: {
    backgroundColor: Colors.cardBackgroundAlt,
  },
  header: {
    minHeight: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: Typography.tiny,
    color: Colors.textSecondary,
    letterSpacing: 1,
    fontWeight: '600',
    flexShrink: 1,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    flexShrink: 1,
  },
  infoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.progressBackground,
    marginLeft: Spacing.xs,
  },
  infoText: {
    color: Colors.textPrimary,
    fontSize: Typography.caption,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
  },
})
