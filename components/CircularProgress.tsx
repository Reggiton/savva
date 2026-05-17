import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Colors, Typography, Spacing } from '../lib/theme'

interface CircularProgressProps {
  percentage: number
  size?: number
  strokeWidth?: number
  label?: string
}

export default function CircularProgress({
  percentage,
  size = 180,
  strokeWidth = 16,
  label = 'SAVED',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.progressBackground}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.primary}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      
      <View style={styles.textContainer}>
        <Text style={styles.percentage}>{Math.round(percentage)}%</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    transform: [{ rotate: '0deg' }],
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  label: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontWeight: '500',
  },
})
