import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
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
  totalLabel?: string
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

export default function SpendingPieChart({ slices, size = 220, totalLabel = 'Monthly spending' }: SpendingPieChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
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

  const selected = selectedIndex === null ? null : arcs[selectedIndex]

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

          {arcs.map((arc) => {
            const isSelected = arc.index === selectedIndex
            const isDimmed = selectedIndex !== null && !isSelected

            return (
            <Path
              key={arc.category}
              d={arc.path}
              stroke={arc.color}
              strokeWidth={isSelected ? 36 : 30}
              strokeLinecap="butt"
              opacity={isDimmed ? 0.22 : 1}
              fill="transparent"
              onPress={() => setSelectedIndex(isSelected ? null : arc.index)}
            />
            )
          })}
        </Svg>

        <View style={[styles.centerLabel, selected && styles.centerLabelSelected]}>
          <Text style={styles.centerAmount}>
            ${Math.abs(selected?.amount ?? total).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.centerCaption}>
            {selected ? formatCategory(selected.category) : totalLabel}
          </Text>
        </View>
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
    maxWidth: '58%',
  },
  centerLabelSelected: {
    shadowColor: Colors.primaryLight,
    shadowOpacity: 0.75,
    shadowRadius: 12,
    elevation: 8,
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
    textAlign: 'center',
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
