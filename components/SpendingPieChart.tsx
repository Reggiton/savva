import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { BorderRadius, Colors, Spacing, Typography } from '../lib/theme'

export type SpendingSlice = {
  category: string
  amount: number
  color: string
}

interface SpendingPieChartProps {
  slices: SpendingSlice[]
  size?: number
}

function polarToCartesian(center: number, radius: number, angle: number) {
  const angleInRadians = ((angle - 90) * Math.PI) / 180

  return {
    x: center + radius * Math.cos(angleInRadians),
    y: center + radius * Math.sin(angleInRadians),
  }
}

function describeArc(center: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(center, radius, endAngle)
  const end = polarToCartesian(center, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    `M ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
  ].join(' ')
}

function formatCategory(category: string) {
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function SpendingPieChart({ slices, size = 220 }: SpendingPieChartProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const radius = size / 2 - 18
  const center = size / 2
  const total = slices.reduce((sum, slice) => sum + Math.abs(slice.amount), 0)

  const arcs = useMemo(() => {
    let currentAngle = 0

    return slices.map((slice, index) => {
      const percentage = total > 0 ? Math.abs(slice.amount) / total : 0
      const startAngle = currentAngle
      const endAngle = currentAngle + percentage * 360
      currentAngle = endAngle

      return {
        ...slice,
        index,
        percentage,
        path: describeArc(center, radius, startAngle, endAngle),
      }
    })
  }, [center, radius, slices, total])

  const selected = arcs[selectedIndex] || arcs[0]

  if (total <= 0 || arcs.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyTitle}>No spending yet</Text>
        <Text style={styles.emptyText}>Your chart will appear after transactions sync.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.chartWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={Colors.progressBackground}
            strokeWidth={28}
            fill="transparent"
          />

          {arcs.map((arc) => (
            <Path
              key={arc.category}
              d={arc.path}
              stroke={arc.color}
              strokeWidth={30}
              strokeLinecap="butt"
              opacity={arc.index === selectedIndex ? 1 : 0.82}
              fill="transparent"
              onPress={() => setSelectedIndex(arc.index)}
            />
          ))}
        </Svg>

        <View style={styles.centerLabel}>
          <Text style={styles.centerAmount}>
            ${Math.abs(selected.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.centerCaption}>
            {Math.round(selected.percentage * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={[styles.colorDot, { backgroundColor: selected.color }]} />
          <Text style={styles.infoTitle}>{formatCategory(selected.category)}</Text>
        </View>
        <Text style={styles.infoText}>
          ${Math.abs(selected.amount).toFixed(2)} of your recent spending
        </Text>
      </View>

      <View style={styles.legend}>
        {arcs.slice(0, 5).map((arc) => (
          <TouchableOpacity
            key={arc.category}
            style={[styles.legendItem, arc.index === selectedIndex && styles.legendItemActive]}
            onPress={() => setSelectedIndex(arc.index)}
            activeOpacity={0.8}
          >
            <View style={[styles.legendDot, { backgroundColor: arc.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {formatCategory(arc.category)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  centerCaption: {
    marginTop: 2,
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoCard: {
    width: '100%',
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  infoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
  },
  legend: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '48%',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.cardBackgroundAlt,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
    fontWeight: '700',
    flexShrink: 1,
  },
  emptyChart: {
    width: '100%',
    padding: Spacing.xl,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.cardBackground,
    marginVertical: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    textAlign: 'center',
  },
})
