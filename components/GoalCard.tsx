import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../lib/theme'

interface GoalCardProps {
  title: string
  targetAmount: number
  currentAmount: number
  targetDate: string
}

export default function GoalCard({ 
  title, 
  targetAmount, 
  currentAmount,
  targetDate 
}: GoalCardProps) {
  const progress = (currentAmount / targetAmount) * 100

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.date}>Est. {targetDate}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.amount}>
            ${currentAmount.toLocaleString()}
          </Text>
          <Text style={styles.target}>
            of ${targetAmount.toLocaleString()}
          </Text>
        </View>
      </View>
      
      <View style={styles.progressBarContainer}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${Math.min(progress, 100)}%` }
          ]} 
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  date: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
  },
  amount: {
    fontSize: Typography.h4,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  target: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.progressBackground,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
})
